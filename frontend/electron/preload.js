// Preload must be CommonJS — Electron loads it before the renderer module system starts.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  isElectron: true,
})
