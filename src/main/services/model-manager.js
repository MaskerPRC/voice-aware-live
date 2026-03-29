import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'fs'
import { writeFile } from 'fs/promises'
import https from 'https'
import http from 'http'

const WHISPER_MODELS = [
  {
    id: 'whisper-tiny',
    name: 'Tiny',
    type: 'whisper',
    size: '75 MB',
    sizeBytes: 75_000_000,
    description: '最小模型，速度最快，适合实时转录',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    filename: 'ggml-tiny.bin'
  },
  {
    id: 'whisper-tiny.en',
    name: 'Tiny (EN)',
    type: 'whisper',
    size: '75 MB',
    sizeBytes: 75_000_000,
    description: '仅英文的 Tiny 模型',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
    filename: 'ggml-tiny.en.bin'
  },
  {
    id: 'whisper-base',
    name: 'Base',
    type: 'whisper',
    size: '142 MB',
    sizeBytes: 142_000_000,
    description: '基础模型，速度与质量的平衡',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    filename: 'ggml-base.bin'
  },
  {
    id: 'whisper-base.en',
    name: 'Base (EN)',
    type: 'whisper',
    size: '142 MB',
    sizeBytes: 142_000_000,
    description: '仅英文的 Base 模型',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
    filename: 'ggml-base.en.bin'
  },
  {
    id: 'whisper-small',
    name: 'Small',
    type: 'whisper',
    size: '466 MB',
    sizeBytes: 466_000_000,
    description: '较高质量，适合多语言',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    filename: 'ggml-small.bin'
  },
  {
    id: 'whisper-small.en',
    name: 'Small (EN)',
    type: 'whisper',
    size: '466 MB',
    sizeBytes: 466_000_000,
    description: '仅英文的 Small 模型',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
    filename: 'ggml-small.en.bin'
  },
  {
    id: 'whisper-medium',
    name: 'Medium',
    type: 'whisper',
    size: '1.5 GB',
    sizeBytes: 1_500_000_000,
    description: '高质量模型，推荐用于中文',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    filename: 'ggml-medium.bin'
  },
  {
    id: 'whisper-medium.en',
    name: 'Medium (EN)',
    type: 'whisper',
    size: '1.5 GB',
    sizeBytes: 1_500_000_000,
    description: '仅英文的 Medium 模型',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
    filename: 'ggml-medium.en.bin'
  },
  {
    id: 'whisper-large-v3',
    name: 'Large V3',
    type: 'whisper',
    size: '3.1 GB',
    sizeBytes: 3_100_000_000,
    description: '最高质量，需要较多内存',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    filename: 'ggml-large-v3.bin'
  },
  {
    id: 'whisper-large-v3-turbo',
    name: 'Large V3 Turbo',
    type: 'whisper',
    size: '1.6 GB',
    sizeBytes: 1_600_000_000,
    description: 'Large V3 加速版，质量与速度兼顾',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
    filename: 'ggml-large-v3-turbo.bin'
  }
]

const LLM_MODELS = [
  {
    id: 'qwen3.5-0.8b',
    name: 'Qwen 3.5 0.8B',
    type: 'llm',
    size: '~530 MB',
    sizeBytes: 532_517_120,
    description: '超轻量 Qwen 3.5，用于总结与命名（Q4_K_M）',
    url: 'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf',
    filename: 'Qwen3.5-0.8B-Q4_K_M.gguf'
  },
  {
    id: 'qwen3.5-2b',
    name: 'Qwen 3.5 2B',
    type: 'llm',
    size: '~1.2 GB',
    sizeBytes: 1_280_835_840,
    description: '更大一档 Qwen 3.5，总结质量更高（Q4_K_M）',
    url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf',
    filename: 'Qwen3.5-2B-Q4_K_M.gguf'
  }
]

