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
  }

  async transcribe(audioBuffer, segmentInfo = {}, settings = {}) {
    if (this.busy) {
      this.sendLog('warn', 'Whisper 正忙，跳过此片段')
      return null
    }

    const model = this.modelManager.getDefaultWhisperModel()
    if (!model) {
      this.sendLog('error', '没有可用的 Whisper 模型，请先下载')
      return null
    }

    this.busy = true
    try {
      const wavPath = join(this.tempDir, `chunk_${Date.now()}.wav`)
      this._writeWav(wavPath, audioBuffer, 16000)

      const result = await this._runWhisperCpp(model.path, wavPath, settings)

      try { unlinkSync(wavPath) } catch {}

      return {
        text: result.text,
        segments: result.segments,
        startTime: segmentInfo.startTime || Date.now(),
        endTime: segmentInfo.endTime || Date.now(),
        duration: segmentInfo.duration || 0
      }
    } catch (err) {
      this.sendLog('error', `转录失败: ${err.message}`)
      return null
    } finally {
      this.busy = false
    }
  }

  _resolveWhisperBinary(settings) {
    // Priority: custom path > matching runtime binary > fallback
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

    // Legacy fallback: look in the bin directory
    const binaryName = process.platform === 'win32' ? 'main.exe' : 'main'
    const fallbackPath = join(app.getPath('userData'), 'bin', binaryName)
    return { path: fallbackPath, isGpuBinary: false }
  }

  _runWhisperCpp(modelPath, audioPath, settings = {}) {
    return new Promise((resolve, reject) => {
      const { path: whisperBin, isGpuBinary } = this._resolveWhisperBinary(settings)
      const device = settings.whisperDevice || 'cpu'
      const language = settings.language || 'auto'
      const threads = settings.whisperThreads || Math.max(1, Math.floor(os.cpus().length / 2))
      const gpuLayers = settings.whisperGpuLayers || 0

      const args = [
        '-m', modelPath,
        '-f', audioPath,
        '--language', language,
        '--output-json-full',
        '--no-prints',
        '-t', String(threads)
      ]

      // GPU / CPU control
      if (device === 'cpu' || !isGpuBinary) {
        args.push('--no-gpu')
        this.sendLog('debug', `使用 CPU 推理 (${threads} 线程)`)
      } else {
        if (gpuLayers > 0) {
          args.push('-ngl', String(gpuLayers))
        }
        this.sendLog('debug', `使用 GPU 推理 (${device}${gpuLayers > 0 ? ', ' + gpuLayers + ' layers' : ''})`)
      }

      let stdout = ''
      let stderr = ''

      const proc = spawn(whisperBin, args, {
        cwd: this.tempDir,
        timeout: 120000
      })

      proc.stdout.on('data', (data) => { stdout += data.toString() })
      proc.stderr.on('data', (data) => { stderr += data.toString() })

      proc.on('close', (code) => {
        if (code !== 0) {
          this.sendLog('warn', `whisper.cpp 退出码: ${code}`)
        }

        // Try to parse JSON output file
        const jsonPath = audioPath + '.json'
        try {
          const jsonContent = readFileSync(jsonPath, 'utf-8')
          const parsed = JSON.parse(jsonContent)
          try { unlinkSync(jsonPath) } catch {}

          const segments = (parsed.transcription || []).map((seg) => ({
            start: seg.timestamps?.from || seg.offsets?.from || 0,
            end: seg.timestamps?.to || seg.offsets?.to || 0,
            text: seg.text?.trim() || ''
          }))

          resolve({
            text: segments.map((s) => s.text).join(' '),
            segments
          })
          return
        } catch {}

        // Fallback: parse stdout text output
        if (stdout.trim()) {
          resolve({
            text: stdout.trim().replace(/\[.*?\]/g, '').trim(),
            segments: []
          })
          return
        }

        reject(new Error(stderr || `whisper.cpp 退出码 ${code}`))
      })

      proc.on('error', (err) => {
        if (err.code === 'ENOENT') {
          reject(new Error(
            'whisper.cpp 二进制文件未找到。请到"模型管理 → 运行时"下载，或在设置中配置自定义路径。\n路径: ' + whisperBin
          ))
        } else {
          reject(err)
        }
      })
    })
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
