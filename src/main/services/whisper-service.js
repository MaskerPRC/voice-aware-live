import { app } from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync, readFileSync, unlinkSync, mkdirSync } from 'fs'
import { spawn } from 'child_process'
import os from 'os'

export class WhisperService {
  constructor(modelManager, sendLog) {
    this.modelManager = modelManager
    this.sendLog = sendLog
    this.tempDir = join(app.getPath('temp'), 'asr-live')
    mkdirSync(this.tempDir, { recursive: true })
    this.busy = false
    this._busyResolvers = []
  }

  /** 返回一个 Promise，在 busy 变为 false 时 resolve */
  _waitUntilFree(timeoutMs = 30000) {
    if (!this.busy) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this._busyResolvers = this._busyResolvers.filter((r) => r !== resolve)
        resolve() // 超时也 resolve，让调用方再检查 busy
      }, timeoutMs)
      this._busyResolvers.push(() => { clearTimeout(timer); resolve() })
    })
  }

  _notifyFree() {
    const resolvers = this._busyResolvers
    this._busyResolvers = []
    for (const r of resolvers) r()
  }

  async transcribe(audioBuffer, segmentInfo = {}, settings = {}) {
    const isPartial = !!segmentInfo.partial
    const tag = isPartial ? '[Whisper/partial]' : '[Whisper/segment]'

    if (this.busy) {
      if (isPartial) {
        this.sendLog('debug', `${tag} busy=true，跳过 (samples=${audioBuffer.length})`)
        return null
      }
      // segment 等待 Whisper 空闲
      this.sendLog('debug', `${tag} busy=true，等待空闲… (samples=${audioBuffer.length})`)
      await this._waitUntilFree()
      if (this.busy) {
        this.sendLog('warn', `${tag} 等待超时，仍然 busy，跳过`)
        return null
      }
      this.sendLog('debug', `${tag} Whisper 已空闲，继续处理`)
    }

    const model = this.modelManager.getDefaultWhisperModel(settings.whisperModel)
    if (!model) {
      this.sendLog('error', `${tag} 没有可用的 Whisper 模型，请先下载`)
      return null
    }

    // 检测音频能量，过低则跳过（避免纯噪音触发 Whisper 幻觉）
    let sumSq = 0
    for (let i = 0; i < audioBuffer.length; i++) sumSq += audioBuffer[i] * audioBuffer[i]
    const rms = Math.sqrt(sumSq / audioBuffer.length)
    if (rms < 0.005) {
      this.sendLog('debug', `${tag} 音频能量过低 (rms=${rms.toFixed(4)})，跳过`)
      return null
    }

    this.busy = true
    const t0 = Date.now()
    this.sendLog('debug', `${tag} 开始转录 (samples=${audioBuffer.length}, ${(audioBuffer.length / 16000).toFixed(1)}s, rms=${rms.toFixed(4)}, model=${model.id})`)
    try {
      const wavPath = join(this.tempDir, `chunk_${Date.now()}.wav`)
      this._writeWav(wavPath, audioBuffer, 16000)

      const result = await this._runWhisperCpp(model.path, wavPath, settings)

      try { unlinkSync(wavPath) } catch {}

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      this.sendLog('debug', `${tag} 完成 耗时=${elapsed}s, 识别文字="${result.text.slice(0, 80)}"`)
      return {
        text: result.text,
        segments: result.segments,
        startTime: segmentInfo.startTime || Date.now(),
        endTime: segmentInfo.endTime || Date.now(),
        duration: segmentInfo.duration || 0
      }
    } catch (err) {
      this.sendLog('error', `${tag} 转录失败 (耗时=${((Date.now() - t0) / 1000).toFixed(1)}s): ${err.message}`)
      return null
    } finally {
      this.busy = false
      this._notifyFree()
    }
  }

  _resolveWhisperBinary(settings) {
    const customPath = settings.whisperBinaryPath
    if (customPath && existsSync(customPath)) {
      return { path: customPath, isGpuBinary: settings.whisperDevice !== 'cpu' }
    }

    const device = settings.whisperDevice || 'cpu'
    const runtime = this.modelManager.getWhisperBinaryPath(
      device === 'gpu-cuda' ? 'gpu-cuda' : device === 'gpu-vulkan' ? 'gpu-vulkan' : 'cpu'
    )

    if (runtime) {
      return {
        path: runtime.path,
        isGpuBinary: runtime.device !== 'cpu'
      }
    }

    const binDir = join(app.getPath('userData'), 'bin')
    const win = process.platform === 'win32'
    const fallbacks = win
      ? ['whisper-cli.exe', 'whisper-cli-cpu.exe', 'main.exe']
      : ['whisper-cli-cpu', 'whisper-cli', 'main']
    for (const name of fallbacks) {
      const p = join(binDir, name)
      if (existsSync(p)) return { path: p, isGpuBinary: false }
    }
    const fallbackPath = join(binDir, win ? 'whisper-cli.exe' : 'whisper-cli')
    return { path: fallbackPath, isGpuBinary: false }
  }

  _threadCount(settings) {
    const n = settings.whisperThreads
    if (typeof n === 'number' && n > 0) return n
    return Math.max(1, Math.floor(os.cpus().length / 2))
  }

  async _runWhisperCpp(modelPath, audioPath, settings = {}) {
    const { path: whisperBin, isGpuBinary } = this._resolveWhisperBinary(settings)
    const device = settings.whisperDevice || 'cpu'
    const language = settings.language || 'auto'
    const threads = this._threadCount(settings)
    const gpuLayers = settings.whisperGpuLayers || 0
    const jsonPath = audioPath + '.json'

    const buildArgs = (forceCpu) => {
      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '--language', language === 'auto' ? 'auto' : language,
        '--output-json-full',
        '--no-prints',
        '-t', String(threads)
      ]
      const useGpu = !forceCpu && device !== 'cpu' && isGpuBinary
      if (!useGpu) {
        args.push('--no-gpu')
      } else if (gpuLayers > 0) {
        args.push('-ngl', String(gpuLayers))
      }
      return args
    }

    const runOnce = (forceCpu) => new Promise((resolve, reject) => {
      try { unlinkSync(jsonPath) } catch {}

      const args = buildArgs(forceCpu)
      if (forceCpu) {
        this.sendLog('debug', `Whisper: CPU 模式 (${threads} 线程)`)
      } else if (device !== 'cpu' && isGpuBinary) {
        this.sendLog('debug', `Whisper: GPU 模式 (${device}${gpuLayers > 0 ? `, ngl=${gpuLayers}` : ''})`)
      } else {
        this.sendLog('debug', `Whisper: CPU 模式 (${threads} 线程)`)
      }

      let stdout = ''
      let stderr = ''
      const proc = spawn(whisperBin, args, { cwd: this.tempDir })

      proc.stdout.on('data', (d) => { stdout += d.toString() })
      proc.stderr.on('data', (d) => { stderr += d.toString() })

      proc.on('error', (err) => reject(err))
      proc.on('close', (code) => {
        resolve({ code, stdout, stderr })
      })
    })

    let { code, stdout, stderr } = await runOnce(false)

    const wantGpu = device !== 'cpu' && isGpuBinary
    if (code !== 0 && wantGpu) {
      const detail = stderr.trim() || stdout.trim() || '(无输出)'
      this.sendLog(
        'warn',
        `GPU 推理失败 (退出码 ${code})，自动改用 CPU 重试。原因摘要: ${detail.slice(0, 600)}${detail.length > 600 ? '…' : ''}`
      )
      ;({ code, stdout, stderr } = await runOnce(true))
    }

    if (code !== 0) {
      const msg = stderr.trim() || stdout.trim() || `退出码 ${code}`
      this.sendLog('error', `whisper.cpp 失败: ${msg.slice(0, 2000)}${msg.length > 2000 ? '…' : ''}`)
      throw new Error(msg.slice(0, 500))
    }

    try {
      const jsonContent = readFileSync(jsonPath, 'utf-8')
      const parsed = JSON.parse(jsonContent)
      try { unlinkSync(jsonPath) } catch {}

      const segments = (parsed.transcription || []).map((seg) => ({
        start: seg.offsets?.from ?? seg.timestamps?.from ?? 0,
        end: seg.offsets?.to ?? seg.timestamps?.to ?? 0,
        text: seg.text?.trim() || ''
      }))

      return {
        text: segments.map((s) => s.text).join(' '),
        segments
      }
    } catch {
      // 仅当进程成功退出时才把 stdout 当作文本结果，避免把 WARNING / 错误行当成识别内容
      const out = stdout.trim()
      if (out && !/^warning|error|fatal|cuda|ggml|failed/i.test(out.split('\n')[0] || '')) {
        return {
          text: out.replace(/\[.*?\]/g, '').trim(),
          segments: []
        }
      }
      throw new Error(stderr.trim() || '无法解析 JSON 输出且无有效 stdout')
    }
  }

  _writeWav(filepath, float32Array, sampleRate) {
    const numChannels = 1
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
    const blockAlign = numChannels * (bitsPerSample / 8)

    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    const dataSize = int16Array.length * 2
    const buffer = Buffer.alloc(44 + dataSize)

    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write('WAVE', 8)
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16)
    buffer.writeUInt16LE(1, 20)
    buffer.writeUInt16LE(numChannels, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(byteRate, 28)
    buffer.writeUInt16LE(blockAlign, 32)
    buffer.writeUInt16LE(bitsPerSample, 34)
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataSize, 40)

    Buffer.from(int16Array.buffer).copy(buffer, 44)
    writeFileSync(filepath, buffer)
  }
}
