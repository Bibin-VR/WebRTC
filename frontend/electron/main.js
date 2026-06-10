import { app, desktopCapturer, BrowserWindow, ipcMain, session } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Hide from dock (macOS) and taskbar
if (app.dock) app.dock.hide()
app.commandLine.appendSwitch('disable-renderer-backgrounding')
// Expose real IPs in ICE candidates — mDNS obfuscation breaks same-machine WebRTC
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns')

app.whenReady().then(async () => {
  // Grant screen capture permission automatically — no picker dialog
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (!sources.length) { callback({}); return }
      callback({ video: sources[0] }) // audio loopback omitted — macOS requires extra drivers
    }).catch((err) => {
      console.error('[daemon] getSources failed:', err.message)
      callback({})
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

  // Forward all renderer console output to this process (and therefore to daemon.log)
  const levels = ['verbose', 'info', 'warn', 'error']
  win.webContents.on('console-message', (_e, level, message) => {
    console.log(`[renderer:${levels[level] ?? level}] ${message}`)
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
