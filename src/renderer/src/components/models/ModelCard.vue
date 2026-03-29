<script setup>
import { computed } from 'vue'

const props = defineProps({
  model: { type: Object, required: true },
  progress: { type: Object, default: null }
})

const emit = defineEmits(['download', 'cancel', 'delete', 'select'])

const isDownloading = computed(() => !!props.progress)

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return ''
  if (bytesPerSec > 1024 * 1024) {
    return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`
  }
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

const statusColor = computed(() => {
  if (props.model.downloaded) return 'bg-emerald-100 text-emerald-700'
  if (isDownloading.value) return 'bg-amber-100 text-amber-700'
  return 'bg-stone-100 text-stone-500'
})

const statusLabel = computed(() => {
  if (props.model.downloaded) return '已下载'
  if (isDownloading.value) return '下载中'
  return '未下载'
})

const deviceBadge = computed(() => {
  if (props.model.type !== 'runtime') return null
  const map = {
    'cpu': { label: 'CPU', class: 'bg-blue-100 text-blue-700' },
    'gpu-cuda': { label: 'CUDA', class: 'bg-emerald-100 text-emerald-700' },
    'gpu-vulkan': { label: 'Vulkan', class: 'bg-violet-100 text-violet-700' }
  }
  return map[props.model.device] || null
})
</script>

<template>
  <div :class="['bg-white rounded-2xl border p-5 transition-all hover:shadow-float', model.selected ? 'border-brand-400 shadow-subtle ring-1 ring-brand-200' : 'border-stone-200/60 shadow-subtle']">
    <div class="flex items-start justify-between">
      <!-- Info -->
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <h3 class="text-sm font-semibold text-stone-800">{{ model.name }}</h3>
          <span :class="['text-[10px] font-medium px-2 py-0.5 rounded-full', statusColor]">
            {{ statusLabel }}
          </span>
          <span v-if="model.selected" class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
            当前使用
          </span>
          <span v-if="deviceBadge" :class="['text-[10px] font-medium px-2 py-0.5 rounded-full', deviceBadge.class]">
            {{ deviceBadge.label }}
          </span>
        </div>
        <p class="text-xs text-stone-500 mb-2">{{ model.description }}</p>
        <div class="flex items-center gap-3 text-[10px] text-stone-400">
          <span>大小: {{ model.size }}</span>
          <span v-if="model.downloaded && model.fileSize">
            实际: {{ formatBytes(model.fileSize) }}
          </span>
          <span class="uppercase text-stone-300">{{ model.type }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2 ml-4">
        <template v-if="model.downloaded">
          <button
            v-if="model.type !== 'runtime' && !model.selected"
            class="px-3 py-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-full transition-colors"
            @click="emit('select')"
          >
            使用
          </button>
          <button
            class="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
            @click="emit('delete')"
          >
            删除
          </button>
        </template>
        <template v-else-if="isDownloading">
          <button
            class="px-3 py-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-full transition-colors"
            @click="emit('cancel')"
          >
            取消
          </button>
        </template>
        <template v-else>
          <button
            class="px-4 py-1.5 text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full shadow-pill transition-all active:scale-95"
            @click="emit('download')"
          >
            下载
          </button>
        </template>
      </div>
    </div>

    <!-- Download Progress -->
    <div v-if="isDownloading" class="mt-4">
      <div class="flex items-center justify-between text-xs text-stone-500 mb-1.5">
        <span>{{ formatBytes(progress.downloaded) }} / {{ formatBytes(progress.total) }}</span>
        <div class="flex items-center gap-2">
          <span>{{ formatSpeed(progress.speed) }}</span>
          <span class="font-medium text-brand-600">{{ progress.percent?.toFixed(1) }}%</span>
        </div>
      </div>
      <div class="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-brand-400 to-brand-500 rounded-full transition-all duration-300"
          :style="{ width: `${progress.percent || 0}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>
