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
    this.sendLog('debug', `[AudioProcessor] 配置: threshold=${this.silenceThreshold}, silenceDuration=${this.silenceDuration}ms, sampleRate=${this.sampleRate}`)
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
    this.sendLog('debug', '[AudioProcessor] start() — 状态已重置')
  }

  stop() {
    this.running = false
    const hadSpeech = this.isSpeaking
    const bufLen = this.audioBuffer.length

    if (bufLen > 0 && hadSpeech && this.segmentStartTimestamp) {
      const buffer = this._mergeBuffers(this.audioBuffer)
      const now = Date.now()
      const info = {
        startTime: this.segmentStartTimestamp,
        endTime: now,
        duration: now - this.segmentStartTimestamp
      }
      this.audioBuffer = []
      this.sendLog('debug', `[AudioProcessor] stop() — 剩余语音 ${(buffer.length / this.sampleRate).toFixed(1)}s, duration=${(info.duration / 1000).toFixed(1)}s`)
      return { buffer, info }
    }

    const reason = bufLen === 0 ? '无缓冲' : !hadSpeech ? '无语音(纯静音)' : '无时间戳'
    this.sendLog('debug', `[AudioProcessor] stop() — 不提交: ${reason}, buf=${(bufLen * (this.audioBuffer[0]?.length || 0) / this.sampleRate).toFixed(1)}s`)
    this.audioBuffer = []
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
        this.segmentStartTimestamp = now
        this.sendLog('debug', `[AudioProcessor] 检测到语音 (rms=${rms.toFixed(4)}, buf=${this.audioBuffer.length})`)
      }
      this.lastSpeechTime = now
      this.silenceStartTime = null
    } else {
      if (this.isSpeaking && !this.silenceStartTime) {
        this.silenceStartTime = now
        this.sendLog('debug', `[AudioProcessor] 静音开始 (rms=${rms.toFixed(4)}, 缓冲=${(this.audioBuffer.length * (this.audioBuffer[0]?.length || 0) / this.sampleRate).toFixed(1)}s)`)
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
      this.sendLog('debug', `[AudioProcessor] 静音超时 ${((now - this.silenceStartTime) / 1000).toFixed(1)}s → flush`)
      this._flushSegment()
    }

    // Send partial results periodically — but NOT if silence is about to trigger a flush
    const silenceElapsed = this.silenceStartTime ? now - this.silenceStartTime : 0
    const flushImminent = this.isSpeaking && this.silenceStartTime && silenceElapsed >= this.silenceDuration * 0.8
    if (
      this.isSpeaking &&
      !flushImminent &&
      this.audioBuffer.length > 0 &&
      now - this.lastPartialTime >= this.partialInterval
    ) {
      this.lastPartialTime = now
      // 只发送最近 30s 的音频，避免模型处理超长音频产生乱码
      const maxPartialSamples = this.sampleRate * 30
      const allBuffer = this._mergeBuffers(this.audioBuffer)
      const buffer = allBuffer.length > maxPartialSamples
        ? allBuffer.slice(allBuffer.length - maxPartialSamples)
        : allBuffer
      this.sendLog('debug', `[AudioProcessor] 触发 partial (已积累 ${(allBuffer.length / this.sampleRate).toFixed(1)}s, 发送 ${(buffer.length / this.sampleRate).toFixed(1)}s)`)
      this.onPartialAudio?.(buffer)
    }
  }

  resetPartialTimer() {
    this.lastPartialTime = Date.now()
    this.sendLog('debug', '[AudioProcessor] resetPartialTimer() — partial 计时器已重置')
  }

  _flushSegment() {
    const buffer = this._mergeBuffers(this.audioBuffer)
    const now = Date.now()
    const duration = now - (this.segmentStartTimestamp || now)
    const info = {
      startTime: this.segmentStartTimestamp || now,
      endTime: now,
      duration
    }

    this.audioBuffer = []
    this.isSpeaking = false
    this.silenceStartTime = null
    this.lastSpeechTime = null
    this.segmentStartTimestamp = null
    this.lastPartialTime = now

    const minDuration = 500 // at least 0.5s of audio
    this.sendLog('debug', `[AudioProcessor] _flushSegment: duration=${(duration / 1000).toFixed(2)}s, samples=${buffer.length}, minDuration=${minDuration}ms → ${duration >= minDuration ? '提交' : '丢弃(太短)'}`)
    if (duration >= minDuration) {
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
