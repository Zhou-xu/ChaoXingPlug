/**
 * 端到端测试：学习通 mock 页面（jsdom）+ 真实火山方舟 API + DOM 自动作答断言
 * 运行：npx tsx test/e2e.test.ts
 */
import { JSDOM } from 'jsdom';
import {
  scanQuestions, applyAnswer,
  type QuestionItem,
} from '../lib/answer-engine';
import { askOne, type AiConfig, type QuestionPayload } from '../lib/ai-protocol';
import { loadTestConfig } from './test-config';

// ===================== 测试环境配置（真实 API，来自 gitignored 的 local.config.json） =====================

const CFG: AiConfig = loadTestConfig();

// ===================== 学习通页面 mock =====================

const MOCK_HTML = `<!doctype html><html><body>
<div id="app">

  <!-- 第1题：单选 -->
  <div class="padBom50 questionLi fontLabel singleQuesId" id="question1">
    <div class="mark_name"><span class="colorShallow">单选题</span><span class="colorShallow">(2分)</span>下列哪个城市是中国的首都？</div>
    <div class="clearfix answerBg workTextWrap"><div class="choice num_option fl">A</div><div class="workFont fl">上海</div></div>
    <div class="clearfix answerBg workTextWrap"><div class="choice num_option fl">B</div><div class="workFont fl">北京</div></div>
    <div class="clearfix answerBg workTextWrap"><div class="choice num_option fl">C</div><div class="workFont fl">广州</div></div>
    <div class="clearfix answerBg workTextWrap"><div class="choice num_option fl">D</div><div class="workFont fl">深圳</div></div>
  </div>

  <!-- 第2题：多选 -->
  <div class="padBom50 questionLi fontLabel multipleQuesId" id="question2">
    <div class="mark_name"><span class="colorShallow">多选题</span><span class="colorShallow">(4分)</span>下列哪些城市是中国的直辖市？</div>
    <div class="clearfix answerBg workTextWrap"><div class="choice num_option fl">A</div><div class="workFont fl">北京</div></div>
    <div class="clearfix answerBg workTextWrap"><div class="choice num_option fl">B</div><div class="workFont fl">上海</div></div>
    <div class="clearfix answerBg workTextWrap"><div class="choice num_option fl">C</div><div class="workFont fl">广州</div></div>
    <div class="clearfix answerBg workTextWrap"><div class="choice num_option fl">D</div><div class="workFont fl">重庆</div></div>
  </div>

  <!-- 第3题：判断 -->
  <div class="padBom50 questionLi fontLabel judgementNqueId" id="question3">
    <div class="mark_name"><span class="colorShallow">判断题</span><span class="colorShallow">(2分)</span>地球是太阳系中的一颗行星。</div>
    <div class="clearfix answerBg workTextWrap"><div class="workFont fl">对</div></div>
    <div class="clearfix answerBg workTextWrap"><div class="workFont fl">错</div></div>
  </div>

  <!-- 第4题：填空（2空） -->
  <div class="padBom50 questionLi fontLabel completionQuesId" id="question4">
    <div class="mark_name"><span class="colorShallow">填空题</span><span class="colorShallow">(4分)</span>中国最长的河流是（　），它的发源地是（　）。</div>
    <div class="mark_name"><span class="colorShallow">第1空</span></div>
    <textarea id="answerEditor1"></textarea>
    <div class="mark_name"><span class="colorShallow">第2空</span></div>
    <textarea id="answerEditor2"></textarea>
  </div>

  <!-- 第5题：简答 -->
  <div class="padBom50 questionLi fontLabel shortanswerQuesId" id="question5">
    <div class="mark_name"><span class="colorShallow">简答题</span><span class="colorShallow">(10分)</span>请简述什么是操作系统。</div>
    <textarea id="answerEditor5"></textarea>
  </div>

</div>
</body></html>`;

// ===================== 断言工具 =====================

