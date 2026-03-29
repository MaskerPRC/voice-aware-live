<script setup>
import { onMounted } from 'vue'
import { useAppStore } from './stores/app'
import { useSettingsStore } from './stores/settings'
import AppSidebar from './components/layout/AppSidebar.vue'
import LogPanel from './components/layout/LogPanel.vue'

const appStore = useAppStore()
const settingsStore = useSettingsStore()

onMounted(() => {
  appStore.initLogListener()
  settingsStore.loadSettings()
})
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-surface">
    <!-- Title Bar (draggable area for frameless window) -->
    <div class="title-bar h-9 flex items-center px-4 select-none bg-white/80 backdrop-blur-xl border-b border-stone-200/60" style="-webkit-app-region: drag">
      <div class="flex items-center gap-2" style="-webkit-app-region: no-drag">
        <div class="w-3 h-3 rounded-full bg-brand-500"></div>
        <span class="text-sm font-semibold text-stone-700 tracking-tight">ASR Live</span>
      </div>
    </div>

    <!-- Main Layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <AppSidebar />

      <!-- Main Content -->
      <main class="flex-1 overflow-hidden">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- Log Panel -->
      <LogPanel v-if="appStore.logPanelVisible" />
    </div>
  </div>
</template>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
