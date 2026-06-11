import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api, AppUpdateInfo, PrefillInput, SavePayload } from '../shared/types'

// Mirrors the web app's server actions. Every method round-trips through
// ipcMain.handle in src/main/ipc.ts and returns the same discriminated
// union shapes the original actions did.
const api: Api = {
  fetchVideoInfo: (url) => ipcRenderer.invoke('fetchVideoInfo', url),
  fetchVideoDuration: (url) => ipcRenderer.invoke('fetchVideoDuration', url),
  prefillMetadata: (input: PrefillInput) => ipcRenderer.invoke('prefillMetadata', input),
  saveFile: (payload: SavePayload) => ipcRenderer.invoke('saveFile', payload),
  pickFolder: () => ipcRenderer.invoke('pickFolder'),
  readLastFolder: () => ipcRenderer.invoke('readLastFolder'),
  setLastFolder: (folder) => ipcRenderer.invoke('setLastFolder', folder),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  hasGeminiKey: () => ipcRenderer.invoke('hasGeminiKey'),
  setGeminiKey: (key) => ipcRenderer.invoke('setGeminiKey', key),
  isOnboarded: () => ipcRenderer.invoke('isOnboarded'),
  setOnboarded: () => ipcRenderer.invoke('setOnboarded'),
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update-available', (_e, info: AppUpdateInfo) => cb(info))
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
