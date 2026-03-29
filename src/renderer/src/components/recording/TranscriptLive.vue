<script setup>
import { ref, watch, nextTick, computed } from 'vue'

const props = defineProps({
  partialText: { type: String, default: '' },
  segments: { type: Array, default: () => [] },
  isRecording: Boolean
})

const containerRef = ref(null)

watch(
  () => [props.segments.length, props.partialText],
  async () => {
    await nextTick()
    if (containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    }
  }
)

function formatTime(ts) {
  if (!ts) return '--:--'
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDuration(ms) {
  if (!ms) return ''
  const s = Math.floor(ms / 1000)
  return s > 60 ? `${Math.floor(s / 60)}分${s % 60}秒` : `${s}秒`
}

const hasContent = computed(() => props.segments.length > 0 || props.partialText)
</script>

<template>
  <div class="bg-white rounded-3xl border border-stone-200/60 shadow-subtle overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 border-b border-stone-100">
      <h3 class="text-sm font-semibold text-stone-700">转录结果</h3>
      <div v-if="isRecording" class="flex items-center gap-1.5">
        <div class="bounce-dots flex gap-0.5">
          <span class="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
          <span class="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
          <span class="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
        </div>
        <span class="text-xs text-brand-500 font-medium">识别中</span>
      </div>
    </div>

    <!-- Content -->
    <div ref="containerRef" class="max-h-96 overflow-y-auto p-5 space-y-4">
      <!-- Empty State -->
      <div v-if="!hasContent" class="flex flex-col items-center justify-center py-12 text-stone-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-3 text-stone-300" viewBox="0 0 256 256" fill="currentColor">
          <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"/>
        </svg>
        <p class="text-sm">开始录音后，识别结果将在此显示</p>
      </div>

      <!-- Completed Segments -->
      <div
        v-for="seg in segments"
        :key="seg.id"
        class="group"
      >
        <div class="flex items-start gap-3">
          <!-- Timeline dot -->
          <div class="flex flex-col items-center pt-1.5">
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-50"></div>
            <div class="w-px flex-1 bg-stone-200 mt-1"></div>
          </div>

          <!-- Content -->
          <div class="flex-1 pb-4">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs text-stone-400 tabular-nums">{{ formatTime(seg.startTime) }}</span>
              <span class="text-[10px] text-stone-300">→</span>
              <span class="text-xs text-stone-400 tabular-nums">{{ formatTime(seg.endTime) }}</span>
              <span v-if="seg.duration" class="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                {{ formatDuration(seg.duration) }}
              </span>
            </div>
            <p class="text-sm text-stone-700 leading-relaxed">{{ seg.text }}</p>
            <div v-if="seg.filename" class="flex items-center gap-2 mt-1.5">
              <span class="text-[10px] text-stone-400">📄 {{ seg.filename }}</span>
              <span v-if="seg.summary" class="text-[10px] text-violet-500">{{ seg.summary }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Partial / Live Text -->
      <div v-if="partialText" class="flex items-start gap-3">
        <div class="flex flex-col items-center pt-1.5">
          <div class="w-2.5 h-2.5 rounded-full bg-brand-400 ring-4 ring-brand-50 animate-pulse"></div>
        </div>
        <div class="flex-1">
          <p class="text-sm text-stone-500 italic">{{ partialText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bounce-dots span {
  animation: bounce-dot 1.4s ease-in-out infinite;
}
.bounce-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.bounce-dots span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes bounce-dot {
  0%, 80%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
