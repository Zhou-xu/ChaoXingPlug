<template>
  <el-input
      v-model="input"
      style="width: 240px"
      placeholder="Please input"
      @input="handleInput"
  />
</template>

<script setup>
import { ref } from 'vue'
const emit = defineEmits(['update-input'])
const input = ref('')

const handleInput = (val) => {
  emit('update-input', val)
}
</script>
