'use strict'

const { app, desktopCapturer, BrowserWindow, ipcMain, session, systemPreferences } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

if (app.dock) app.dock.hide()
app.commandLine.appendSwitch('disable-renderer-backgrounding')
// Expose real local IPs in ICE candidates — mDNS obfuscation breaks same-machine WebRTC
app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns')

// Let the renderer request the config file (passwordHash etc.) without
// needing nodeIntegration — avoids exposing the filesystem broadly.
ipcMain.handle('get-config', () => {
  const configPath = path.join(os.homedir(), '.vexrtc', 'config.json')
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { return {} }
})

app.whenReady().then(async () => {
  // Auto-capture the primary screen without showing a picker dialog
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      if (!sources.length) {
        if (process.platform === 'darwin') {
          const status = systemPreferences.getMediaAccessStatus('screen')
          if (status !== 'granted') {
            console.error(`[daemon] Screen Recording permission is "${status}".`)
            console.error('[daemon] Fix: System Settings → Privacy & Security → Screen Recording → enable Electron')
          }
        }
        callback({})
        return
      }
      callback({ video: sources[0] })
    }).catch((err) => {
      console.error('[daemon] getSources failed:', err.message)
      callback({})
    })
  })

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

  // Forward renderer console output to daemon.log
  const levels = ['verbose', 'info', 'warn', 'error']
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const loc = (level >= 3 && line) ? ` (${sourceId?.split('/').pop()}:${line})` : ''
    console.log(`[renderer:${levels[level] ?? level}] ${message}${loc}`)
  })

  // HashRouter: file:///.../index.html#/target → TargetPage
  await win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/target' })

  console.log('[daemon] Screen sharing active.')
})

app.on('window-all-closed', (e) => e.preventDefault())

process.on('SIGTERM', () => { console.log('[daemon] Stopping.'); app.quit() })
process.on('SIGINT',  () => { console.log('[daemon] Stopping.'); app.quit() })