const WHISPER_RUNTIMES = (() => {
  const isWin = process.platform === 'win32'
  const isMac = process.platform === 'darwin'
  const ext = isWin ? '.exe' : ''
  const tag = 'v1.7.4'
  const ghBase = `https://github.com/ggerganov/whisper.cpp/releases/download/${tag}`

  const runtimes = []

  if (isWin) {
    runtimes.push(
      {
        id: 'runtime-cpu',
        name: 'Whisper.cpp (CPU)',
        type: 'runtime',
        device: 'cpu',
        size: '~3 MB',
        sizeBytes: 3_000_000,
        description: '标准 CPU 版本，兼容所有设备',
        url: `${ghBase}/whisper-bin-x64.zip`,
        filename: `main-cpu${ext}`,
        archiveEntry: `main${ext}`,
        isZip: true
      },
      {
        id: 'runtime-cuda-12',
        name: 'Whisper.cpp (CUDA 12)',
        type: 'runtime',
        device: 'gpu-cuda',
        size: '~30 MB',
        sizeBytes: 30_000_000,
        description: 'NVIDIA GPU 加速（需要 CUDA 12 + cuBLAS）',
        url: `${ghBase}/whisper-cublas-12.6.3-bin-x64.zip`,
        filename: `main-cuda${ext}`,
        archiveEntry: `main${ext}`,
        isZip: true
      },
      {
        id: 'runtime-vulkan',
        name: 'Whisper.cpp (Vulkan)',
        type: 'runtime',
        device: 'gpu-vulkan',
        size: '~5 MB',
        sizeBytes: 5_000_000,
        description: 'Vulkan GPU 加速（AMD / NVIDIA / Intel 均可）',
        url: `${ghBase}/whisper-vulkan-x64.zip`,
        filename: `main-vulkan${ext}`,
        archiveEntry: `main${ext}`,
        isZip: true
      }
    )
  } else if (isMac) {
    runtimes.push(
      {
        id: 'runtime-cpu',
        name: 'Whisper.cpp (CPU + Metal)',
        type: 'runtime',
        device: 'cpu',
        size: '~2 MB',
        sizeBytes: 2_000_000,
        description: 'macOS 版本，自带 Metal GPU 加速',
        url: `${ghBase}/whisper-bin-macos-arm64.zip`,
        filename: `main-cpu`,
        archiveEntry: 'main',
        isZip: true
      }
    )
  } else {
    runtimes.push(
      {
        id: 'runtime-cpu',
        name: 'Whisper.cpp (CPU)',
        type: 'runtime',
        device: 'cpu',
        size: '~3 MB',
        sizeBytes: 3_000_000,
        description: '标准 CPU 版本',
        url: `${ghBase}/whisper-bin-linux-x64.zip`,
        filename: 'main-cpu',
        archiveEntry: 'main',
        isZip: true
      }
    )
  }

  return runtimes
})()

export class ModelManager {
  constructor(sendLog) {
    this.sendLog = sendLog
    this.modelsDir = join(app.getPath('userData'), 'models')
    this.whisperDir = join(this.modelsDir, 'whisper')
    this.llmDir = join(this.modelsDir, 'llm')
    this.binDir = join(app.getPath('userData'), 'bin')
    this.activeDownloads = new Map()

    mkdirSync(this.whisperDir, { recursive: true })
    mkdirSync(this.llmDir, { recursive: true })
    mkdirSync(this.binDir, { recursive: true })
  }

  _getAllEntries() {
    return [...WHISPER_MODELS, ...LLM_MODELS, ...WHISPER_RUNTIMES]
  }

  _getDirForType(type) {
    if (type === 'whisper') return this.whisperDir
    if (type === 'llm') return this.llmDir
    if (type === 'runtime') return this.binDir
    return this.modelsDir
  }

  listModels() {
    return this._getAllEntries().map((model) => {
      const dir = this._getDirForType(model.type)
      const filepath = join(dir, model.filename)
      const downloaded = existsSync(filepath)
      let fileSize = 0
      if (downloaded) {
        try { fileSize = statSync(filepath).size } catch {}
      }
      return {
        ...model,
        downloaded,
        fileSize,
        downloading: this.activeDownloads.has(model.id)
      }
    })
  }

