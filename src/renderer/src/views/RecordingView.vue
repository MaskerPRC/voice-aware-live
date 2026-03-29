<script setup>
import { ref, computed } from 'vue'
import { useRecordingStore } from '../stores/recording'
import { useAppStore } from '../stores/app'
import RecordButton from '../components/recording/RecordButton.vue'
import TranscriptLive from '../components/recording/TranscriptLive.vue'
import AudioVisualizer from '../components/recording/AudioVisualizer.vue'

const recordingStore = useRecordingStore()
const appStore = useAppStore()
const showError = ref('')

async function toggleRecording() {
  try {
    showError.value = ''
    if (recordingStore.isRecording) {
      await recordingStore.stopRecording()
    } else {
      await recordingStore.startRecording()
    }
  } catch (err) {
    showError.value = err.message || '操作失败'
    setTimeout(() => { showError.value = '' }, 5000)
  }
}

const segmentCount = computed(() => recordingStore.segments.length)
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-4 border-b border-stone-200/60 bg-white/40 backdrop-blur-xl">
      <div>
        <h1 class="text-xl font-serif font-semibold text-stone-800">实时录音</h1>
        <p class="text-sm text-stone-500 mt-0.5">开始录音，语音将自动转换为文字</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-if="!appStore.logPanelVisible"
          class="px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
          @click="appStore.toggleLogPanel()"
        >
          显示日志
        </button>
        <div v-if="recordingStore.isRecording" class="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full">
          <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span class="text-sm font-medium text-red-600 tabular-nums">{{ recordingStore.elapsedFormatted }}</span>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto px-6 py-6">
      <!-- Error Alert -->
      <div v-if="showError" class="mb-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-600 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 flex-shrink-0" viewBox="0 0 256 256" fill="currentColor">
          <path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z"/>
        </svg>
        <span>{{ showError }}</span>
      </div>

      <!-- Record Control Center -->
      <div class="flex flex-col items-center mb-8">
        <!-- Audio Visualizer -->
        <AudioVisualizer
          :level="recordingStore.audioLevel"
          :is-recording="recordingStore.isRecording"
          class="mb-6"
        />

        <!-- Record Button -->
        <RecordButton
          :is-recording="recordingStore.isRecording"
          @click="toggleRecording"
        />

        <!-- Stats -->
        <div class="flex items-center gap-6 mt-4">
          <div class="text-center">
            <p class="text-2xl font-semibold text-stone-800 tabular-nums">{{ segmentCount }}</p>
            <p class="text-xs text-stone-500 mt-0.5">已识别片段</p>
          </div>
        </div>
      </div>

      <!-- Live Transcript -->
      <TranscriptLive
        :partial-text="recordingStore.partialText"
        :segments="recordingStore.segments"
        :is-recording="recordingStore.isRecording"
      />
    </div>
  </div>
</template>
