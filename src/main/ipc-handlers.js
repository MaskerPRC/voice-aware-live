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
      const remaining = audioProcessor.stop()
      if (remaining) {
        await handleSegmentReady(remaining.buffer, remaining.info)
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
    return modelManager.listModels()
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
  try {
    sendLog('info', `处理语音片段: ${(segmentInfo.duration / 1000).toFixed(1)}s`)

    const settings = fileService.getSettings()
    const result = await whisperService.transcribe(audioBuffer, segmentInfo, settings)
    if (!result || !result.text || result.text.trim().length === 0) {
      sendLog('warn', '片段无有效文本，跳过')
      return
    }

    let filename = `segment_${Date.now()}`
    try {
      const summary = await llmService.summarize(result.text)
      if (summary && summary.filename) {
        filename = summary.filename
      }
      result.summary = summary?.summary || ''
    } catch (err) {
      sendLog('warn', `LLM 总结失败，使用默认文件名: ${err.message}`)
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
    sendLog('error', `处理片段失败: ${err.message}`)
  }
}

async function handlePartialAudio(audioBuffer) {
  try {
    const settings = fileService.getSettings()
    const result = await whisperService.transcribe(audioBuffer, { partial: true }, settings)
    if (result && result.text && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription:partial', result)
    }
  } catch {
    // partial results are best-effort
  }
}
