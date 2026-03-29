import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({
    outputDir: '',
    silenceThreshold: 0.01,
    silenceDuration: 2000,
    whisperModel: '',
    llmModel: '',
    language: 'auto',
    whisperDevice: 'cpu',
    whisperBinaryPath: '',
    whisperThreads: 0,
    whisperGpuLayers: 0
  })
  const loaded = ref(false)

  async function loadSettings() {
    try {
      const data = await window.api.getSettings()
      settings.value = { ...settings.value, ...data }
      loaded.value = true
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
  }

  async function saveSettings(updates) {
    const merged = { ...settings.value, ...updates }
    settings.value = merged
    await window.api.setSettings(merged)
  }

  async function selectOutputDir() {
    const dir = await window.api.selectDirectory()
    if (dir) {
      await saveSettings({ outputDir: dir })
    }
    return dir
  }

  async function selectWhisperBinary() {
    const filters = process.platform === 'win32'
      ? [{ name: '可执行文件', extensions: ['exe'] }]
      : [{ name: '可执行文件', extensions: ['*'] }]
    const file = await window.api.selectFile(filters)
    if (file) {
      await saveSettings({ whisperBinaryPath: file })
    }
    return file
  }

  return {
    settings,
    loaded,
    loadSettings,
    saveSettings,
    selectOutputDir,
    selectWhisperBinary
  }
})