  getModelPath(modelId) {
    const model = this._getAllEntries().find((m) => m.id === modelId)
    if (!model) return null
    const dir = this._getDirForType(model.type)
    const filepath = join(dir, model.filename)
    return existsSync(filepath) ? filepath : null
  }

  getWhisperBinaryPath(device) {
    const runtimeOrder = device === 'gpu-cuda'
      ? ['runtime-cuda-12', 'runtime-vulkan', 'runtime-cpu']
      : device === 'gpu-vulkan'
        ? ['runtime-vulkan', 'runtime-cuda-12', 'runtime-cpu']
        : ['runtime-cpu', 'runtime-vulkan', 'runtime-cuda-12']

    for (const id of runtimeOrder) {
      const path = this.getModelPath(id)
      if (path) {
        const rt = WHISPER_RUNTIMES.find((r) => r.id === id)
        return { path, device: rt?.device || 'cpu' }
      }
    }
    return null
  }

  getDefaultWhisperModel() {
    for (const model of WHISPER_MODELS) {
      const path = this.getModelPath(model.id)
      if (path) return { id: model.id, path }
    }
    return null
  }

  getDefaultLLMModel() {
    for (const model of LLM_MODELS) {
      const path = this.getModelPath(model.id)
      if (path) return { id: model.id, path }
    }
    return null
  }

  async downloadModel(modelId, onProgress) {
    const model = this._getAllEntries().find((m) => m.id === modelId)
    if (!model) throw new Error(`未找到模型: ${modelId}`)

    const dir = this._getDirForType(model.type)
    const filepath = join(dir, model.filename)
    const tempPath = filepath + '.downloading'

    if (this.activeDownloads.has(modelId)) {
      throw new Error('正在下载中')
    }

    const controller = new AbortController()
    this.activeDownloads.set(modelId, controller)

    try {
      this.sendLog('info', `开始下载: ${model.name} (${model.size})`)

      if (model.isZip) {
        const zipPath = join(dir, `_temp_${model.id}.zip`)
        await this._downloadFile(model.url, zipPath, (progress) => {
          onProgress?.({
            percent: progress.percent,
            downloaded: progress.downloaded,
            total: progress.total,
            speed: progress.speed
          })
        }, controller.signal)

        await this._extractFromZip(zipPath, model.archiveEntry, filepath)
        try { unlinkSync(zipPath) } catch {}

        // Make executable on Unix
        if (process.platform !== 'win32') {
          const { chmodSync } = await import('fs')
          chmodSync(filepath, 0o755)
        }
      } else {
        await this._downloadFile(model.url, tempPath, (progress) => {
          onProgress?.({
            percent: progress.percent,
            downloaded: progress.downloaded,
            total: progress.total,
            speed: progress.speed
          })
        }, controller.signal)

        const { renameSync } = await import('fs')
        renameSync(tempPath, filepath)
      }

      this.sendLog('info', `下载完成: ${model.name}`)
    } catch (err) {
      try { unlinkSync(tempPath) } catch {}
      if (err.name === 'AbortError') {
        this.sendLog('info', `下载已取消: ${model.name}`)
        throw new Error('下载已取消')
      }
      throw err
    } finally {
      this.activeDownloads.delete(modelId)
    }
  }

  cancelDownload(modelId) {
    const controller = this.activeDownloads.get(modelId)
    if (controller) {
      controller.abort()
    }
  }

  async deleteModel(modelId) {
    const model = this._getAllEntries().find((m) => m.id === modelId)
    if (!model) throw new Error(`未找到: ${modelId}`)

    const dir = this._getDirForType(model.type)
    const filepath = join(dir, model.filename)
    if (existsSync(filepath)) {
      unlinkSync(filepath)
      this.sendLog('info', `已删除: ${model.name}`)
    }
  }

