<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import ModelCard from '../components/models/ModelCard.vue'

const models = ref([])
const loading = ref(true)
const downloadProgress = ref({})
const activeTab = ref('whisper')

let cleanupProgress = null

onMounted(async () => {
  await loadModels()
  cleanupProgress = window.api.onModelDownloadProgress((data) => {
    downloadProgress.value = {
      ...downloadProgress.value,
      [data.modelId]: {
        percent: data.percent,
        downloaded: data.downloaded,
        total: data.total,
        speed: data.speed
      }
    }
  })
})

onUnmounted(() => {
  cleanupProgress?.()
})

async function loadModels() {
  loading.value = true
  try {
    models.value = await window.api.getModels()
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function downloadModel(modelId) {
  downloadProgress.value[modelId] = { percent: 0, downloaded: 0, total: 0, speed: 0 }
  try {
    await window.api.downloadModel(modelId)
  } catch {}
  delete downloadProgress.value[modelId]
  await loadModels()
}

async function cancelDownload(modelId) {
  await window.api.cancelDownload(modelId)
  delete downloadProgress.value[modelId]
  await loadModels()
}

async function deleteModel(modelId) {
  await window.api.deleteModel(modelId)
  await loadModels()
}

async function selectModel(modelId) {
  await window.api.selectModel(modelId)
  await loadModels()
}

const whisperModels = computed(() => models.value.filter((m) => m.type === 'whisper'))
const llmModels = computed(() => models.value.filter((m) => m.type === 'llm'))
const runtimeModels = computed(() => models.value.filter((m) => m.type === 'runtime'))

const tabs = computed(() => [
  { key: 'whisper', label: 'Whisper 语音模型', count: whisperModels.value.length },
  { key: 'runtime', label: '运行时 (GPU/CPU)', count: runtimeModels.value.length },
  { key: 'llm', label: 'LLM 总结模型', count: llmModels.value.length }
])

const currentModels = computed(() => {
  if (activeTab.value === 'whisper') return whisperModels.value
  if (activeTab.value === 'runtime') return runtimeModels.value
  return llmModels.value
})

const tipText = computed(() => {
  if (activeTab.value === 'whisper') {
    return 'Whisper 模型越大，识别质量越高，但速度越慢、占用内存越多。推荐中文场景使用 Medium 或以上模型。'
  }
  if (activeTab.value === 'runtime') {
    return '运行时来自 ggml-org/whisper.cpp 官方 Release（v1.8.4）。Windows：CPU 或 CUDA 11.8 / 12.4；官方已不再提供 Windows Vulkan 预编译包，界面里选「Vulkan」时会回退使用 CPU 版。macOS 从 XCFramework 中提取 main。Linux 请自行安装 whisper.cpp 后在设置中指定可执行文件路径。'
  }
  return 'LLM 模型用于自动总结转录内容并生成文件名。Qwen 3.5 0.8B 为超轻量，适合大多数设备；需要更好效果可选用 2B。'
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-4 border-b border-stone-200/60 bg-white/40 backdrop-blur-xl">
      <div>
        <h1 class="text-xl font-serif font-semibold text-stone-800">模型管理</h1>
        <p class="text-sm text-stone-500 mt-0.5">下载和管理 Whisper 模型、运行时与 LLM</p>
      </div>
      <button
        class="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
        @click="loadModels"
      >
        刷新
      </button>
    </header>

    <!-- Tabs -->
    <div class="px-6 pt-4 flex items-center gap-2 flex-wrap">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="[
          'px-4 py-2 text-sm font-medium rounded-full transition-all',
          activeTab === tab.key
            ? 'bg-brand-500 text-white shadow-pill'
            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
        ]"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span class="ml-1.5 text-xs opacity-80">({{ tab.count }})</span>
      </button>
    </div>

    <!-- Model List -->
    <div class="flex-1 overflow-y-auto px-6 py-4">
      <div v-if="loading" class="flex items-center justify-center h-40">
        <div class="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <template v-else>
        <!-- Runtime special header -->
        <div v-if="activeTab === 'runtime'" class="mb-4 flex items-center gap-3">
          <div class="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-violet-500" viewBox="0 0 256 256" fill="currentColor">
              <path d="M232,64V176a24,24,0,0,1-24,24H48a24,24,0,0,1-24-24V64A24,24,0,0,1,48,40H208A24,24,0,0,1,232,64Zm-24-8H48a8,8,0,0,0-8,8V176a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V64A8,8,0,0,0,208,56ZM160,216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Z"/>
            </svg>
            <span class="text-xs font-medium text-violet-700">whisper.cpp 可执行文件</span>
          </div>
          <span class="text-xs text-stone-400">根据你的显卡选择 GPU 或 CPU 版本</span>
        </div>

        <div class="grid gap-4">
          <ModelCard
            v-for="model in currentModels"
            :key="model.id"
            :model="model"
            :progress="downloadProgress[model.id]"
            @download="downloadModel(model.id)"
            @cancel="cancelDownload(model.id)"
            @delete="deleteModel(model.id)"
            @select="selectModel(model.id)"
          />
        </div>

        <!-- No items -->
        <div v-if="currentModels.length === 0 && !loading" class="flex flex-col items-center justify-center h-40 text-stone-400">
          <p class="text-sm">当前平台无可用项目</p>
        </div>
      </template>

      <!-- Info Note -->
      <div class="mt-6 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60">
        <p class="text-xs text-amber-700 leading-relaxed">
          <strong>提示：</strong> {{ tipText }}
        </p>
      </div>
    </div>
  </div>
</template>
