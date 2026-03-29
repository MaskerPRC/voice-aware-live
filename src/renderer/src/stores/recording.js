import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useRecordingStore = defineStore('recording', () => {
  const isRecording = ref(false)
  const isPaused = ref(false)
  const audioLevel = ref(0)
  const partialText = ref('')
  const segments = ref([])
  const recordingStartTime = ref(null)
  const elapsed = ref(0)

  let audioContext = null
  let mediaStream = null
  let workletNode = null
  let elapsedTimer = null
  let cleanupPartial = null
  let cleanupSegment = null
  let cleanupLevel = null

  const elapsedFormatted = computed(() => {
    const s = Math.floor(elapsed.value / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const ss = String(s % 60).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    const hh = String(h).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  })

  function setupListeners() {
    cleanupPartial = window.api.onTranscriptionPartial((data) => {
      partialText.value = data.text || ''
    })

    cleanupSegment = window.api.onTranscriptionSegment((data) => {
      segments.value.push({
        id: Date.now(),
        text: data.text,
        summary: data.summary || '',
        filename: data.filename,
        startTime: data.segmentInfo?.startTime,
        endTime: data.segmentInfo?.endTime,
        duration: data.segmentInfo?.duration,
        segments: data.segments || [],
        timestamp: Date.now()
      })
      partialText.value = ''
    })

    cleanupLevel = window.api.onAudioLevel((level) => {
      audioLevel.value = level
    })
  }

  async function startRecording() {
    try {
      setupListeners()

      audioContext = new AudioContext({ sampleRate: 16000 })
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      await audioContext.audioWorklet.addModule(new URL('../audio-worklet-processor.js', import.meta.url).href)
      const source = audioContext.createMediaStreamSource(mediaStream)
      workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor')

      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio') {
          window.api.sendAudioData(Array.from(event.data.buffer))
        }
      }

      source.connect(workletNode)
      workletNode.connect(audioContext.destination)

      await window.api.startRecording()

      isRecording.value = true
      recordingStartTime.value = Date.now()
      elapsed.value = 0

      elapsedTimer = setInterval(() => {
        elapsed.value = Date.now() - recordingStartTime.value
      }, 100)
    } catch (err) {
      console.error('Failed to start recording:', err)
      throw err
    }
  }

  async function stopRecording() {
    try {
      await window.api.stopRecording()
    } catch {}

    if (elapsedTimer) {
      clearInterval(elapsedTimer)
      elapsedTimer = null
    }

    if (workletNode) {
      workletNode.disconnect()
      workletNode = null
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop())
      mediaStream = null
    }

    if (audioContext) {
      await audioContext.close()
      audioContext = null
    }

    isRecording.value = false
    isPaused.value = false
    audioLevel.value = 0
    partialText.value = ''

    cleanupPartial?.()
    cleanupSegment?.()
    cleanupLevel?.()
  }

  function clearSegments() {
    segments.value = []
  }

  return {
    isRecording,
    isPaused,
    audioLevel,
    partialText,
    segments,
    recordingStartTime,
    elapsed,
    elapsedFormatted,
    startRecording,
    stopRecording,
    clearSegments
  }
})
