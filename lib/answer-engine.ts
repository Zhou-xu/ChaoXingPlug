// 答题引擎：题目扫描 + 题型识别 + 自动作答
// 纯 DOM 逻辑，与浏览器扩展 API 解耦，便于测试与复用

export type QuestionKind = 'single' | 'multiple' | 'judge' | 'completion' | 'shortanswer' | 'unknown';

export interface QuestionItem {
  el: HTMLElement;
  index: number;
  kind: QuestionKind;
  title: string;
  /** "A. xxx" 形式 */
  options: string[];
}

export interface AnswerPayload {
  index: number;
  kind: QuestionKind;
  answer: string | string[];
  analysis: string;
  status: 'answered' | 'failed';
  error?: string;
}

/** 扫描页面上的全部题目（学习通 .questionLi 结构） */
export function scanQuestions(doc: Document = document): QuestionItem[] {
  const nodes = doc.querySelectorAll<HTMLElement>('.questionLi');
  const items: QuestionItem[] = [];
  nodes.forEach((el) => {
    const kind = detectKind(el);
    if (kind === 'unknown') return;
    items.push({
      el,
      index: 0,
      kind,
      title: extractTitle(el),
      options: extractOptions(el),
    });
  });
  // 以过滤后的顺序重新编号，保证与答案一一对应
  return items.map((it, i) => ({ ...it, index: i }));
}

/** 通过 questionLi 的 class 或题型文字识别题型 */
export function detectKind(el: HTMLElement): QuestionKind {
  const cls = el.className || '';
  if (/singleQuesId/.test(cls)) return 'single';
  if (/multipleQuesId/.test(cls)) return 'multiple';
  if (/judgement/i.test(cls)) return 'judge';
  if (/completion/.test(cls)) return 'completion';
  if (/shortanswer/i.test(cls)) return 'shortanswer';
  // 兜底：按页面上的题型标签文字判断
  const typeText = el.querySelector('.colorShallow, .mark_name')?.textContent || '';
  if (typeText.includes('单选')) return 'single';
  if (typeText.includes('多选')) return 'multiple';
  if (typeText.includes('判断')) return 'judge';
  if (typeText.includes('填空')) return 'completion';
  if (typeText.includes('简答') || typeText.includes('问答')) return 'shortanswer';
  return 'unknown';
}

