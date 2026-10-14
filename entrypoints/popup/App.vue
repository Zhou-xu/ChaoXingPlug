
<template>
  <div class="app-container">
    <Select @clickToParent="handleClick" />
    
    <main class="content-area">
      <div v-if="page==='modifyUserInfo'">
        <modifyUserInfo />
      </div>

      <div v-if="page==='index'">
        <index />
      </div>

      <div v-if="page==='answerStatus'">
        <answerStatus />
      </div>
    </main>
  </div>
</template>

<script lang="ts" setup>
import Select from "@/components/select.vue";
import AnswerStatus from "@/components/Page/answerStatus.vue";
import Index from "@/components/Page/index.vue";
import ModifyUserInfo from "@/components/Page/modifyUserInfo.vue";
let page = ref('index')

  const handleClick = (key:any) => {
    page.value = key
  }
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

}

.content-area {
  flex: 1;
  padding-top: 44px; /* 留出导航栏的高度 */
  overflow-y: auto; /* 内容超出时可滚动 */
}
</style>