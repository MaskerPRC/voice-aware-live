<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  level: { type: Number, default: 0 },
  isRecording: Boolean
})

const canvasRef = ref(null)
const bars = ref(Array(32).fill(0))
let animId = null

function updateBars() {
  const newBars = [...bars.value]
  for (let i = 0; i < newBars.length; i++) {
    if (props.isRecording) {
      const targetHeight = props.level * (150 + Math.sin(Date.now() / 200 + i * 0.5) * 80)
      newBars[i] = newBars[i] + (targetHeight - newBars[i]) * 0.3
    } else {
      newBars[i] = newBars[i] * 0.9
    }
  }
  bars.value = newBars
  draw()
  animId = requestAnimationFrame(updateBars)
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  const barWidth = width / bars.value.length
  const gap = 2

  ctx.clearRect(0, 0, width, height)

  bars.value.forEach((barHeight, i) => {
    const h = Math.max(2, Math.min(barHeight, height * 0.8))
    const x = i * barWidth + gap / 2
    const y = (height - h) / 2
    const w = barWidth - gap

    const gradient = ctx.createLinearGradient(x, y, x, y + h)
    if (props.isRecording) {
      gradient.addColorStop(0, 'rgba(224, 93, 52, 0.9)')
      gradient.addColorStop(1, 'rgba(224, 93, 52, 0.4)')
    } else {
      gradient.addColorStop(0, 'rgba(168, 162, 158, 0.4)')
      gradient.addColorStop(1, 'rgba(168, 162, 158, 0.1)')
    }

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, 2)
    ctx.fill()
  })
}

onMounted(() => {
  const canvas = canvasRef.value
  if (canvas) {
    canvas.width = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = canvas.offsetHeight * window.devicePixelRatio
    const ctx = canvas.getContext('2d')
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
  }
  animId = requestAnimationFrame(updateBars)
})

onUnmounted(() => {
  if (animId) cancelAnimationFrame(animId)
})
</script>

<template>
  <div class="w-64 h-16 relative">
    <canvas
      ref="canvasRef"
      class="w-full h-full"
    ></canvas>
    <div v-if="!isRecording" class="absolute inset-0 flex items-center justify-center">
      <p class="text-xs text-stone-400">等待录音...</p>
    </div>
  </div>
</template>
