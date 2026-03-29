import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const logs = ref([])
  const sidebarCollapsed = ref(false)
  const logPanelWidth = ref(320)
  const logPanelVisible = ref(true)

  let cleanupLog = null

  function initLogListener() {
    if (cleanupLog) cleanupLog()
    cleanupLog = window.api.onLog((msg) => {
      logs.value.push(msg)
      if (logs.value.length > 500) {
        logs.value = logs.value.slice(-300)
      }
    })
  }

  function clearLogs() {
    logs.value = []
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function toggleLogPanel() {
    logPanelVisible.value = !logPanelVisible.value
  }

  function setLogPanelWidth(width) {
    logPanelWidth.value = Math.max(240, Math.min(600, width))
  }

  return {
    logs,
    sidebarCollapsed,
    logPanelWidth,
    logPanelVisible,
    initLogListener,
    clearLogs,
    toggleSidebar,
    toggleLogPanel,
    setLogPanelWidth
  }
})
