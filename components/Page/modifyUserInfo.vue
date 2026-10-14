
<template>
  <div class="modify-user-info">
    <div class="form-group">
      <label class="form-label">AI 模型地址</label>
      <Input @update-input="getUrl" />
    </div>

    <div class="form-group">
      <label class="form-label">API Key</label>
      <PasswordInput @update-input="getApiKey" />
    </div>

    <div class="form-actions">
      <Button text="提交并保存" @clickToParent="sendMes" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import PasswordInput from '../PasswordInput.vue'
import Input from '../Input.vue'
import Button from '../Button.vue'
import {ElMessage} from "element-plus";

let url = ''
let apiKey = ''
const getApiKey = (val: string) => {
  apiKey = val
}
const getUrl = (val: string) => {
  url = val
}

const sendMes = () => {
  if(url.length===null) {
    ElMessage.error('请输入正确的url和api key')
    return
  }
  chrome.runtime.sendMessage({type : "userInfo",url: url, apiKey: apiKey}).then(
      response => console.log(response)
  )
  ElMessage.success('提交成功')
}
</script>

<style scoped>
.modify-user-info {
  padding: 24px;
  min-width: 80%;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 8px;
  text-align: left;
}

.form-actions {
  margin-top: 28px;
  text-align: center;
}

.form-actions :deep(.el-button) {
  width: 100%;
  max-width: 100px;
}

</style>
