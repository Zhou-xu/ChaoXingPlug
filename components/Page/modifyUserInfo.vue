<template>
  <div class="modify-user-info">
    <div class="form-group">
      <label class="form-label">AI 接口地址（Chat Completions）</label>
      <el-input
          v-model="url"
          placeholder="https://ark.cn-beijing.volces.com/api/v3/chat/completions"
          clearable
      />
    </div>

    <div class="form-group">
      <label class="form-label">API Key</label>
      <el-input
          v-model="apiKey"
          type="password"
          placeholder="粘贴你的 API Key（自动添加 Bearer 前缀）"
          show-password
      />
    </div>

    <div class="form-group">
      <label class="form-label">模型名称</label>
      <el-input
          v-model="model"
          placeholder="doubao-seed-2-1-lite-260915"
          clearable
      />
      <div class="preset-models">
        <span>常用：</span>
        <el-tag
            v-for="m in presetModels"
            :key="m"
            size="small"
            class="preset-tag"
            @click="model = m"
        >{{ m }}</el-tag>
      </div>
    </div>

    <div class="form-actions">
      <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
      <el-button :loading="testing" @click="test">测试连接</el-button>
    </div>

    <div class="form-tip">
      支持任何兼容 OpenAI Chat Completions 协议的服务（火山方舟 / 智谱 / DeepSeek / OpenAI 等）。
      配置将保存在本地浏览器中，仅用于向你所填写的接口发送答题请求。
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const url = ref('https://ark.cn-beijing.volces.com/api/v3/chat/completions')
const apiKey = ref('')
const model = ref('doubao-seed-2-1-lite-260915')
const saving = ref(false)
const testing = ref(false)

const presetModels = [
  'doubao-seed-2-1-lite-260915',
  'doubao-seed-1-6-lite-250615',
  'glm-4.7',
  'deepseek-v3.2',
]

onMounted(async () => {
  // 回显已保存配置
  const result: any = await chrome.storage.local.get(['requestUrl', 'apikey', 'model'])
  if (result.requestUrl) url.value = result.requestUrl
  if (result.apikey) apiKey.value = result.apikey
  if (result.model) model.value = result.model
})

async function save() {
  if (!/^https?:\/\//.test(url.value.trim())) {
    ElMessage.error('接口地址必须以 http:// 或 https:// 开头')
    return
  }
  if (!apiKey.value.trim()) {
    ElMessage.error('API Key 不能为空')
    return
  }
  if (!model.value.trim()) {
    ElMessage.error('模型名称不能为空')
    return
  }

  saving.value = true
  try {
    const resp: any = await chrome.runtime.sendMessage({
      type: 'userInfo',
      url: url.value.trim(),
      apiKey: apiKey.value.trim(),
      model: model.value.trim(),
    })
    if (resp?.status === 'success') ElMessage.success('配置已保存')
    else ElMessage.error('保存失败：' + (resp?.message || '未知错误'))
  } catch (e: any) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

async function test() {
  if (!/^https?:\/\//.test(url.value.trim()) || !apiKey.value.trim() || !model.value.trim()) {
    ElMessage.warning('请先完整填写地址、API Key 和模型')
    return
  }
  testing.value = true
  try {
    // 先保存再测试，保证测试的是当前表单的值
    await chrome.runtime.sendMessage({
      type: 'userInfo',
      url: url.value.trim(),
      apiKey: apiKey.value.trim(),
      model: model.value.trim(),
    })
    const resp: any = await chrome.runtime.sendMessage({ type: 'testConfig' })
    if (resp?.ok) ElMessage.success(resp.message)
    else ElMessage.error(resp?.message || '测试失败')
  } catch (e: any) {
    ElMessage.error('测试失败：' + e.message)
  } finally {
    testing.value = false
  }
}
</script>

<style scoped>
.modify-user-info {
  padding: 20px 16px;
  text-align: left;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 6px;
}

.preset-models {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.preset-tag {
  cursor: pointer;
}

.form-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.form-actions :deep(.el-button) {
  margin: 0;
}

.form-tip {
  margin-top: 16px;
  font-size: 11px;
  color: #909399;
  line-height: 1.6;
  background: #f8f9fb;
  border-radius: 8px;
  padding: 8px 10px;
}
</style>
