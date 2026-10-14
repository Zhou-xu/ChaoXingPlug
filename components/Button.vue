<template>
  <div class="button-example">
    <div class="button-row">
      <el-button type="primary" round @click="handleClick">{{ text }}</el-button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  text: {
    type: String,
    default: '默认按钮' // 不传值时显示默认文本
  }
})
const emit = defineEmits(['clickToParent'])
const handleClick = () => {
  emit('clickToParent')
}
</script>

<style scoped>
.button-example {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.button-row > * {
  margin: 0;
}
</style>
