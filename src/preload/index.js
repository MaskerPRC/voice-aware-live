import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // 录音控制
  startRecording: () => ipcRenderer.invoke('recording:start'),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
  sendAudioData: (data) => ipcRenderer.send('audio:data', data),

  // 转录结果监听
  onTranscriptionPartial: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('transcription:partial', handler)
    return () => ipcRenderer.removeListener('transcription:partial', handler)
  },
  onTranscriptionSegment: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('transcription:segment', handler)
    return () => ipcRenderer.removeListener('transcription:segment', handler)
  },
  onAudioLevel: (cb) => {
    const handler = (_e, level) => cb(level)
    ipcRenderer.on('audio:level', handler)
    return () => ipcRenderer.removeListener('audio:level', handler)
  },

  // 模型管理
  getModels: () => ipcRenderer.invoke('models:list'),
  downloadModel: (modelId) => ipcRenderer.invoke('models:download', modelId),
  cancelDownload: (modelId) => ipcRenderer.invoke('models:cancel-download', modelId),
  deleteModel: (modelId) => ipcRenderer.invoke('models:delete', modelId),
  selectModel: (modelId) => ipcRenderer.invoke('models:select', modelId),
  onModelDownloadProgress: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('model:download-progress', handler)
    return () => ipcRenderer.removeListener('model:download-progress', handler)
  },

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  selectFile: (filters) => ipcRenderer.invoke('dialog:select-file', filters),

  // 历史记录
  getHistory: () => ipcRenderer.invoke('history:list'),
  getTranscript: (id) => ipcRenderer.invoke('history:get', id),
  deleteTranscript: (id) => ipcRenderer.invoke('history:delete', id),
  openTranscriptFolder: (id) => ipcRenderer.invoke('history:open-folder', id),

  // 日志
  onLog: (cb) => {
    const handler = (_e, msg) => cb(msg)
    ipcRenderer.on('log:message', handler)
    return () => ipcRenderer.removeListener('log:message', handler)
  },

  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close')
}

contextBridge.exposeInMainWorld('api', api)
