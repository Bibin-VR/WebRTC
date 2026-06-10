import { app, desktopCapturer, BrowserWindow, ipcMain, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Hide from dock (macOS) and taskbar
if (app.dock) app.dock.hide()
app.commandLine.appendSwitch('disable-renderer-backgrounding')

app.whenReady().then(async () => {
  // Grant screen capture permission automatically — no picker dialog
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      callback({ video: sources[0], audio: 'loopback' })
    })
  })

  // Hidden window — Electron needs a renderer for WebRTC
  const win = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // HashRouter expects the hash in the form #/target
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/target' })
  // Result: file:///path/to/dist/index.html#/target — HashRouter routes this to <TargetPage />

  console.log('[daemon] Screen sharing active.')
})

// Keep running even if window is destroyed
app.on('window-all-closed', (e) => e.preventDefault())

process.on('SIGTERM', () => { console.log('[daemon] Stopping.'); app.quit() })
process.on('SIGINT', () => { console.log('[daemon] Stopping.'); app.quit() })
