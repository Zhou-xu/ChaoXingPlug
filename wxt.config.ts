import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: '学习通 AI 答题助手',
    description: '基于 AI 大模型的学习通作业/考试自动答题插件（WXT + Vue3），支持单选、多选、判断、填空、简答题型',
    permissions: ['storage', 'tabs'],
    // chaoxing 页面注入 + 常见 AI 开放平台接口跨域放行（background 发请求需要）
    host_permissions: [
      '*://*.chaoxing.com/*',
      '*://*.volces.com/*',        // 火山方舟
      '*://open.bigmodel.cn/*',    // 智谱
      '*://api.deepseek.com/*',    // DeepSeek
      '*://api.openai.com/*',      // OpenAI
      '*://dashscope.aliyuncs.com/*', // 阿里通义
    ],
  },
  webExt: {
    binaries: {
      // 手动指定 Edge 路径
      edge: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    },
  },
});
