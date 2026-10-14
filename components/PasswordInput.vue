<template>
  <div class="input-group">
    <el-input
        v-model="input"
        style="width: 240px"
        type="password"
        placeholder="Please input apikey"
        show-password
        @input="handleInput"
    />

  </div>
</template>

<script setup>
import { ref } from 'vue'
const emit = defineEmits(['update-input'])

const input = ref('')
const handleInput = () => {
  emit('update-input', input.value)
}
</script>

<style scoped>
.input-group {
  display: flex;
  align-items: center;
  gap: 1em;
}
</style>
