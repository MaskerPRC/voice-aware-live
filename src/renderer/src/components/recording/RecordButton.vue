<script setup>
defineProps({
  isRecording: Boolean
})
defineEmits(['click'])
</script>

<template>
  <button
    :class="[
      'relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95',
      isRecording
        ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/25'
        : 'bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/25'
    ]"
    @click="$emit('click')"
  >
    <!-- Pulse rings when recording -->
    <div v-if="isRecording" class="absolute inset-0 rounded-full">
      <div class="absolute inset-0 rounded-full bg-red-400/30 animate-ping"></div>
      <div class="absolute -inset-2 rounded-full bg-red-400/10 animate-pulse"></div>
    </div>

    <!-- Icon -->
    <div class="relative z-10">
      <svg v-if="!isRecording" xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" viewBox="0 0 256 256" fill="currentColor">
        <path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V232a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"/>
      </svg>
      <div v-else class="w-6 h-6 bg-white rounded-md"></div>
    </div>
  </button>

  <!-- Label -->
  <p class="mt-3 text-sm font-medium" :class="isRecording ? 'text-red-500' : 'text-stone-500'">
    {{ isRecording ? '点击停止' : '点击开始录音' }}
  </p>
</template>