let passed = 0, failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ ${msg}`); }
}

// ===================== 主流程 =====================

async function main() {
  // 1. 构造 jsdom 环境
  const dom = new JSDOM(MOCK_HTML, { url: 'https://mooc1.chaoxing.com/mooc2/work/selectWorkQuestionYiPiYue' });
  const { window } = dom;
  const { document } = window;
  (globalThis as any).window = window;
  (globalThis as any).document = document;
  (globalThis as any).Event = window.Event;
  (globalThis as any).KeyboardEvent = window.KeyboardEvent;
  (globalThis as any).HTMLElement = window.HTMLElement;

  // 模拟学习通点击选中行为：answerBg 点击后加 check_answer 类（单选互斥，多选切换）
  document.querySelectorAll<HTMLElement>('.questionLi').forEach((q) => {
    const options = q.querySelectorAll<HTMLElement>('.answerBg');
    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        if (q.className.includes('singleQuesId') || q.className.includes('judgement')) {
          options.forEach((o) => o.classList.remove('check_answer'));
        }
        opt.classList.toggle('check_answer');
      });
    });
  });

  // 2. 扫描题目
  console.log('\n【阶段1】题目扫描');
  const questions: QuestionItem[] = scanQuestions(document);
  assert(questions.length === 5, `扫描到 5 道题（实际 ${questions.length}）`);
  const kinds = questions.map((q) => q.kind).join(',');
  assert(kinds === 'single,multiple,judge,completion,shortanswer', `题型识别正确：${kinds}`);
  assert(questions[0].title.includes('首都'), `单选标题抓取含关键词：${questions[0].title.slice(0, 30)}`);
  assert(questions[1].options.length === 4, `多选抓到 4 个选项`);
  assert(questions[1].options[0].startsWith('A.'), `选项带字母编号：${questions[1].options[0]}`);
  assert(questions[3].options.length === 0, `填空题无选项`);

  // 3. 真实 API 逐题作答
  console.log('\n【阶段2】真实 API 请求');
  const payloads: QuestionPayload[] = questions.map(({ el, ...rest }) => rest);
  const answers: Array<{
    index: number; kind: import('../lib/answer-engine').QuestionKind;
    answer: string | string[]; analysis: string;
    status: 'answered' | 'failed'; error?: string;
  }> = [];
  for (const q of payloads) {
    process.stdout.write(`  请求第 ${q.index + 1} 题(${q.kind})...`);
    try {
      const r = await askOne(CFG, q);
      console.log(` 答案=${JSON.stringify(r.answer)}`);
      answers.push({ index: q.index, kind: q.kind, answer: r.answer, analysis: r.analysis, status: 'answered' as const });
    } catch (e: any) {
      console.log(` 失败: ${e.message}`);
      answers.push({ index: q.index, kind: q.kind, answer: '', analysis: '', status: 'failed' as const, error: e.message });
    }
  }

  // 4. 校验 AI 答案正确性
  console.log('\n【阶段3】AI 答案正确性');
  const [a1, a2, a3, a4, a5] = answers;
  assert(a1.status === 'answered' && String(a1.answer).toUpperCase() === 'B', `第1题答案为 B（实际 ${JSON.stringify(a1.answer)}）`);
  const mStr = String(a2.answer).toUpperCase().replace(/[^ABD]/g, '');
  assert(a2.status === 'answered' && /^[ABD]+$/.test(mStr) && mStr.includes('A') && mStr.includes('B') && mStr.includes('D'),
    `第2题答案为 ABD（实际 ${JSON.stringify(a2.answer)}）`);
  assert(a3.status === 'answered' && String(a3.answer).includes('对'), `第3题答案为 对（实际 ${JSON.stringify(a3.answer)}）`);
  assert(a4.status === 'answered' && Array.isArray(a4.answer) && a4.answer.length === 2 && String(a4.answer[0]).includes('长江'),
    `第4题两空且第一空含"长江"（实际 ${JSON.stringify(a4.answer)}）`);
  assert(a5.status === 'answered' && String(a5.answer).length > 10, `第5题简答非空（实际 ${String(a5.answer).slice(0, 40)}…）`);

  // 5. 自动作答并校验 DOM
  console.log('\n【阶段4】DOM 自动作答');
  questions.forEach((q) => {
    const ans = answers.find((a) => a.index === q.index)!;
    if (ans.status === 'failed') return;
    try {
      applyAnswer(q, ans);
    } catch (e: any) {
      console.error(`  第${q.index + 1}题作答异常: ${e.message}`);
    }
  });

  const q1 = document.getElementById('question1')!;
  assert(q1.querySelectorAll('.answerBg')[1].classList.contains('check_answer'), '第1题：选中了 B 选项');
  assert(q1.querySelectorAll('.check_answer').length === 1, '第1题：仅选中一项');

  const q2 = document.getElementById('question2')!;
  const checked2Letters = Array.from(q2.querySelectorAll<HTMLElement>('.answerBg'))
    .filter((el) => el.classList.contains('check_answer'))
    .map((el) => el.textContent?.trim()[0]);
  assert(checked2Letters.join('') === mStr, `第2题：选中了 ${checked2Letters.join('')}（期望 ${mStr}）`);

  const q3 = document.getElementById('question3')!;
  const checked3 = q3.querySelector('.check_answer')?.textContent?.trim();
  assert(checked3 === '对', `第3题：选中了「${checked3}」`);

  const t1 = document.getElementById('answerEditor1') as HTMLTextAreaElement;
  const t2 = document.getElementById('answerEditor2') as HTMLTextAreaElement;
  assert(t1.value.includes('长江'), `第4题第1空已填：${t1.value}`);
  assert(t2.value.length > 0, `第4题第2空已填：${t2.value}`);

  const t5 = document.getElementById('answerEditor5') as HTMLTextAreaElement;
  assert(t5.value.length > 10, `第5题简答已填：${t5.value.slice(0, 50)}…`);

  // 汇总
  console.log(`\n========== 测试结果: ${passed} 通过 / ${failed} 失败 ==========`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('测试执行异常:', e);
  process.exit(1);
});
