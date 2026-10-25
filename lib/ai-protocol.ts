// AI 请求协议：prompt 构造、Chat Completions 调用、JSON 容错解析
// 纯逻辑无浏览器依赖，background 与测试共用

import type { QuestionKind } from './answer-engine';

export interface QuestionPayload {
  index: number;
  kind: QuestionKind;
  title: string;
  /** 选项文本（含字母编号），选择题/判断题使用 */
  options: string[];
}

/** AI 配置 */
export interface AiConfig {
  requestUrl: string;
  apikey: string;
  model: string;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  requestUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  apikey: '',
  model: 'doubao-seed-2-1-lite-260915',
};

export function kindLabel(kind: QuestionKind): string {
  return {
    single: '单选题', multiple: '多选题', judge: '判断题',
    completion: '填空题', shortanswer: '简答题', unknown: '未知题型',
  }[kind];
}

/** API Key 统一补 Bearer 前缀（已带则不重复） */
export function normalizeAuthHeader(apikey: string): string {
  if (!apikey) throw new Error('API Key 为空，请先在「我的AI」页面配置');
  return /^bearer /i.test(apikey) ? apikey : `Bearer ${apikey}`;
}

/** 按题型构造 system / user 提示词 */
export function buildPrompts(q: QuestionPayload): { system: string; user: string } {
  const formatHint = {
    single: 'answer 为单个大写字母，例如 "A"',
    multiple: 'answer 为多个大写字母组成的字符串，例如 "ABD"（全对才得分，宁缺勿滥）',
    judge: 'answer 只能是 "对" 或 "错"',
    completion: 'answer 为字符串数组，按空序依次给出每空答案，例如 ["北京","上海"]',
    shortanswer: 'answer 为一段简洁准确的中文文字（100字以内）',
    unknown: 'answer 为最可能的答案文本',
  }[q.kind];

  const system =
    '你是一个严谨的答题助手。根据题目给出答案。' +
    '只输出一个 JSON 对象，禁止输出任何其他文字或代码块标记，格式为：' +
    `{"answer": <见要求>, "analysis": "<不超过50字的解析>"}。`;
  const user =
    `题目类型：${kindLabel(q.kind)}\n` +
    `题干：${q.title}\n` +
    (q.options.length ? `选项：\n${q.options.join('\n')}\n` : '') +
    `要求：${formatHint}`;
  return { system, user };
}

/** 容错解析 AI 输出中的 JSON（支持 ```json 代码块、前后杂文字） */
export function extractJson(text: string): { answer?: unknown; analysis?: unknown } | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 单题请求 AI，返回 { answer, analysis } */
export async function askOne(
  cfg: AiConfig,
  q: QuestionPayload
): Promise<{ answer: string | string[]; analysis: string }> {
  const { system, user } = buildPrompts(q);
  const resp = await fetch(cfg.requestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: normalizeAuthHeader(cfg.apikey),
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      // 关闭深度思考，lite 模型答题足够且更快（火山方舟参数，其他厂商会忽略）
      thinking: { type: 'disabled' },
      temperature: 0.2,
    }),
  });

  if (!resp.ok) {
    const errText = (await resp.text()).slice(0, 300);
    throw new Error(`AI 接口返回 HTTP ${resp.status}：${errText}`);
  }
  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`AI 接口返回异常：${JSON.stringify(data).slice(0, 300)}`);

  const parsed = extractJson(content);
  if (!parsed || parsed.answer === undefined || parsed.answer === null) {
    throw new Error(`AI 未按格式回答：${content.slice(0, 200)}`);
  }
  return {
    answer: parsed.answer as string | string[],
    analysis: String(parsed.analysis || ''),
  };
}
