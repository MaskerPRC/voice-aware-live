export class LLMService {
  constructor(modelManager, sendLog) {
    this.modelManager = modelManager
    this.sendLog = sendLog
    this.model = null
    this.context = null
    this.loadedModelId = null
    this.loading = false
    this.busy = false
  }

  async _ensureModel(preferredId) {
    if (this.model && this.context) {
      // 如果 preferred 变了，重新加载
      if (preferredId && this.loadedModelId && preferredId !== this.loadedModelId) {
        this.sendLog('info', `LLM 模型已切换 (${this.loadedModelId} → ${preferredId})，重新加载…`)
        await this.dispose()
      } else {
        return true
      }
    }
    if (this.loading) return false

    const llmModel = this.modelManager.getDefaultLLMModel(preferredId)
    if (!llmModel) {
      this.sendLog('warn', '没有可用的 LLM 模型，将使用默认文件名')
      return false
    }

    this.loading = true
    try {
      this.sendLog('info', `正在加载 LLM 模型 (${llmModel.id})…`)
      const { getLlama } = await import('node-llama-cpp')
      const llama = await getLlama()
      this.model = await llama.loadModel({ modelPath: llmModel.path })
      this.context = await this.model.createContext()
      this.loadedModelId = llmModel.id
      this.sendLog('info', 'LLM 模型加载完成')
      return true
    } catch (err) {
      this.sendLog('error', `LLM 模型加载失败: ${err.message}`)
      this.model = null
      this.context = null
      this.loadedModelId = null
      return false
    } finally {
      this.loading = false
    }
  }

  async summarize(text, preferredModelId) {
    if (!text || text.trim().length < 5) {
      return { summary: '', filename: this._fallbackFilename(text) }
    }

    if (this.busy) {
      this.sendLog('warn', 'LLM 正忙，跳过此次总结')
      return { summary: '', filename: this._fallbackFilename(text) }
    }

    const ready = await this._ensureModel(preferredModelId)
    if (!ready) {
      return { summary: '', filename: this._fallbackFilename(text) }
    }

    this.busy = true
    const t0 = Date.now()
    this.sendLog('debug', `[LLM] 开始总结 (text="${text.slice(0, 40)}…", len=${text.length})`)
    try {
      const { LlamaChatSession } = await import('node-llama-cpp')
      const session = new LlamaChatSession({ contextSequence: this.context.getSequence() })
      this.sendLog('debug', '[LLM] getSequence 成功，发送 prompt…')

      const prompt = `你是一个文本总结助手。请根据以下语音转录文本，完成两个任务：
1. 用一句话总结内容（不超过50字）
2. 生成一个简短的文件名（不超过20个字符，只使用中文、英文、数字和下划线，不要扩展名）

转录文本：
${text.slice(0, 500)}

请按以下格式回复：
摘要：<一句话总结>
文件名：<文件名>`

      const response = await session.prompt(prompt, { maxTokens: 100 })
      this.sendLog('debug', `[LLM] 原始回复: "${response.slice(0, 120)}"`)

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

      if (typeof session.dispose === 'function') await session.dispose()
      // 每次用完释放 context 并重建，避免 "No sequences left"
      await this._recycleContext()

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      this.sendLog('debug', `[LLM] 完成 耗时=${elapsed}s, summary="${summary.slice(0, 30)}", filename="${filename}"`)
      return { summary, filename }
    } catch (err) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      this.sendLog('error', `[LLM] 总结失败 (耗时=${elapsed}s): ${err.message}`)
      // sequence 泄漏时重建 context，下次调用可恢复
      await this._recycleContext()
      return { summary: '', filename: this._fallbackFilename(text) }
    } finally {
      this.busy = false
    }
  }

  async _recycleContext() {
    try {
      if (this.context) {
        if (typeof this.context.dispose === 'function') await this.context.dispose()
        this.context = null
      }
      if (this.model) {
        this.context = await this.model.createContext()
      }
    } catch (err) {
      this.sendLog('error', `[LLM] context 重建失败: ${err.message}`)
      this.context = null
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
