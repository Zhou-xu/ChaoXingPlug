<template>
  <!-- 顶部水平导航栏 -->
  <div class="nav-bar">
    <el-button
        v-for="item in navList"
        :key="item.key"
        :type="current === item.key ? 'primary' : ''"
        @click="handleClick(item.key)"
        class="nav-btn"
    >
      {{ item.name }}
    </el-button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['clickToParent'])
// 导航配置，key 就是你要控制的值
const navList = [
  { name: '插件状态', key: 'index' },
  { name: '答题状态', key: 'answerStatus' },
  { name: '我的AI', key: 'modifyUserInfo' }
]
// 响应式变量，点击导航按钮时修改它的值
const current = ref('index')

// 点击导航按钮时触发的函数

const handleClick = (key) => {
  current.value = key
  emit('clickToParent', key)
}


</script>

<style scoped>
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  box-sizing: border-box;
  z-index: 100;
}
.nav-btn {
  padding: 4px 12px;
}
</style>