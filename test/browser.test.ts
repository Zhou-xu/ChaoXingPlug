/**
 * 真实浏览器扩展测试：playwright-core + Edge 加载扩展
 * 前置：content.ts matches 已临时加入 http://localhost:8899/* 并完成 npm run build
 * 运行：npx tsx test/browser.test.ts
 *
 * 验证链路：popup 配置保存(storage) -> 页面事件触发 -> content 扫描 ->
 *          chrome.runtime 消息 -> background 调 AI -> content 自动作答 -> 浮层 UI -> 答题状态页
 */
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadTestConfig } from './test-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CFG = loadTestConfig();

const EXT_PATH = path.resolve(__dirname, '../.output/chrome-mv3');
const MOCK_DIR = path.resolve(__dirname, 'mock-www');
const PORT = 8899;

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ ${msg}`); }
}

function startServer(): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(path.join(MOCK_DIR, 'index.html')));
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await startServer();
  console.log(`mock 页面服务: http://127.0.0.1:${PORT}`);

  // launchPersistentContext 加载扩展（headless=new 模式支持 MV3 扩展）
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-ext-profile-'));
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'msedge',
    headless: true,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--headless=new',
    ],
  });
  console.log('Edge 已启动，扩展已加载');

  try {
    // 1. 等待 service worker 启动并取得扩展 ID
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 30000 });
    const extId = new URL(worker.url()).host;
    console.log('扩展 ID:', extId);
    assert(!!extId, 'background service worker 已启动');

    // 2. 打开 popup 页面，走真实 UI 保存配置（验证 userInfo 消息链路）
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await popup.waitForSelector('.nav-bar button', { timeout: 15000 });
    // 切到「我的AI」页
    await popup.click('.nav-bar button:nth-child(3)');
    await popup.waitForSelector('input[type=password]', { timeout: 10000 });
    // 按测试配置填写 URL / Key / 模型三个输入框
    const inputs = popup.locator('.el-input__inner:not([type=password])');
    await inputs.nth(0).fill(CFG.requestUrl);
    await inputs.nth(1).fill(CFG.model);
    await popup.fill('input[type=password]', CFG.apikey);
    await popup.getByRole('button', { name: '保存配置' }).click();
    await popup.waitForTimeout(1500);
    // 直接读 storage 验证保存成功
    const stored: any = await popup.evaluate(() => chrome.storage.local.get(['requestUrl', 'apikey', 'model']));
    assert(!!stored.apikey && stored.model === CFG.model,
      `配置已写入 storage（model=${stored.model}, key=${stored.apikey?.slice(0, 12)}…）`);
    await popup.close();

    // 3. 打开 mock 页面，触发答题
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.waitForTimeout(1500); // 等 content script 注入
    await page.evaluate(() => window.dispatchEvent(new Event('CX_AI_HELPER_RUN')));
    console.log('  已触发答题，等待浮层与作答完成…');

    // 4. 等浮层出现"答题完成"
    await page.waitForFunction(() => {
      const host = document.getElementById('cx-ai-helper-overlay');
      if (!host || !host.shadowRoot) return false;
      return host.shadowRoot.textContent?.includes('答题完成') ?? false;
    }, null, { timeout: 180000 });

    const overlayText = await page.evaluate(() =>
      document.getElementById('cx-ai-helper-overlay')?.shadowRoot?.textContent || '');
    console.log('  浮层内容:', overlayText?.replace(/\s+/g, ' ').slice(0, 160));
    assert(overlayText.includes('5/5'), '浮层显示 5/5 成功');

    // 5. 校验页面 DOM 作答结果
    const domState = await page.evaluate(() => ({
      q1: Array.from(document.querySelectorAll('#question1 .answerBg'))
        .filter((el) => el.classList.contains('check_answer'))
        .map((el) => el.textContent?.trim()),
      q2: Array.from(document.querySelectorAll('#question2 .answerBg'))
        .filter((el) => el.classList.contains('check_answer'))
        .map((el) => el.textContent?.trim()),
      q3: document.querySelector('#question3 .check_answer')?.textContent?.trim(),
      blank1: (document.getElementById('answerEditor1') as HTMLTextAreaElement)?.value,
      blank2: (document.getElementById('answerEditor2') as HTMLTextAreaElement)?.value,
      short: (document.getElementById('answerEditor5') as HTMLTextAreaElement)?.value,
    }));
    console.log('  DOM 状态:', JSON.stringify(domState).slice(0, 220));
    assert(domState.q1.join('').includes('北京'), `第1题选中北京: ${domState.q1}`);
    assert(domState.q2.join('').includes('北京') && domState.q2.join('').includes('重庆') && domState.q2.join('').includes('上海'),
      `第2题选中 ABD 直辖市: ${domState.q2}`);
    assert(domState.q3 === '对', `第3题判断选对: ${domState.q3}`);
    assert((domState.blank1 || '').includes('长江'), `第4题第1空: ${domState.blank1}`);
    assert((domState.blank2 || '').length > 0, `第4题第2空: ${domState.blank2}`);
    assert((domState.short || '').length > 10, `第5题简答: ${(domState.short || '').slice(0, 40)}…`);

    // 6. 重新打开 popup「答题状态」页验证日志展示
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extId}/popup.html`);
    await popup2.waitForSelector('.nav-bar button', { timeout: 15000 });
    await popup2.click('.nav-bar button:nth-child(2)'); // 答题状态
    await popup2.waitForSelector('.el-collapse-item', { timeout: 10000 });
    const itemCount = await popup2.locator('.el-collapse-item').count();
    assert(itemCount === 5, `答题状态页展示 ${itemCount} 条记录`);
    const statusText = await popup2.locator('.summary').textContent();
    assert(!!statusText && statusText.includes('5'), `汇总卡片: ${statusText?.replace(/\s+/g, ' ')}`);
    await popup2.close();

    // 截图存档
    await page.screenshot({ path: path.resolve(__dirname, 'browser-test-result.png'), fullPage: true });
    console.log('  截图: test/browser-test-result.png');
  } finally {
    await context.close();
    server.close();
  }

  console.log(`\n========== 浏览器测试结果: ${passed} 通过 / ${failed} 失败 ==========`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('浏览器测试执行异常:', e);
  process.exit(1);
});
