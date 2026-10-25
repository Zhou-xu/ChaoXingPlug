<template>
  <div class="status-container">
    <div class="status-item">
      <span class="status-label">插件助手状态</span>
      <span class="status-text" :class="{ 'active': value }">
        {{ value ? '已开启' : '已关闭' }}
      </span>

      <el-switch
          v-model="value"
          class="status-switch"
          style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4944"
      />
    </div>

    <div class="tip-card">
      <p class="tip-title">使用说明</p>
      <p class="tip-line">1. 在「我的AI」页面配置接口地址、API Key 和模型并保存</p>
      <p class="tip-line">2. 打开学习通的作业 / 考试页面（题目需已加载）</p>
      <p class="tip-line">3. 打开本插件开关，页面右下角会显示答题进度浮层</p>
      <p class="tip-line warn">⚠️ 请自行核对答案后再提交，仅供学习交流使用</p>
    </div>

    <div class="config-state" :class="configured ? 'ok' : 'bad'">
      {{ configured === null ? '正在读取配置…' : configured ? '✅ AI 配置已就绪' : '❌ 尚未配置 AI，请前往「我的AI」' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const value = ref(false)
const configured = ref<boolean | null>(null)

onMounted(async () => {
  // 恢复开关状态
  const stored = await chrome.storage.local.get('enabled')
  value.value = !!stored.enabled
  // 检查 AI 配置是否完整
  const cfg = await chrome.storage.local.get(['apikey', 'requestUrl'])
  configured.value = !!(cfg.apikey && cfg.requestUrl)
})

watch(value, async (newVal) => {
  // 持久化开关状态
  await chrome.storage.local.set({ enabled: newVal })

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab || !tab.id) return
  if (!tab.url || !/chaoxing\.com/.test(tab.url)) {
    ElMessage.warning('请先切换到学习通（chaoxing.com）的作业或考试页面再开启')
    return
  }
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'permission',
      permission: newVal ? 'allow' : 'deny',
    })
    if (newVal) ElMessage.success('已开始答题，进度见页面右下角浮层')
  } catch {
    if (newVal) ElMessage.error('页面未注入脚本，请刷新学习通页面后重试')
  }
})
</script>

<style scoped>
.status-container {
  padding: 20px;
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.status-label {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
  min-width: 100px;
}

.status-switch {
  flex-shrink: 0;
  margin-left: auto;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  color: #606266;
  padding: 4px 16px;
  border-radius: 20px;
  background: #f5f7fa;
  white-space: nowrap;
}

.status-text.active {
  color: #13ce66;
  background: #e8f8ed;
}

.tip-card {
  background: #f8f9fb;
  border-radius: 12px;
  padding: 14px 16px;
}

.tip-title {
  margin: 0 0 8px;
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.tip-line {
  margin: 4px 0;
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
  text-align: left;
}

.tip-line.warn {
  color: #e6a23c;
}

.config-state {
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
}

.config-state.ok {
  background: #e8f8ed;
  color: #13ce66;
}

.config-state.bad {
  background: #fef0f0;
  color: #f56c6c;
}
</style>
