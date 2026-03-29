export class AudioProcessor {
  constructor({ onSegmentReady, onPartialAudio, onAudioLevel, sendLog }) {
    this.onSegmentReady = onSegmentReady
    this.onPartialAudio = onPartialAudio
    this.onAudioLevel = onAudioLevel
    this.sendLog = sendLog

    this.running = false
    this.sampleRate = 16000
    this.silenceThreshold = 0.01
    this.silenceDuration = 2000 // ms
    this.partialInterval = 5000 // send partial results every 5s

    this.audioBuffer = []
    this.currentSegmentStart = null
    this.lastSpeechTime = null
    this.silenceStartTime = null
    this.lastPartialTime = null
    this.isSpeaking = false
    this.segmentStartTimestamp = null
  }

  configure({ silenceThreshold, silenceDuration, sampleRate }) {
    if (silenceThreshold !== undefined) this.silenceThreshold = silenceThreshold
    if (silenceDuration !== undefined) this.silenceDuration = silenceDuration
    if (sampleRate !== undefined) this.sampleRate = sampleRate
  }

  start() {
    this.running = true
    this.audioBuffer = []
    this.currentSegmentStart = Date.now()
    this.lastSpeechTime = null
    this.silenceStartTime = null
    this.lastPartialTime = Date.now()
    this.isSpeaking = false
    this.segmentStartTimestamp = Date.now()
  }

  stop() {
    this.running = false
    if (this.audioBuffer.length > 0) {
      const buffer = this._mergeBuffers(this.audioBuffer)
      const info = {
        startTime: this.segmentStartTimestamp || Date.now(),
        endTime: Date.now(),
        duration: Date.now() - (this.segmentStartTimestamp || Date.now())
      }
      this.audioBuffer = []
      return { buffer, info }
    }
    return null
  }

  processAudioData(data) {
    if (!this.running) return

    // data is an ArrayBuffer or array of float32 values
    const float32 = data instanceof Float32Array ? data : new Float32Array(data)

    // Calculate RMS level
    let sumSquares = 0
    for (let i = 0; i < float32.length; i++) {
      sumSquares += float32[i] * float32[i]
    }
    const rms = Math.sqrt(sumSquares / float32.length)
    this.onAudioLevel?.(rms)

    const now = Date.now()
    const hasSpeech = rms > this.silenceThreshold

    if (hasSpeech) {
      if (!this.isSpeaking) {
        this.isSpeaking = true
        if (this.audioBuffer.length === 0) {
          this.segmentStartTimestamp = now
        }
      }
      this.lastSpeechTime = now
      this.silenceStartTime = null
    } else {
      if (this.isSpeaking && !this.silenceStartTime) {
        this.silenceStartTime = now
      }
    }

    this.audioBuffer.push(float32)

    // Check if silence duration exceeded → segment complete
    if (
      this.isSpeaking &&
      this.silenceStartTime &&
      now - this.silenceStartTime >= this.silenceDuration &&
      this.audioBuffer.length > 0
    ) {
      this._flushSegment()
    }

    // Send partial results periodically
    if (
      this.isSpeaking &&
      this.audioBuffer.length > 0 &&
      now - this.lastPartialTime >= this.partialInterval
    ) {
      this.lastPartialTime = now
      const buffer = this._mergeBuffers(this.audioBuffer)
      this.onPartialAudio?.(buffer)
    }
  }

  _flushSegment() {
    const buffer = this._mergeBuffers(this.audioBuffer)
    const now = Date.now()
    const info = {
      startTime: this.segmentStartTimestamp || now,
      endTime: now,
      duration: now - (this.segmentStartTimestamp || now)
    }

    this.audioBuffer = []
    this.isSpeaking = false
    this.silenceStartTime = null
    this.lastSpeechTime = null
    this.segmentStartTimestamp = null
    this.lastPartialTime = now

    const minDuration = 500 // at least 0.5s of audio
    if (info.duration >= minDuration) {
      this.onSegmentReady?.(buffer, info)
    }
  }

  _mergeBuffers(buffers) {
    const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
    const result = new Float32Array(totalLength)
    let offset = 0
    for (const buf of buffers) {
      result.set(buf, offset)
      offset += buf.length
    }
    return result
  }
}
