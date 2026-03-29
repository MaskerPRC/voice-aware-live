<script setup>
import { ref, onMounted, computed } from 'vue'

const transcripts = ref([])
const loading = ref(true)
const selectedId = ref(null)
const selectedContent = ref(null)
const searchQuery = ref('')

onMounted(async () => {
  await loadHistory()
})

async function loadHistory() {
  loading.value = true
  try {
    transcripts.value = await window.api.getHistory()
  } catch (err) {
    console.error('Failed to load history:', err)
  } finally {
    loading.value = false
  }
}

async function selectTranscript(id) {
  selectedId.value = id
  try {
    selectedContent.value = await window.api.getTranscript(id)
  } catch {
    selectedContent.value = null
  }
}

async function deleteTranscript(id) {
  await window.api.deleteTranscript(id)
  if (selectedId.value === id) {
    selectedId.value = null
    selectedContent.value = null
  }
  await loadHistory()
}

async function openFolder(id) {
  await window.api.openTranscriptFolder(id)
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(ms) {
  if (!ms) return '-'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}分${s % 60}秒` : `${s}秒`
}

const filteredTranscripts = computed(() => {
  if (!searchQuery.value) return transcripts.value
  const q = searchQuery.value.toLowerCase()
  return transcripts.value.filter(
    (t) =>
      (t.text && t.text.toLowerCase().includes(q)) ||
      (t.filename && t.filename.toLowerCase().includes(q)) ||
      (t.summary && t.summary.toLowerCase().includes(q))
  )
})

const groupedByDate = computed(() => {
  const groups = {}
  for (const t of filteredTranscripts.value) {
    const key = t.dateDir || 'unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  return groups
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-4 border-b border-stone-200/60 bg-white/40 backdrop-blur-xl">
      <div>
        <h1 class="text-xl font-serif font-semibold text-stone-800">历史记录</h1>
        <p class="text-sm text-stone-500 mt-0.5">浏览和管理所有转录文件</p>
      </div>
      <button
        class="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
        @click="loadHistory"
      >
        刷新
      </button>
    </header>

    <!-- Search -->
    <div class="px-6 py-3 border-b border-stone-100">
      <div class="relative">
        <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" viewBox="0 0 256 256" fill="currentColor">
          <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索转录内容..."
          class="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
        />
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- List -->
      <div class="w-80 flex-shrink-0 border-r border-stone-100 overflow-y-auto">
        <div v-if="loading" class="flex items-center justify-center h-40">
          <div class="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div v-else-if="filteredTranscripts.length === 0" class="flex flex-col items-center justify-center h-40 text-stone-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mb-2" viewBox="0 0 256 256" fill="currentColor">
            <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z"/>
          </svg>
          <p class="text-sm">暂无记录</p>
        </div>
        <template v-else>
          <div v-for="(items, date) in groupedByDate" :key="date">
            <div class="px-4 py-2 text-xs font-medium text-stone-400 bg-stone-50/50 sticky top-0">{{ date }}</div>
            <button
              v-for="t in items"
              :key="t.id"
              :class="[
                'w-full text-left px-4 py-3 border-b border-stone-100/60 hover:bg-stone-50 transition-colors',
                selectedId === t.id && 'bg-brand-50/50 border-l-2 border-l-brand-500'
              ]"
              @click="selectTranscript(t.id)"
            >
              <p class="text-sm font-medium text-stone-700 truncate">{{ t.filename }}</p>
              <p class="text-xs text-stone-500 mt-0.5 line-clamp-2">{{ t.summary || t.text }}</p>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="text-[10px] text-stone-400 tabular-nums">{{ formatDate(t.createdAt) }}</span>
                <span class="text-[10px] text-stone-300">·</span>
                <span class="text-[10px] text-stone-400">{{ formatDuration(t.duration) }}</span>
              </div>
            </button>
          </div>
        </template>
      </div>

      <!-- Detail -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="!selectedContent" class="flex flex-col items-center justify-center h-full text-stone-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mb-3 text-stone-300" viewBox="0 0 256 256" fill="currentColor">
            <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-32-80a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,136Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,168Z"/>
          </svg>
          <p class="text-sm">选择一条记录查看详情</p>
        </div>
        <template v-else>
          <!-- Detail Header -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-serif font-semibold text-stone-800">{{ selectedContent.filename }}</h2>
              <p v-if="selectedContent.summary" class="text-sm text-stone-500 mt-1">{{ selectedContent.summary }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
                @click="openFolder(selectedContent.id)"
              >
                打开文件夹
              </button>
              <button
                class="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                @click="deleteTranscript(selectedContent.id)"
              >
                删除
              </button>
            </div>
          </div>

          <!-- Metadata -->
          <div class="flex items-center gap-4 mb-4 text-xs text-stone-500">
            <span>时长: {{ formatDuration(selectedContent.duration) }}</span>
            <span>日期: {{ formatDate(selectedContent.createdAt) }}</span>
          </div>

          <!-- Content -->
          <div class="bg-white rounded-2xl border border-stone-200/60 shadow-subtle p-5">
            <pre class="whitespace-pre-wrap text-sm text-stone-700 leading-relaxed font-sans">{{ selectedContent.content }}</pre>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
