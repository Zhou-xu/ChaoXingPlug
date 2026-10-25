import {
  scanQuestions,
  applyAnswer,
  type AnswerPayload,
} from '@/lib/answer-engine';

let overlay: { update: (html: string) => void; remove: () => void } | null = null;

export default defineContentScript({
  matches: ['*://*.chaoxing.com/*'],
  // 学习通作业/考试页面嵌在 iframe 中，必须允许所有 frame 注入
  allFrames: true,
  runAt: 'document_idle',
  main() {
    chrome.runtime.onMessage.addListener((request: any, _sender: any, _sendResponse: any) => {
      if (request.type !== 'permission') return;
      if (request.permission === 'allow') {
        run();
      } else if (request.permission === 'deny') {
        overlay?.remove();
        overlay = null;
      }
    });

    // 调试入口：页面控制台执行 window.dispatchEvent(new Event('CX_AI_HELPER_RUN')) 可手动触发一次答题
    window.addEventListener('CX_AI_HELPER_RUN', () => run());
  },
});

// ===================== 主流程 =====================

async function run() {
  const questions = scanQuestions();
  if (questions.length === 0) {
    // 当前 frame 没有题目（比如外层页面），静默不弹窗，只在有题目的 frame 显示浮层
    return;
  }

  showOverlay(`已找到 ${questions.length} 道题，正在请求 AI 作答…`);

  let response: any;
  try {
    response = await chrome.runtime.sendMessage({
      type: 'seedQuestion',
      questions: questions.map(({ el, ...rest }) => rest),
    });
  } catch (e: any) {
    showOverlay(`❌ 无法连接后台服务：${e.message}，请刷新页面后重试`);
    return;
  }

  if (!response || !response.ok) {
    showOverlay(`❌ 答题失败：${response?.error || '后台无响应'}`);
    return;
  }

  const answers: AnswerPayload[] = response.answers || [];
  const results: string[] = [];
  questions.forEach((q) => {
    const ans = answers.find((a) => a.index === q.index);
    if (!ans || ans.status === 'failed') {
      results.push(`第${q.index + 1}题：❌ 失败 ${ans?.error ? '- ' + ans.error.slice(0, 60) : ''}`);
      return;
    }
    try {
      applyAnswer(q, ans);
      const display = Array.isArray(ans.answer) ? ans.answer.join(' | ') : String(ans.answer);
      results.push(`第${q.index + 1}题：✅ ${display}`);
    } catch (e: any) {
      results.push(
        `第${q.index + 1}题：⚠️ AI 已回答「${String(ans.answer).slice(0, 30)}」但自动填写失败：${e.message}`
      );
    }
  });

  const okCount = results.filter((r) => r.includes('✅')).length;
  showOverlay(
    `答题完成（${okCount}/${questions.length} 成功）<br>` +
    results.map((r) => `<div class="cx-line">${escapeHtml(r)}</div>`).join('')
  );
}

// ===================== 浮层 UI（Shadow DOM 隔离样式） =====================

function showOverlay(html: string) {
  if (!overlay) overlay = createOverlay();
  overlay.update(html);
}

function createOverlay() {
  const host = document.createElement('div');
  host.id = 'cx-ai-helper-overlay';
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .panel { width: 300px; max-height: 320px; overflow-y: auto; background:#fff;
      border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,.18);
      font: 13px/1.6 system-ui, "Microsoft YaHei", sans-serif; color:#303133;
      padding:12px 14px; }
    .title { font-weight:600; font-size:14px; margin-bottom:6px;
      display:flex; align-items:center; gap:6px; }
    .dot { width:8px; height:8px; border-radius:50%; background:#409eff; display:inline-block; }
    .cx-line { margin:2px 0; word-break:break-all; }
    .btn { margin-top:8px; background:#409eff; color:#fff; border:none;
      border-radius:6px; padding:5px 14px; cursor:pointer; font-size:12px; }
    .btn:hover { background:#66b1ff; }
    .close { float:right; cursor:pointer; color:#909399; font-size:14px; padding:0 2px; }
    .close:hover { color:#409eff; }
  `;
  const panel = document.createElement('div');
  panel.className = 'panel';

  shadow.appendChild(style);
  shadow.appendChild(panel);
  document.body.appendChild(host);

  return {
    update(html: string) {
      panel.innerHTML =
        `<div class="title"><span class="dot"></span>学习通 AI 助手<span class="close" title="收起">✕</span></div>` +
        `<div>${html}</div>` +
        `<button class="btn">重新作答</button>`;
      panel.querySelector('.close')!.addEventListener('click', () => {
        host.remove();
        overlay = null;
      });
      panel.querySelector('.btn')!.addEventListener('click', () => {
        run();
      });
    },
    remove() {
      host.remove();
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
