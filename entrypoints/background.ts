// 后台服务：配置存取、消息路由、批量答题编排、答题日志
import {
  askOne,
  normalizeAuthHeader,
  DEFAULT_AI_CONFIG,
  type AiConfig,
  type QuestionPayload,
} from '@/lib/ai-protocol';
import type { QuestionKind } from '@/lib/answer-engine';

/** background -> content 的答案载荷 */
export interface AnswerPayload {
  index: number;
  kind: QuestionKind;
  /** 单选/多选: "A" / "ABC"；判断: "对"/"错"；填空: string[]；简答: string */
  answer: string | string[];
  analysis: string;
  /** answered 成功 / failed AI 未给出可用答案 */
  status: 'answered' | 'failed';
  error?: string;
}

// ===================== 配置 =====================

/** 内存缓存，避免每次请求都读 storage */
const config: AiConfig = { ...DEFAULT_AI_CONFIG };

async function loadConfig(): Promise<AiConfig> {
  const result: any = await browser.storage.local.get(['requestUrl', 'apikey', 'model']);
  config.requestUrl = result.requestUrl || DEFAULT_AI_CONFIG.requestUrl;
  config.apikey = result.apikey || '';
  config.model = result.model || DEFAULT_AI_CONFIG.model;
  return { ...config };
}

// ===================== 答题日志（供 popup 答题状态页展示） =====================

export interface AnswerLogItem {
  index: number;
  kind: QuestionKind;
  title: string;
  answer: string | string[];
  analysis: string;
  status: 'answered' | 'failed';
  error?: string;
}

export interface AnswerLog {
  time: number;
  running: boolean;
  total: number;
  done: number;
  items: AnswerLogItem[];
}

async function writeLog(patch: Partial<AnswerLog> & { items?: AnswerLogItem[] }) {
  const result: any = await browser.storage.local.get('answerLog');
  const log: AnswerLog = (result.answerLog as AnswerLog) || {
    time: Date.now(), running: false, total: 0, done: 0, items: [],
  };
  Object.assign(log, patch);
  await browser.storage.local.set({ answerLog: log });
}

// ===================== 消息入口 =====================

export default defineBackground(() => {
  // 启动时读取已保存的配置
  loadConfig().then(() => console.log('【启动】已加载配置, model =', config.model));

  browser.runtime.onMessage.addListener((request: any, _sender: any, sendResponse: any) => {
    // content 提交题目，批量请求 AI 作答
    if (request.type === 'seedQuestion' && Array.isArray(request.questions)) {
      seedQuestions({ ...config }, request.questions)
        .then((answers) => sendResponse({ type: 'responseQuestion', ok: true, answers }))
        .catch((error) => {
          console.error('【错误】答题流程异常:', error);
          writeLog({ running: false }).catch(() => {});
          sendResponse({ type: 'responseQuestion', ok: false, error: error.message || String(error) });
        });
      return true; // 异步响应
    }
    // popup 保存用户 API 配置
    else if (request.type === 'userInfo') {
      storeUserInfo(request.url, request.apiKey, request.model)
        .then(async () => {
          await loadConfig();
          sendResponse({ status: 'success' });
        })
        .catch((error) => {
          console.error('【错误】保存配置失败:', error);
          sendResponse({ status: 'error', message: error.message });
        });
      return true;
    }
    // popup 连接测试
    else if (request.type === 'testConfig') {
      testConfig({ ...config })
        .then((r) => sendResponse(r))
        .catch((error) => sendResponse({ ok: false, message: error.message || String(error) }));
      return true;
    }
  });
});

async function storeUserInfo(requestUrl: string, apikey: string, model: string) {
  if (requestUrl != null && requestUrl !== '') await browser.storage.local.set({ requestUrl });
  if (apikey != null && apikey !== '') await browser.storage.local.set({ apikey });
  if (model != null && model !== '') await browser.storage.local.set({ model });
}

/** 连接测试：发一条最小请求验证 url/key/model 可用 */
async function testConfig(cfg: AiConfig): Promise<{ ok: boolean; message: string }> {
  try {
    if (!cfg.apikey) return { ok: false, message: 'API Key 为空' };
    if (!/^https?:\/\//.test(cfg.requestUrl)) return { ok: false, message: '接口地址必须以 http(s):// 开头' };
    const resp = await fetch(cfg.requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: normalizeAuthHeader(cfg.apikey),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: '回复OK' }],
        max_tokens: 20,
        thinking: { type: 'disabled' },
      }),
    });
    if (!resp.ok) {
      const t = (await resp.text()).slice(0, 200);
      return { ok: false, message: `HTTP ${resp.status}：${t}` };
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    return { ok: true, message: `连接成功，模型回复：${String(content).slice(0, 50)}` };
  } catch (e: any) {
    return { ok: false, message: e.message || String(e) };
  }
}

// ===================== 批量答题主流程 =====================

async function seedQuestions(cfg: AiConfig, questions: QuestionPayload[]): Promise<AnswerPayload[]> {
  if (!cfg.apikey) throw new Error('API Key 未配置，请先在「我的AI」页面填写并保存');
  if (!/^https?:\/\//.test(cfg.requestUrl)) throw new Error('接口地址必须以 http(s):// 开头');

  await writeLog({ time: Date.now(), running: true, total: questions.length, done: 0, items: [] });

  const answers: AnswerPayload[] = [];
  const logItems: AnswerLogItem[] = [];

  // 顺序请求，避免触发限流；每题完成即写日志，popup 可实时看到进度
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    let payload: AnswerPayload;
    try {
      const { answer, analysis } = await askOne(cfg, q);
      payload = { index: q.index, kind: q.kind, answer, analysis, status: 'answered' };
    } catch (e: any) {
      console.error(`【错误】第 ${q.index + 1} 题请求失败:`, e);
      payload = {
        index: q.index, kind: q.kind, answer: '', analysis: '',
        status: 'failed', error: e.message || String(e),
      };
    }
    answers.push(payload);
    logItems.push({
      index: q.index, kind: q.kind,
      title: (q.title || '').slice(0, 80),
      answer: payload.answer as string | string[], analysis: payload.analysis,
      status: payload.status, error: payload.error,
    });
    await writeLog({ done: i + 1, items: [...logItems] });
  }

  await writeLog({ running: false });
  return answers;
}
