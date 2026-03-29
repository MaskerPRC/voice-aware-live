import { app } from 'electron'
import { join } from 'path'
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  statSync
} from 'fs'
import { v4 as uuidv4 } from 'uuid'

const DEFAULT_SETTINGS = {
  outputDir: '',
  silenceThreshold: 0.01,
  silenceDuration: 2000,
  whisperModel: '',
  llmModel: '',
  language: 'auto',
  whisperDevice: 'cpu',
  whisperBinaryPath: '',
  whisperThreads: 0,
  whisperGpuLayers: 0
}

export class FileService {
  constructor(sendLog) {
    this.sendLog = sendLog
    this.settingsPath = join(app.getPath('userData'), 'settings.json')
    this.defaultOutputDir = join(app.getPath('documents'), 'ASR-Live')
    this._ensureSettings()
  }

  _ensureSettings() {
    if (!existsSync(this.settingsPath)) {
      writeFileSync(this.settingsPath, JSON.stringify({
        ...DEFAULT_SETTINGS,
        outputDir: this.defaultOutputDir
      }, null, 2), 'utf-8')
    }
  }

  getSettings() {
    try {
      const raw = readFileSync(this.settingsPath, 'utf-8')
      const settings = JSON.parse(raw)
      return { ...DEFAULT_SETTINGS, ...settings }
    } catch {
      return { ...DEFAULT_SETTINGS, outputDir: this.defaultOutputDir }
    }
  }

  saveSettings(settings) {
    const current = this.getSettings()
    const merged = { ...current, ...settings }
    writeFileSync(this.settingsPath, JSON.stringify(merged, null, 2), 'utf-8')
  }

  getOutputDir() {
    const settings = this.getSettings()
    const dir = settings.outputDir || this.defaultOutputDir
    mkdirSync(dir, { recursive: true })
    return dir
  }

  saveSegment(result, filename, segmentInfo) {
    const outputDir = this.getOutputDir()

    // Create date-based subdirectory
    const now = new Date()
    const dateDir = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const segmentDir = join(outputDir, dateDir)
    mkdirSync(segmentDir, { recursive: true })

    // Sanitize filename
    const safeName = filename.replace(/[<>:"/\\|?*]/g, '_').trim() || 'segment'
    const id = uuidv4().split('-')[0]
    const fullFilename = `${safeName}_${id}.txt`
    const filepath = join(segmentDir, fullFilename)

    // Build content with timeline
    const startTimeStr = this._formatTimestamp(segmentInfo.startTime)
    const endTimeStr = this._formatTimestamp(segmentInfo.endTime)
    const durationStr = this._formatDuration(segmentInfo.duration)

    let content = `# 语音转录\n\n`
    content += `时间: ${startTimeStr} → ${endTimeStr}\n`
    content += `时长: ${durationStr}\n`
    if (result.summary) {
      content += `摘要: ${result.summary}\n`
    }
    content += `\n---\n\n`

    if (result.segments && result.segments.length > 0) {
      for (const seg of result.segments) {
        const segStart = this._formatMs(seg.start)
        const segEnd = this._formatMs(seg.end)
        content += `[${segStart} → ${segEnd}] ${seg.text}\n`
      }
    } else {
      content += result.text + '\n'
    }

    writeFileSync(filepath, content, 'utf-8')

    // Save metadata
    const metaPath = filepath + '.meta.json'
    writeFileSync(metaPath, JSON.stringify({
      id,
      filename: fullFilename,
      startTime: segmentInfo.startTime,
      endTime: segmentInfo.endTime,
      duration: segmentInfo.duration,
      text: result.text,
      summary: result.summary || '',
      createdAt: Date.now()
    }, null, 2), 'utf-8')

    return { filename: fullFilename, filepath }
  }

  listTranscripts() {
    const outputDir = this.getOutputDir()
    const transcripts = []

    try {
      const dateDirs = readdirSync(outputDir).filter((d) => {
        const fullPath = join(outputDir, d)
        return statSync(fullPath).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d)
      })

      for (const dateDir of dateDirs.sort().reverse()) {
        const dirPath = join(outputDir, dateDir)
        const metaFiles = readdirSync(dirPath).filter((f) => f.endsWith('.meta.json'))

        for (const metaFile of metaFiles) {
          try {
            const meta = JSON.parse(readFileSync(join(dirPath, metaFile), 'utf-8'))
            transcripts.push({
              ...meta,
              dateDir,
              dirPath
            })
          } catch {}
        }
      }
    } catch {}

    return transcripts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  getTranscript(id) {
    const all = this.listTranscripts()
    const meta = all.find((t) => t.id === id)
    if (!meta) return null

    const txtPath = join(meta.dirPath, meta.filename)
    try {
      const content = readFileSync(txtPath, 'utf-8')
      return { ...meta, content }
    } catch {
      return meta
    }
  }

  getTranscriptFolder(id) {
    const all = this.listTranscripts()
    const meta = all.find((t) => t.id === id)
    return meta?.dirPath || null
  }

  deleteTranscript(id) {
    const all = this.listTranscripts()
    const meta = all.find((t) => t.id === id)
    if (!meta) return

    const txtPath = join(meta.dirPath, meta.filename)
    const metaPath = txtPath + '.meta.json'
    try { unlinkSync(txtPath) } catch {}
    try { unlinkSync(metaPath) } catch {}
  }

  _formatTimestamp(ts) {
    const date = new Date(ts)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  _formatDuration(ms) {
    const seconds = Math.floor(ms / 1000)
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}分${s}秒`
  }

  _formatMs(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    const msRem = Math.floor((ms % 1000) / 10)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msRem).padStart(2, '0')}`
  }
}
