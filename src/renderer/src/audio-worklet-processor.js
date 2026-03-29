/**
 * AudioWorklet processor for capturing raw PCM audio data.
 * Runs in a dedicated audio thread, sends audio chunks to the main thread
 * at regular intervals for speech recognition processing.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buffer = []
    this.bufferSize = 4096 // ~256ms at 16kHz
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || !input[0]) return true

    const channelData = input[0]
    this.buffer.push(...channelData)

    if (this.buffer.length >= this.bufferSize) {
      this.port.postMessage({
        type: 'audio',
        buffer: new Float32Array(this.buffer)
      })
      this.buffer = []
    }

    return true
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor)
