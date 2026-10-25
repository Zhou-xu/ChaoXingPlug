# 学习通 AI 答题助手（ChaoXingPlug）

基于 **WXT + Vue 3 + Element Plus** 开发的超星学习通浏览器扩展，调用大模型对作业/考试页面自动作答。

## ✨ 功能

- **全题型支持**：单选题、多选题、判断题、填空题、简答题
- **自动作答**：识别页面题目 → 调用 AI → 自动点击选项 / 填写答案
- **兼容 OpenAI 协议**：任何兼容 `chat/completions` 的服务均可使用（火山方舟、智谱、DeepSeek、OpenAI 等），模型名可配置
- **实时浮层**：答题过程中页面右下角显示进度与每题结果，支持一键重答
- **答题日志**：弹窗内「答题状态」页实时展示每题答案与解析
- **iframe 兼容**：学习通作业/考试页面嵌在 iframe 中，插件已开启全 frame 注入

## 🚀 安装与使用

### 开发模式

```bash
npm install
npm run dev        # 启动 WXT 开发模式（自动打开 Edge）
```

### 构建打包

```bash
npm run build      # 产物在 .output/chrome-edge-mv3
```

打开 Edge → `edge://extensions` → 开启「开发人员模式」→「加载解压缩的扩展」→ 选择 `.output/chrome-edge-mv3` 目录。

### 使用步骤

1. 点击插件图标，进入「**我的AI**」页面：
   - **AI 接口地址**：如 `https://ark.cn-beijing.volces.com/api/v3/chat/completions`
   - **API Key**：你的密钥（保存后自动附加 `Bearer` 前缀）
   - **模型名称**：如 `doubao-seed-2-1-lite-260915`
   - 点击「测试连接」验证可用后「保存配置」
2. 打开学习通作业或考试页面，等待题目加载完成
3. 在插件弹窗「插件状态」页打开开关，页面右下角出现进度浮层即开始自动作答
4. 在「答题状态」页查看每题的 AI 答案与解析，**核对无误后再手动提交**

## 📁 目录结构

```
entrypoints/
  background.ts   # 后台：AI 请求、答案 JSON 解析、答题日志
  content.ts      # 内容脚本：题目扫描、题型识别、自动作答、浮层 UI
  popup/          # 弹窗（Vue3 + Element Plus）
components/Page/  # 弹窗三个页面：插件状态 / 答题状态 / 我的AI
```

## 🔧 实现要点

- **消息协议**：content 扫描题目后以 `{index, kind, title, options[]}` 结构化发送给 background；background 逐题调用 AI 并返回 `{answer, analysis}`，按题型要求 AI 输出严格 JSON（容错解析）
- **题型识别**：依据学习通题目容器的 class（`singleQuesId` / `multipleQuesId` / `judgementNqueId` / `completionQuesId` / `shortanswerQuesId`），并按页面题型文字兜底
- **自动填写**：选择题点击选项行；判断题按"对/错"文字匹配；填空/简答兼容普通 `textarea`、UEditor iframe、`contenteditable`，使用原生 setter + 事件触发保证页面框架感知
- **限流保护**：逐题顺序请求，避免触发 AI 接口限流

## 🧪 测试

测试使用真实 AI 接口，需要先创建本地密钥配置（已被 `.gitignore` 忽略，**切勿提交**）：

```jsonc
// test/local.config.json
{
  "requestUrl": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  "apikey": "你的 API Key",
  "model": "doubao-seed-2-1-lite-260915"
}
```

```bash
# 端到端：jsdom 模拟学习通页面 + 真实 AI API，验证扫描/作答/解析全链路
npx tsx test/e2e.test.ts

# 真实浏览器：playwright 启动 Edge 加载扩展，走完整消息链路（需先把 content.ts
# 的 matches 临时加入 http://localhost:8899/* 并 npm run build）
npx tsx test/browser.test.ts
```

核心引擎位于 `lib/`（`answer-engine.ts` 答题 DOM 逻辑、`ai-protocol.ts` AI 请求协议），与扩展 API 解耦，可直接测试复用。

## ⚠️ 免责声明

本项目仅供学习交流与技术研究所用，使用者需对自身行为负责。请勿用于任何违反学校规定或法律法规的场景，因使用本插件产生的后果由使用者自行承担。
