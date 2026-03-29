<script setup>
import { ref, onMounted, computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settingsStore = useSettingsStore()
const saving = ref(false)
const saveSuccess = ref(false)

onMounted(async () => {
  await settingsStore.loadSettings()
})

async function handleSelectDir() {
  await settingsStore.selectOutputDir()
}

async function handleSelectBinary() {
  await settingsStore.selectWhisperBinary()
}

function clearBinaryPath() {
  settingsStore.settings.whisperBinaryPath = ''
}

let saveTimeout = null
async function handleSave() {
  saving.value = true
  try {
    await settingsStore.saveSettings(settingsStore.settings)
    saveSuccess.value = true
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => { saveSuccess.value = false }, 2000)
  } finally {
    saving.value = false
  }
}

const languages = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' }
]

const deviceOptions = [
  { value: 'cpu', label: 'CPU', description: '使用处理器推理，兼容性最好' },
  { value: 'gpu-cuda', label: 'GPU (CUDA)', description: 'NVIDIA 显卡加速，速度最快' },
  { value: 'gpu-vulkan', label: 'GPU (Vulkan)', description: 'AMD/NVIDIA/Intel 显卡通用加速' }
]

const currentDeviceInfo = computed(() => {
  return deviceOptions.find((d) => d.value === settingsStore.settings.whisperDevice) || deviceOptions[0]
})

