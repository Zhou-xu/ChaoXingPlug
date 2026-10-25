<template>
  <div class="answer-status">
    <!-- 汇总卡片 -->
    <div class="summary" v-if="log && log.total > 0">
      <div class="sum-item">
        <div class="sum-num">{{ log.done }}/{{ log.total }}</div>
        <div class="sum-label">已作答</div>
      </div>
      <div class="sum-item ok">
        <div class="sum-num">{{ successCount }}</div>
        <div class="sum-label">成功</div>
      </div>
      <div class="sum-item bad">
        <div class="sum-num">{{ failCount }}</div>
        <div class="sum-label">失败</div>
      </div>
    </div>

    <div class="running-banner" v-if="log?.running">
      <span class="spinner"></span> AI 正在作答中（{{ log.done }}/{{ log.total }}）…
    </div>

    <!-- 空状态 -->
    <div class="empty" v-if="!log || log.total === 0">
      <p>暂无答题记录</p>
      <p class="empty-tip">开启插件开关后，答题结果会实时显示在这里</p>
    </div>

    <!-- 题目列表 -->
    <el-collapse v-if="log && log.items.length" v-model="activeNames" class="list">
      <el-collapse-item
          v-for="item in log.items"
          :key="item.index"
          :name="item.index"
      >
        <template #title>
          <div class="item-title">
            <span class="q-no">{{ item.index + 1 }}.</span>
            <span class="q-kind">{{ kindLabel(item.kind) }}</span>
            <span class="q-text">{{ shortTitle(item.title) }}</span>
            <span class="q-state" :class="item.status">{{ item.status === 'answered' ? '✅' : '❌' }}</span>
          </div>
        </template>
        <div class="detail">
          <p class="d-title">{{ item.title || '（题干未抓取到）' }}</p>
          <p class="d-answer">
            答案：<b>{{ displayAnswer(item.answer) }}</b>
          </p>
          <p class="d-analysis" v-if="item.analysis">解析：{{ item.analysis }}</p>
          <p class="d-error" v-if="item.error">失败原因：{{ item.error }}</p>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface LogItem {
  index: number
  kind: string
  title: string
  answer: string | string[]
  analysis: string
  status: 'answered' | 'failed'
  error?: string
}

interface Log {
  time: number
  running: boolean
  total: number
  done: number
  items: LogItem[]
}

const log = ref<Log | null>(null)
const activeNames = ref<number[]>([])

const successCount = computed(() => log.value?.items.filter((i) => i.status === 'answered').length ?? 0)
const failCount = computed(() => log.value?.items.filter((i) => i.status === 'failed').length ?? 0)

async function read() {
  const result: any = await chrome.storage.local.get('answerLog')
  log.value = (result.answerLog as Log) || null
}

// 答题过程中 background 实时写入，这里监听变化刷新
const storageListener = (changes: any, area: string) => {
  if (area === 'local' && changes.answerLog) read()
}

onMounted(async () => {
  await read()
  chrome.storage.onChanged.addListener(storageListener)
})
onUnmounted(() => {
  chrome.storage.onChanged.removeListener(storageListener)
})

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    single: '单选', multiple: '多选', judge: '判断',
    completion: '填空', shortanswer: '简答', unknown: '未知',
  }
  return map[kind] || kind
}

function shortTitle(title: string): string {
  const t = (title || '').replace(/\s+/g, ' ')
  return t.length > 14 ? t.slice(0, 14) + '…' : t
}

function displayAnswer(answer: string | string[]): string {
  if (Array.isArray(answer)) return answer.join(' ｜ ')
  return String(answer)
}
</script>

<style scoped>
.answer-status {
  padding: 16px;
  text-align: left;
}

.summary {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.sum-item {
  flex: 1;
  background: #f5f7fa;
  border-radius: 10px;
  padding: 10px 0;
  text-align: center;
}

.sum-item.ok { background: #e8f8ed; }
.sum-item.bad { background: #fef0f0; }

.sum-num {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.sum-item.ok .sum-num { color: #13ce66; }
.sum-item.bad .sum-num { color: #f56c6c; }

.sum-label {
  font-size: 12px;
  color: #909399;
}

.running-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 12px;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #409eff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty {
  text-align: center;
  color: #909399;
  padding: 40px 0;
  font-size: 14px;
}

.empty-tip {
  font-size: 12px;
  margin-top: 6px;
}

.item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  overflow: hidden;
  font-size: 13px;
}

.q-no { color: #303133; flex-shrink: 0; }

.q-kind {
  flex-shrink: 0;
  font-size: 11px;
  color: #409eff;
  background: #ecf5ff;
  border-radius: 4px;
  padding: 1px 6px;
}

.q-text {
  flex: 1;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail p {
  margin: 4px 0;
  font-size: 12px;
  line-height: 1.6;
}

.d-title { color: #909399; }

.d-answer b { color: #409eff; }

.d-analysis { color: #606266; }

.d-error { color: #f56c6c; }
</style>
