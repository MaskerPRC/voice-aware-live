import { app } from 'electron'
import { join, dirname } from 'path'
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

/** 与 GitHub Release 资产名一致：https://github.com/ggml-org/whisper.cpp/releases */
const WHISPER_RELEASE_TAG = 'v1.8.4'
const WHISPER_RELEASE_BASE = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE_TAG}`

const WHISPER_RUNTIMES = (() => {
  const isWin = process.platform === 'win32'
  const isMac = process.platform === 'darwin'
  const ext = isWin ? '.exe' : ''
  const ghBase = WHISPER_RELEASE_BASE
  const runtimes = []

  /** 官方已将 CLI 从 main 更名为 whisper-cli；zip 内的 main.exe 仅为弃用提示桩程序 */
  const winCliCandidates = ['whisper-cli.exe', 'whisper-main-cpu.exe', 'main.exe']

  if (isWin) {
    runtimes.push(
      {
        id: 'runtime-cpu',
        name: 'Whisper.cpp (CPU x64)',
        type: 'runtime',
        device: 'cpu',
        size: '~4 MB',
        sizeBytes: 4_100_000,
        description: '官方预编译 CPU 版；入口程序为 whisper-cli.exe（勿再用 main.exe）',
        url: `${ghBase}/whisper-bin-x64.zip`,
        filename: `whisper-cli-cpu${ext}`,
        binaryCandidates: winCliCandidates,
        legacyFilenames: [`main-cpu${ext}`],
        isZip: true
      },
      {
        id: 'runtime-cuda-12',
        name: 'Whisper.cpp (CUDA 12.4 / cuBLAS)',
        type: 'runtime',
        device: 'gpu-cuda',
        size: '~440 MB',
        sizeBytes: 457_000_000,
        description: 'NVIDIA GPU，需本机安装与包匹配的 CUDA / cuBLAS 运行库',
        url: `${ghBase}/whisper-cublas-12.4.0-bin-x64.zip`,
        filename: `whisper-cli-cuda12${ext}`,
        binaryCandidates: winCliCandidates,
        legacyFilenames: [`main-cuda12${ext}`],
        isZip: true
      },
      {
        id: 'runtime-cuda-11',
        name: 'Whisper.cpp (CUDA 11.8 / cuBLAS)',
        type: 'runtime',
        device: 'gpu-cuda',
        size: '~60 MB',
        sizeBytes: 59_000_000,
        description: '较旧 NVIDIA 驱动环境可试此包（CUDA 11.8）',
        url: `${ghBase}/whisper-cublas-11.8.0-bin-x64.zip`,
        filename: `whisper-cli-cuda11${ext}`,
        binaryCandidates: winCliCandidates,
        legacyFilenames: [`main-cuda11${ext}`],
        isZip: true
      }
    )
  } else if (isMac) {
    runtimes.push(
      {
        id: 'runtime-cpu',
        name: 'Whisper.cpp (macOS XCFramework)',
        type: 'runtime',
        device: 'cpu',
        size: '~46 MB',
        sizeBytes: 46_400_000,
        description: '从官方 XCFramework 中提取 whisper-cli 或 main（含 Metal）',
        url: `${ghBase}/whisper-${WHISPER_RELEASE_TAG}-xcframework.zip`,
        filename: 'whisper-cli-cpu',
        binaryCandidates: ['whisper-cli', 'main'],
        legacyFilenames: ['main-cpu'],
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

  _findRuntimeBinPath(model) {
    if (model.type !== 'runtime') return null
    const p = join(this.binDir, model.filename)
    return existsSync(p) ? p : null
  }

  listModels() {
    return this._getAllEntries().map((model) => {
      const dir = this._getDirForType(model.type)
      let filepath = join(dir, model.filename)
      let downloaded = existsSync(filepath)
      if (model.type === 'runtime') {
        const found = this._findRuntimeBinPath(model)
        downloaded = !!found
        if (found) filepath = found
      }
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
    if (model.type === 'runtime') {
      return this._findRuntimeBinPath(model)
    }
    const filepath = join(dir, model.filename)
    return existsSync(filepath) ? filepath : null
  }

  getWhisperBinaryPath(device) {
    const isWin = process.platform === 'win32'
    const cudaFirst = ['runtime-cuda-12', 'runtime-cuda-11', 'runtime-cpu']
    const cpuFirst = ['runtime-cpu', 'runtime-cuda-12', 'runtime-cuda-11']

    let runtimeOrder
    if (device === 'gpu-cuda') {
      runtimeOrder = cudaFirst
    } else if (device === 'gpu-vulkan') {
      // 官方 Release 已不再提供 Windows Vulkan zip；回退到 CPU 可执行文件（设置里仍可选 Vulkan，实际走 CPU）
      runtimeOrder = isWin ? ['runtime-cpu'] : ['runtime-cpu']
    } else {
      runtimeOrder = cpuFirst
    }

    for (const id of runtimeOrder) {
      const path = this.getModelPath(id)
      if (path) {
        const rt = WHISPER_RUNTIMES.find((r) => r.id === id)
        return { path, device: rt?.device || 'cpu' }
      }
    }
    return null
  }

  getDefaultWhisperModel(preferredId) {
    // 优先使用指定的模型
    if (preferredId) {
      const path = this.getModelPath(preferredId)
      if (path) return { id: preferredId, path }
    }
    // 回退到第一个已下载的模型
    for (const model of WHISPER_MODELS) {
      const path = this.getModelPath(model.id)
      if (path) return { id: model.id, path }
    }
    return null
  }

  getDefaultLLMModel(preferredId) {
    if (preferredId) {
      const path = this.getModelPath(preferredId)
      if (path) return { id: preferredId, path }
    }
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

        await this._extractFromZip(zipPath, model, filepath)
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
    if (model.type === 'runtime') {
      let removed = false
      for (const fn of [model.filename, ...(model.legacyFilenames || [])]) {
        const p = join(dir, fn)
        if (existsSync(p)) {
          unlinkSync(p)
          removed = true
        }
      }
      if (removed) this.sendLog('info', `已删除: ${model.name}`)
      return
    }

    const filepath = join(dir, model.filename)
    if (existsSync(filepath)) {
      unlinkSync(filepath)
      this.sendLog('info', `已删除: ${model.name}`)
    }
  }

  async _extractFromZip(zipPath, model, destPath) {
    const { default: AdmZip } = await import('adm-zip')
    const zip = new AdmZip(zipPath)
    const norm = (p) => p.replace(/\\/g, '/')
    const names = zip.getEntries().filter((e) => !e.isDirectory)
    const basenameOf = (entry) => norm(entry.entryName).split('/').pop() || ''

    const candidates = model.binaryCandidates
      || (model.archiveEntry ? [model.archiveEntry] : ['whisper-cli.exe', 'main.exe'])

    let picked = null
    for (const want of candidates) {
      const w = want.toLowerCase()
      picked = names.find((e) => basenameOf(e).toLowerCase() === w)
      if (picked) break
    }

    if (!picked) {
      for (const want of candidates) {
        const w = want.toLowerCase()
        const hits = names.filter((e) => {
          const n = norm(e.entryName).toLowerCase()
          return n.endsWith('/' + w) || basenameOf(e).toLowerCase() === w
        })
        if (hits.length === 1) {
          picked = hits[0]
          break
        }
        if (hits.length > 1 && process.platform === 'darwin') {
          picked = hits.find((e) => norm(e.entryName).toLowerCase().includes('macos')) || hits[0]
          break
        }
        if (hits.length > 1) {
          picked = hits[0]
          break
        }
      }
    }

    if (!picked) {
      const list = names.slice(0, 50).map((e) => norm(e.entryName)).join(', ')
      throw new Error(`ZIP 中未找到候选可执行文件 (${candidates.join(', ')})。前若干项: ${list}`)
    }

    // Extract all files to binDir so DLLs are alongside the executable
    const destDir = dirname(destPath)
    for (const entry of names) {
      const filename = basenameOf(entry)
      if (!filename) continue
      await writeFile(join(destDir, filename), entry.getData())
    }

    // Rename the extracted executable to the expected destPath name
    const extractedBinName = basenameOf(picked)
    const extractedBinPath = join(destDir, extractedBinName)
    if (extractedBinPath !== destPath) {
      const { renameSync } = await import('fs')
      renameSync(extractedBinPath, destPath)
    }
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
