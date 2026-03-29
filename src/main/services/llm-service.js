export class LLMService {
  constructor(modelManager, sendLog) {
    this.modelManager = modelManager
    this.sendLog = sendLog
    this.model = null
    this.context = null
    this.loading = false
  }

  async _ensureModel() {
    if (this.model && this.context) return true
    if (this.loading) return false

    const llmModel = this.modelManager.getDefaultLLMModel()
    if (!llmModel) {
      this.sendLog('warn', '没有可用的 LLM 模型，将使用默认文件名')
      return false
    }

    this.loading = true
    try {
      this.sendLog('info', '正在加载 LLM 模型...')
      const { getLlama } = await import('node-llama-cpp')
      const llama = await getLlama()
      this.model = await llama.loadModel({ modelPath: llmModel.path })
      this.context = await this.model.createContext()
      this.sendLog('info', 'LLM 模型加载完成')
      return true
    } catch (err) {
      this.sendLog('error', `LLM 模型加载失败: ${err.message}`)
      this.model = null
      this.context = null
      return false
    } finally {
      this.loading = false
    }
  }

  async summarize(text) {
    if (!text || text.trim().length < 5) {
      return { summary: '', filename: this._fallbackFilename(text) }
    }

    const ready = await this._ensureModel()
    if (!ready) {
      return { summary: '', filename: this._fallbackFilename(text) }
    }

    try {
      const { LlamaChatSession } = await import('node-llama-cpp')
      const session = new LlamaChatSession({ contextSequence: this.context.getSequence() })

      const prompt = `你是一个文本总结助手。请根据以下语音转录文本，完成两个任务：
1. 用一句话总结内容（不超过50字）
2. 生成一个简短的文件名（不超过20个字符，只使用中文、英文、数字和下划线，不要扩展名）

转录文本：
${text.slice(0, 500)}

请按以下格式回复：
摘要：<一句话总结>
文件名：<文件名>`

      const response = await session.prompt(prompt, { maxTokens: 100 })

      let summary = ''
      let filename = ''

      const summaryMatch = response.match(/摘要[：:]\s*(.+?)(?:\n|$)/)
      if (summaryMatch) summary = summaryMatch[1].trim()

      const filenameMatch = response.match(/文件名[：:]\s*(.+?)(?:\n|$)/)
      if (filenameMatch) {
        filename = filenameMatch[1].trim()
          .replace(/[<>:"/\\|?*]/g, '')
          .replace(/\s+/g, '_')
          .slice(0, 20)
      }

      if (!filename) filename = this._fallbackFilename(text)

      session.dispose?.()

      return { summary, filename }
    } catch (err) {
      this.sendLog('error', `LLM 总结失败: ${err.message}`)
      return { summary: '', filename: this._fallbackFilename(text) }
    }
  }

  _fallbackFilename(text) {
    if (!text) return `录音_${this._formatDate(new Date())}`
    const clean = text.trim().slice(0, 15).replace(/[<>:"/\\|?*\s]/g, '_')
    return clean || `录音_${this._formatDate(new Date())}`
  }

  _formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}${m}${d}_${h}${min}`
  }

  async dispose() {
    if (this.context) {
      this.context.dispose?.()
      this.context = null
    }
    if (this.model) {
      this.model.dispose?.()
      this.model = null
    }
  }
}
