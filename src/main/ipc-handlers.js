import { ipcMain, dialog, shell } from 'electron'
import { WhisperService } from './services/whisper-service'
import { LLMService } from './services/llm-service'
import { AudioProcessor } from './services/audio-processor'
import { FileService } from './services/file-service'
import { ModelManager } from './services/model-manager'

let whisperService
let llmService
let audioProcessor
let fileService
let modelManager
let mainWindow

function sendLog(level, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log:message', {
      level,
      message,
      timestamp: Date.now()
    })
  }
}

export function registerIpcHandlers(win) {
  mainWindow = win

  fileService = new FileService(sendLog)
  modelManager = new ModelManager(sendLog)
  whisperService = new WhisperService(modelManager, sendLog)
  llmService = new LLMService(modelManager, sendLog)
  audioProcessor = new AudioProcessor({
    onSegmentReady: async (audioBuffer, segmentInfo) => {
      await handleSegmentReady(audioBuffer, segmentInfo)
    },
    onPartialAudio: async (audioBuffer) => {
      await handlePartialAudio(audioBuffer)
    },
    onAudioLevel: (level) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('audio:level', level)
      }
    },
    sendLog
  })

  // 录音控制
  ipcMain.handle('recording:start', async () => {
    try {
      const settings = fileService.getSettings()
      audioProcessor.configure({
        silenceThreshold: settings.silenceThreshold || 0.01,
        silenceDuration: settings.silenceDuration || 2000,
        sampleRate: 16000
      })
      audioProcessor.start()
      sendLog('info', '录音已开始')
      return { success: true }
    } catch (err) {
      sendLog('error', `启动录音失败: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('recording:stop', async () => {
    try {
      sendLog('debug', `[recording:stop] whisper.busy=${whisperService.busy}`)
      const remaining = audioProcessor.stop()
      if (remaining) {
        sendLog('debug', `[recording:stop] 剩余片段 duration=${(remaining.info.duration / 1000).toFixed(1)}s, samples=${remaining.buffer.length}`)
        // 不阻塞 — 后台处理剩余片段，UI 立即返回
        handleSegmentReady(remaining.buffer, remaining.info).catch((err) => {
          sendLog('error', `[recording:stop] 剩余片段处理失败: ${err.message}`)
        })
      } else {
        sendLog('debug', '[recording:stop] 无剩余片段')
      }
      sendLog('info', '录音已停止')
      return { success: true }
    } catch (err) {
      sendLog('error', `停止录音失败: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  // 接收音频数据
  ipcMain.on('audio:data', (_event, data) => {
    audioProcessor.processAudioData(data)
  })

  // 模型管理
  ipcMain.handle('models:list', async () => {
    const settings = fileService.getSettings()
    const models = modelManager.listModels()
    return models.map((m) => ({
      ...m,
      selected: (m.type === 'whisper' && m.id === settings.whisperModel) ||
                (m.type === 'llm' && m.id === settings.llmModel)
    }))
  })

  ipcMain.handle('models:select', async (_event, modelId) => {
    const models = modelManager.listModels()
    const model = models.find((m) => m.id === modelId)
    if (!model) return { success: false, error: '未找到模型' }
    if (model.type === 'whisper') {
      fileService.saveSettings({ whisperModel: modelId })
    } else if (model.type === 'llm') {
      fileService.saveSettings({ llmModel: modelId })
    }
    return { success: true }
  })

  ipcMain.handle('models:download', async (_event, modelId) => {
    try {
      await modelManager.downloadModel(modelId, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('model:download-progress', {
            modelId,
            ...progress
          })
        }
      })
      sendLog('info', `模型 ${modelId} 下载完成`)
      return { success: true }
    } catch (err) {
      sendLog('error', `模型下载失败: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('models:cancel-download', async (_event, modelId) => {
    modelManager.cancelDownload(modelId)
    return { success: true }
  })

  ipcMain.handle('models:delete', async (_event, modelId) => {
    try {
      await modelManager.deleteModel(modelId)
      sendLog('info', `模型 ${modelId} 已删除`)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // 设置
  ipcMain.handle('settings:get', () => {
    return fileService.getSettings()
  })

  ipcMain.handle('settings:set', async (_event, settings) => {
    fileService.saveSettings(settings)
    return { success: true }
  })

  ipcMain.handle('dialog:select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:select-file', async (_event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [{ name: '可执行文件', extensions: ['exe', '*'] }]
    })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  // 历史记录
  ipcMain.handle('history:list', () => {
    return fileService.listTranscripts()
  })

  ipcMain.handle('history:get', (_event, id) => {
    return fileService.getTranscript(id)
  })

  ipcMain.handle('history:delete', (_event, id) => {
    fileService.deleteTranscript(id)
    return { success: true }
  })

  ipcMain.handle('history:open-folder', (_event, id) => {
    const path = fileService.getTranscriptFolder(id)
    if (path) shell.openPath(path)
    return { success: true }
  })

  // 窗口控制
  ipcMain.on('window:minimize', () => mainWindow.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow.close())
}

async function handleSegmentReady(audioBuffer, segmentInfo) {
  const t0 = Date.now()
  sendLog('debug', `[handleSegmentReady] 进入 duration=${(segmentInfo.duration / 1000).toFixed(1)}s, whisper.busy=${whisperService.busy}`)
  try {
    sendLog('info', `处理语音片段: ${(segmentInfo.duration / 1000).toFixed(1)}s`)

    const settings = fileService.getSettings()
    const result = await whisperService.transcribe(audioBuffer, segmentInfo, settings)
    if (!result || !result.text || result.text.trim().length === 0) {
      sendLog('warn', '片段无有效文本，跳过')
      return
    }

    let filename = `segment_${Date.now()}`
    if (settings.enableLLM !== false) {
      try {
        const summary = await llmService.summarize(result.text, settings.llmModel)
        if (summary && summary.filename) {
          filename = summary.filename
        }
        result.summary = summary?.summary || ''
      } catch (err) {
        sendLog('warn', `LLM 总结失败，使用默认文件名: ${err.message}`)
      }
    }

    const saved = fileService.saveSegment(result, filename, segmentInfo)
    sendLog('info', `已保存: ${saved.filename}`)

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription:segment', {
        ...result,
        filename: saved.filename,
        filepath: saved.filepath,
        segmentInfo
      })
    }
  } catch (err) {
    sendLog('error', `[handleSegmentReady] 处理失败: ${err.message}`)
  } finally {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    sendLog('debug', `[handleSegmentReady] 结束 总耗时=${elapsed}s，重置 partial 计时器`)
    // Push the partial-audio timer out so it doesn't fire while Whisper is still busy
    audioProcessor.resetPartialTimer()
  }
}

async function handlePartialAudio(audioBuffer) {
  if (whisperService.busy) {
    sendLog('debug', `[handlePartialAudio] whisper busy，跳过 partial (samples=${audioBuffer.length})`)
    return
  }
  try {
    sendLog('debug', `[handlePartialAudio] 开始 (samples=${audioBuffer.length}, ${(audioBuffer.length / 16000).toFixed(1)}s)`)
    const settings = fileService.getSettings()
    const result = await whisperService.transcribe(audioBuffer, { partial: true }, settings)
    if (result && result.text && mainWindow && !mainWindow.isDestroyed()) {
      sendLog('debug', `[handlePartialAudio] 完成，文字="${result.text.slice(0, 60)}"`)
      mainWindow.webContents.send('transcription:partial', result)
    } else {
      sendLog('debug', '[handlePartialAudio] 完成，无文字')
    }
  } catch (err) {
    sendLog('debug', `[handlePartialAudio] 异常: ${err.message}`)
  }
}