  async _extractFromZip(zipPath, entryName, destPath) {
    const { createReadStream } = await import('fs')
    const { createUnzip } = await import('zlib')
    const { pipeline } = await import('stream/promises')

    // Simple ZIP extraction: whisper.cpp release ZIPs are flat,
    // so we look for the target file by scanning the local file headers.
    const data = await import('fs').then((fs) => fs.promises.readFile(zipPath))
    const entries = this._parseZipEntries(data)
    const target = entries.find((e) =>
      e.name === entryName || e.name.endsWith('/' + entryName)
    )
    if (!target) {
      // Fallback: if there's only one .exe or executable, use it
      const exeEntry = entries.find((e) =>
        e.name.endsWith('.exe') || (!e.name.includes('.') && !e.name.endsWith('/'))
      )
      if (exeEntry) {
        await writeFile(destPath, exeEntry.data)
        return
      }
      throw new Error(`ZIP 中未找到文件: ${entryName}，可用: ${entries.map((e) => e.name).join(', ')}`)
    }
    await writeFile(destPath, target.data)
  }

  _parseZipEntries(buffer) {
    const entries = []
    let offset = 0
    while (offset < buffer.length - 4) {
      const sig = buffer.readUInt32LE(offset)
      if (sig !== 0x04034b50) break // Local file header signature

      const compMethod = buffer.readUInt16LE(offset + 8)
      const compSize = buffer.readUInt32LE(offset + 18)
      const uncompSize = buffer.readUInt32LE(offset + 22)
      const nameLen = buffer.readUInt16LE(offset + 26)
      const extraLen = buffer.readUInt16LE(offset + 28)
      const name = buffer.toString('utf-8', offset + 30, offset + 30 + nameLen)
      const dataStart = offset + 30 + nameLen + extraLen
      const dataEnd = dataStart + compSize

      if (compMethod === 0 && compSize > 0) {
        entries.push({
          name,
          data: buffer.subarray(dataStart, dataEnd)
        })
      }
      offset = dataEnd
    }
    return entries
  }

  _downloadFile(url, destPath, onProgress, signal) {
    return new Promise((resolve, reject) => {
      const doRequest = (reqUrl) => {
        const proto = reqUrl.startsWith('https') ? https : http
        const req = proto.get(reqUrl, { headers: { 'User-Agent': 'ASR-Live/1.0' } }, (res) => {
          if (signal?.aborted) {
            req.destroy()
            reject(new DOMException('Aborted', 'AbortError'))
            return
          }

          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            doRequest(res.headers.location)
            return
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }

          const totalSize = parseInt(res.headers['content-length'], 10) || 0
          let downloaded = 0
          let lastTime = Date.now()
          let lastDownloaded = 0
          const chunks = []

          res.on('data', (chunk) => {
            if (signal?.aborted) {
              req.destroy()
              reject(new DOMException('Aborted', 'AbortError'))
              return
            }

            chunks.push(chunk)
            downloaded += chunk.length
            const now = Date.now()
            const elapsed = (now - lastTime) / 1000

            if (elapsed >= 0.5) {
              const speed = (downloaded - lastDownloaded) / elapsed
              lastTime = now
              lastDownloaded = downloaded
              onProgress?.({
                percent: totalSize ? (downloaded / totalSize) * 100 : 0,
                downloaded,
                total: totalSize,
                speed
              })
            }
          })

          res.on('end', async () => {
            try {
              const buffer = Buffer.concat(chunks)
              await writeFile(destPath, buffer)
              resolve()
            } catch (err) {
              reject(err)
            }
          })

          res.on('error', reject)
        })

        req.on('error', reject)

        if (signal) {
          signal.addEventListener('abort', () => {
            req.destroy()
            reject(new DOMException('Aborted', 'AbortError'))
          }, { once: true })
        }
      }

      doRequest(url)
    })
  }
}
