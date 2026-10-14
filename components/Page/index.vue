
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
          style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949"
      />

    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const value = ref(false)

watch(value, async(newVal) => {
  console.log(newVal)
  if (newVal === true) {
    // 开启插件助手
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && tab.id) {
      await chrome.tabs.sendMessage(tab.id, {type: 'permission', permission: 'allow'});
    }
  }
})
</script>

<style scoped>
.status-container {
  padding: 20px;
  min-height: 100%;
  box-sizing: border-box;
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
</style>