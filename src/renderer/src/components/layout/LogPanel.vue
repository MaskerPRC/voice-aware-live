<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { useAppStore } from '../../stores/app'

const appStore = useAppStore()
const logsContainer = ref(null)
const isResizing = ref(false)

const levelColors = {
  info: 'text-emerald-600 bg-emerald-50',
  warn: 'text-amber-600 bg-amber-50',
  error: 'text-red-500 bg-red-50',
  debug: 'text-violet-500 bg-violet-50'
}

const levelLabels = {
  info: '信息',
  warn: '警告',
  error: '错误',
  debug: '调试'
}

watch(
  () => appStore.logs.length,
  async () => {
    await nextTick()
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  }
)

function formatTime(timestamp) {
  const d = new Date(timestamp)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function startResize(e) {
  isResizing.value = true
  const startX = e.clientX
  const startWidth = appStore.logPanelWidth

  const onMouseMove = (ev) => {
    const diff = startX - ev.clientX
    appStore.setLogPanelWidth(startWidth + diff)
  }

  const onMouseUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<template>
  <div
    class="flex flex-shrink-0 border-l border-stone-200/60 bg-white/60 backdrop-blur-xl"
    :style="{ width: appStore.logPanelWidth + 'px' }"
  >
    <!-- Resize Handle -->
    <div
      class="w-1 cursor-col-resize hover:bg-brand-300/30 transition-colors flex-shrink-0"
      :class="{ 'bg-brand-400/40': isResizing }"
      @mousedown="startResize"
    ></div>

    <!-- Panel Content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-stone-200/60">
        <h3 class="text-sm font-semibold text-stone-700">日志</h3>
        <div class="flex items-center gap-1">
          <button
            class="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            title="清空日志"
            @click="appStore.clearLogs()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 256 256" fill="currentColor">
              <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192Z"/>
            </svg>
          </button>
          <button
            class="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            title="关闭日志面板"
            @click="appStore.toggleLogPanel()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 256 256" fill="currentColor">
              <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Logs -->
      <div ref="logsContainer" class="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div v-if="appStore.logs.length === 0" class="flex items-center justify-center h-full">
          <p class="text-sm text-stone-400">暂无日志</p>
        </div>
        <div
          v-for="(log, index) in appStore.logs"
          :key="index"
          class="flex items-start gap-2 text-xs"
        >
          <span class="text-stone-400 flex-shrink-0 tabular-nums">
            {{ formatTime(log.timestamp) }}
          </span>
          <span
            :class="[
              'px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0',
              levelColors[log.level] || levelColors.info
            ]"
          >
            {{ levelLabels[log.level] || log.level }}
          </span>
          <span class="text-stone-600 break-all">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