/** 题干：取 mark_name 全部文字，去掉题型标签和分值，压平空白 */
export function extractTitle(el: HTMLElement): string {
  const marks = el.querySelectorAll('.mark_name');
  let text = '';
  marks.forEach((m) => {
    const t = (m.textContent || '')
      .replace(/[\t\r]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    // 过滤"第x空"占位行
    if (/^第\d+空$/.test(t)) return;
    text += t + ' ';
  });
  if (!text) text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  // 去掉开头的题型词与"（x分）"
  return text
    .replace(/^(单选题|多选题|判断题|填空题|简答题|名词解释|论述题|计算题)\s*/, '')
    .replace(/^[(（]\s*\d+(\.\d+)?\s*分\s*[)）]\s*/, '')
    .trim();
}

/** 选项：answerBg 每行一个选项，按 DOM 顺序以 A、B、C… 重新编号 */
export function extractOptions(el: HTMLElement): string[] {
  const optEls = el.querySelectorAll<HTMLElement>('.answerBg');
  const letters = 'ABCDEF';
  return Array.from(optEls).map((opt, i) => {
    const t = (opt.textContent || '').replace(/\s+/g, ' ').trim();
    return `${letters[i] || '?'}. ${t}`;
  });
}

/** 按题型把 AI 答案应用到页面 */
export function applyAnswer(q: QuestionItem, ans: AnswerPayload) {
  switch (q.kind) {
    case 'single':
    case 'multiple':
      clickOptions(q.el, String(ans.answer).toUpperCase());
      break;
    case 'judge':
      answerJudge(q.el, String(ans.answer));
      break;
    case 'completion': {
      const arr = Array.isArray(ans.answer) ? ans.answer : [String(ans.answer)];
      fillText(q.el, arr);
      break;
    }
    case 'shortanswer':
      fillText(q.el, [String(ans.answer)]);
      break;
    default:
      throw new Error('未知题型，无法自动填写');
  }
}

/** 选择题：按字母依次点击选项（answerBg 整行可点） */
export function clickOptions(qEl: HTMLElement, letters: string) {
  const options = qEl.querySelectorAll<HTMLElement>('.answerBg');
  if (options.length === 0) throw new Error('页面上未找到选项元素');
  for (const ch of letters) {
    const idx = ch.charCodeAt(0) - 'A'.charCodeAt(0);
    if (idx < 0 || idx >= options.length) continue;
    const opt = options[idx];
    // 已选中的不再点击，避免多选题反选
    const input = opt.querySelector('input');
    if (input && (input as HTMLInputElement).checked) continue;
    opt.click();
  }
}

/** 判断题：优先按选项文字匹配"对/错"，其次按 A/B 字母，最后找 radio */
export function answerJudge(qEl: HTMLElement, answer: string) {
  const isTrue = /对|正确|√|是|A/i.test(answer) && !/错|误|×|否/i.test(answer);
  const options = qEl.querySelectorAll<HTMLElement>('.answerBg');
  if (options.length > 0) {
    const target = Array.from(options).find((opt) => {
      const t = (opt.textContent || '').trim();
      if (isTrue) return /对|正确|√|^A$|是/.test(t);
      return /错|错误|×|^B$|否/.test(t);
    });
    if (target) {
      target.click();
      return;
    }
    // 文字匹配失败，退化为按 A/B 索引
    const idx = isTrue ? 0 : 1;
    if (options[idx]) {
      options[idx].click();
      return;
    }
  }
  // 新版页面：radio 形式的判断题
  const radios = qEl.querySelectorAll<HTMLInputElement>('input[type=radio]');
  for (const r of radios) {
    const labelText = (r.closest('label, li, span, div')?.textContent || '') + (r.value || '');
    if (isTrue && /对|正确|√|true|是|A/i.test(labelText)) { r.click(); return; }
    if (!isTrue && /错|错误|×|false|否|B/i.test(labelText)) { r.click(); return; }
  }
  throw new Error('未找到判断题的可点击选项');
}

/** 填空/简答：按空序依次写入。兼容普通 textarea、UEditor iframe、contenteditable */
export function fillText(qEl: HTMLElement, values: string[]) {
  const editors = collectEditors(qEl);
  if (editors.length === 0) throw new Error('未找到可填写的输入框');

  if (values.length === 1 && editors.length > 1) {
    // AI 只给了一个答案但页面有多个空：填入第一空
    writeTo(editors[0], values[0]);
    return;
  }
  for (let i = 0; i < editors.length && i < values.length; i++) {
    writeTo(editors[i], values[i] ?? '');
  }
}

/** 收集题目内的可编辑元素，按 DOM 顺序 */
export function collectEditors(qEl: HTMLElement): Array<HTMLTextAreaElement | HTMLInputElement | HTMLElement> {
  const result: Array<HTMLTextAreaElement | HTMLInputElement | HTMLElement> = [];
  // 1) UEditor（学习通考试页填空常用）：容器内含 iframe
  qEl.querySelectorAll<HTMLElement>('.edui-editor, [id^="ueditor"], .cy_editor').forEach((container) => {
    const iframe = container.querySelector('iframe');
    const body = iframe?.contentDocument?.body;
    if (body && (body as HTMLElement).isContentEditable) result.push(body as HTMLElement);
  });
  // 2) 普通 textarea / input / contenteditable div
  if (result.length === 0) {
    qEl.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('textarea, input[type=text]').forEach((ta) => {
      const style = window.getComputedStyle(ta);
      if (style.display === 'none' && !ta.closest('.edui-editor')) return;
      result.push(ta);
    });
    qEl.querySelectorAll<HTMLElement>('[contenteditable=true]').forEach((d) => {
      if (!result.includes(d)) result.push(d);
    });
  }
  return result;
}

/** 写入单空并触发事件，让页面框架感知到变更 */
export function writeTo(target: HTMLTextAreaElement | HTMLInputElement | HTMLElement, value: string) {
  const tag = (target as HTMLElement).tagName;
  if (tag === 'TEXTAREA' || tag === 'INPUT') {
    const field = target as HTMLTextAreaElement | HTMLInputElement;
    // 用元素自身原型的原生 setter 赋值，绕过框架对 value 的劫持
    const proto = Object.getPrototypeOf(field) as HTMLTextAreaElement | HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(field, value);
    else field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
  } else {
    target.innerText = value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    (target as HTMLElement).blur?.();
    target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }
}