const isGpuMode = computed(() => settingsStore.settings.whisperDevice !== 'cpu')
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between px-6 py-4 border-b border-stone-200/60 bg-white/40 backdrop-blur-xl">
      <div>
        <h1 class="text-xl font-serif font-semibold text-stone-800">设置</h1>
        <p class="text-sm text-stone-500 mt-0.5">配置应用参数和偏好</p>
      </div>
      <div class="flex items-center gap-2">
        <transition name="fade">
          <span v-if="saveSuccess" class="text-sm text-emerald-600 font-medium">已保存 ✓</span>
        </transition>
        <button
          class="px-5 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-full shadow-pill transition-all active:scale-95"
          :disabled="saving"
          @click="handleSave"
        >
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>
    </header>

    <!-- Settings Form -->
    <div class="flex-1 overflow-y-auto px-6 py-6 max-w-2xl">

      <!-- ===== Whisper 推理设备 ===== -->
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-stone-700 mb-3">Whisper 推理设备</h2>
        <div class="bg-white rounded-2xl border border-stone-200/60 shadow-subtle p-5 space-y-5">

          <!-- Device Selection -->
          <div>
            <label class="block text-sm text-stone-600 mb-2.5">计算设备</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="opt in deviceOptions"
                :key="opt.value"
                :class="[
                  'relative flex flex-col items-center p-3 rounded-xl border-2 transition-all text-center',
                  settingsStore.settings.whisperDevice === opt.value
                    ? 'border-brand-500 bg-brand-50/60 shadow-subtle'
                    : 'border-stone-200 hover:border-stone-300 bg-stone-50/40'
                ]"
                @click="settingsStore.settings.whisperDevice = opt.value"
              >
                <!-- Icons -->
                <div class="w-8 h-8 mb-1.5 flex items-center justify-center">
                  <svg v-if="opt.value === 'cpu'" xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" :class="settingsStore.settings.whisperDevice === opt.value ? 'text-brand-600' : 'text-stone-400'" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M152,96H104a8,8,0,0,0-8,8v48a8,8,0,0,0,8,8h48a8,8,0,0,0,8-8V104A8,8,0,0,0,152,96Zm-8,48H112V112h32ZM56,96H40a8,8,0,0,0,0,16H56a8,8,0,0,0,0-16Zm0,48H40a8,8,0,0,0,0,16H56a8,8,0,0,0,0-16ZM216,96H200a8,8,0,0,0,0,16h16a8,8,0,0,0,0-16Zm0,48H200a8,8,0,0,0,0,16h16a8,8,0,0,0,0-16Zm-80,56V216a8,8,0,0,1-16,0V200a8,8,0,0,1,16,0Zm-32,0V216a8,8,0,0,1-16,0V200a8,8,0,0,1,16,0ZM168,200V216a8,8,0,0,1-16,0V200a8,8,0,0,1,16,0ZM120,56V40a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0ZM88,56V40a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0ZM152,56V40a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm48,24V176a16,16,0,0,1-16,16H72a16,16,0,0,1-16-16V80A16,16,0,0,1,72,64H184A16,16,0,0,1,200,80Zm-16,0H72v96H184Z"/>
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" :class="settingsStore.settings.whisperDevice === opt.value ? 'text-brand-600' : 'text-stone-400'" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M232,64V176a24,24,0,0,1-24,24H48a24,24,0,0,1-24-24V64A24,24,0,0,1,48,40H208A24,24,0,0,1,232,64Zm-24-8H48a8,8,0,0,0-8,8V176a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V64A8,8,0,0,0,208,56ZM160,216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Z"/>
                  </svg>
                </div>
                <span class="text-xs font-semibold" :class="settingsStore.settings.whisperDevice === opt.value ? 'text-brand-700' : 'text-stone-700'">
                  {{ opt.label }}
                </span>
                <span class="text-[10px] mt-0.5" :class="settingsStore.settings.whisperDevice === opt.value ? 'text-brand-500' : 'text-stone-400'">
                  {{ opt.description }}
                </span>
                <!-- Checkmark -->
                <div
                  v-if="settingsStore.settings.whisperDevice === opt.value"
                  class="absolute top-1.5 right-1.5 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-white" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"/>
                  </svg>
                </div>
              </button>
            </div>
            <p class="text-xs text-stone-400 mt-2">
              选择计算设备后，需要在"模型管理 → 运行时"下载对应的 whisper.cpp 二进制文件
            </p>
          </div>

          <!-- GPU Layers (only visible in GPU mode) -->
          <div v-if="isGpuMode">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm text-stone-600">GPU 层数</label>
              <span class="text-sm font-medium text-stone-800 tabular-nums">
                {{ settingsStore.settings.whisperGpuLayers || '全部' }}
              </span>
            </div>
            <input
              v-model.number="settingsStore.settings.whisperGpuLayers"
              type="range"
              min="0"
              max="64"
              step="1"
              class="w-full h-2 bg-stone-200 rounded-full appearance-none accent-brand-500"
            />
            <div class="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>0（全部卸载到 GPU）</span>
              <span>64</span>
            </div>
            <p class="text-xs text-stone-400 mt-1">设为 0 表示让 whisper.cpp 自动决定层数</p>
          </div>

          <!-- Thread Count -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm text-stone-600">CPU 线程数</label>
              <span class="text-sm font-medium text-stone-800 tabular-nums">
                {{ settingsStore.settings.whisperThreads || '自动' }}
              </span>
            </div>
            <input
              v-model.number="settingsStore.settings.whisperThreads"
              type="range"
              min="0"
              max="32"
              step="1"
              class="w-full h-2 bg-stone-200 rounded-full appearance-none accent-brand-500"
            />
            <div class="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>0（自动，CPU 核数 / 2）</span>
              <span>32</span>
            </div>
          </div>

          <!-- Custom Binary Path -->
          <div>
            <label class="block text-sm text-stone-600 mb-1.5">自定义 whisper.cpp 路径（可选）</label>
            <div class="flex gap-2">
              <input
                v-model="settingsStore.settings.whisperBinaryPath"
                type="text"
                readonly
                class="flex-1 px-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-700 cursor-default"
                placeholder="使用自动下载的二进制文件..."
              />
              <button
                class="px-3 py-2.5 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition-colors"
                @click="handleSelectBinary"
              >
                浏览
              </button>
              <button
                v-if="settingsStore.settings.whisperBinaryPath"
                class="px-3 py-2.5 text-sm font-medium text-stone-500 hover:text-red-500 bg-stone-50 hover:bg-red-50 border border-stone-200 rounded-xl transition-colors"
                @click="clearBinaryPath"
              >
                清除
              </button>
            </div>
            <p class="text-xs text-stone-400 mt-1.5">留空则使用从"模型管理"下载的运行时。如果你自己编译了 whisper.cpp，可以在此指定路径</p>
          </div>
        </div>
      </section>

      <!-- Output Directory -->
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-stone-700 mb-3">文件保存</h2>
        <div class="bg-white rounded-2xl border border-stone-200/60 shadow-subtle p-5 space-y-4">
          <div>
            <label class="block text-sm text-stone-600 mb-1.5">保存目录</label>
            <div class="flex gap-2">
              <input
                v-model="settingsStore.settings.outputDir"
                type="text"
                readonly
                class="flex-1 px-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-700 cursor-default"
                placeholder="选择保存目录..."
              />
              <button
                class="px-4 py-2.5 text-sm font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition-colors"
                @click="handleSelectDir"
              >
                浏览
              </button>
            </div>
            <p class="text-xs text-stone-400 mt-1.5">转录文本文件将按日期自动归类到此目录下</p>
          </div>
        </div>
      </section>

      <!-- Language -->
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-stone-700 mb-3">语言识别</h2>
        <div class="bg-white rounded-2xl border border-stone-200/60 shadow-subtle p-5">
          <label class="block text-sm text-stone-600 mb-1.5">识别语言</label>
          <select
            v-model="settingsStore.settings.language"
            class="w-full px-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
          >
            <option v-for="lang in languages" :key="lang.value" :value="lang.value">
              {{ lang.label }}
            </option>
          </select>
          <p class="text-xs text-stone-400 mt-1.5">选择"自动检测"可让 Whisper 自动识别语言</p>
        </div>
      </section>

      <!-- Voice Activity Detection -->
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-stone-700 mb-3">语音检测</h2>
        <div class="bg-white rounded-2xl border border-stone-200/60 shadow-subtle p-5 space-y-5">
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm text-stone-600">静音阈值</label>
              <span class="text-sm font-medium text-stone-800 tabular-nums">{{ settingsStore.settings.silenceThreshold }}</span>
            </div>
            <input
              v-model.number="settingsStore.settings.silenceThreshold"
              type="range"
              min="0.001"
              max="0.1"
              step="0.001"
              class="w-full h-2 bg-stone-200 rounded-full appearance-none accent-brand-500"
            />
            <div class="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>灵敏</span>
              <span>迟钝</span>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm text-stone-600">静音持续时间（毫秒）</label>
              <span class="text-sm font-medium text-stone-800 tabular-nums">{{ settingsStore.settings.silenceDuration }} ms</span>
            </div>
            <input
              v-model.number="settingsStore.settings.silenceDuration"
              type="range"
              min="500"
              max="10000"
              step="100"
              class="w-full h-2 bg-stone-200 rounded-full appearance-none accent-brand-500"
            />
            <div class="flex justify-between text-[10px] text-stone-400 mt-1">
              <span>0.5s（快速分段）</span>
              <span>10s（长静音容忍）</span>
            </div>
            <p class="text-xs text-stone-400 mt-2">当检测到持续静音超过此时间，将自动断句并保存为新文件</p>
          </div>
        </div>
      </section>

      <!-- About -->
      <section class="mb-8">
        <h2 class="text-sm font-semibold text-stone-700 mb-3">关于</h2>
        <div class="bg-white rounded-2xl border border-stone-200/60 shadow-subtle p-5">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 rounded-2xl bg-brand-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-white" viewBox="0 0 256 256" fill="currentColor">
                <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"/>
              </svg>
            </div>
            <div>
              <h3 class="font-semibold text-stone-800">ASR Live</h3>
              <p class="text-xs text-stone-500">v1.0.0 · 实时语音转文字</p>
            </div>
          </div>
          <p class="text-xs text-stone-500 leading-relaxed">
            基于 Whisper + 本地大模型的实时语音转录工具。使用 whisper.cpp 进行语音识别，
            Qwen 3.5 进行内容总结和文件命名。所有数据均在本地处理，不上传任何信息。
          </p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
