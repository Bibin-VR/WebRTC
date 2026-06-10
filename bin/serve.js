'use strict'

const { spawnSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const INSTALL_DIR = path.join(os.homedir(), '.vexrtc')
const PKG_DIR = path.join(__dirname, '..')
const NEVER_COPY = new Set(['node_modules', '.git', '.gitignore', '.webrtc-remote.pid', '.webrtc-remote.log'])

function copyPackage() {
  fs.mkdirSync(INSTALL_DIR, { recursive: true })
  fs.cpSync(PKG_DIR, INSTALL_DIR, {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = path.relative(PKG_DIR, src)
      if (!rel) return true
      const parts = rel.split(path.sep)
      return !parts.some((p) => NEVER_COPY.has(p))
    },
  })
}

// fs.rmSync throws EPERM on Windows for npm-installed dirs (read-only files).
// Use the shell command instead, which handles this correctly on every OS.
function removeDir(dirPath) {
  if (!fs.existsSync(dirPath)) return
  if (process.platform === 'win32') {
    spawnSync('cmd', ['/c', 'rd', '/s', '/q', dirPath], { stdio: 'ignore', windowsHide: true })
  } else {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
}

// Read electron/path.txt to get the binary path. Avoids require() cache issues.
// electron/index.js joins __dirname + 'dist' + path.txt, so we must too.
function getElectronBinary(frontendDir) {
  const pathFile = path.join(frontendDir, 'node_modules', 'electron', 'path.txt')
  if (!fs.existsSync(pathFile)) return null
  const rel = fs.readFileSync(pathFile, 'utf8').trim()
  const full = path.join(frontendDir, 'node_modules', 'electron', 'dist', rel)
  return fs.existsSync(full) ? full : null
}

function clearMacOSQuarantine(frontendDir) {
  if (process.platform !== 'darwin') return
  const app = path.join(frontendDir, 'node_modules', 'electron', 'dist', 'Electron.app')
  if (fs.existsSync(app)) {
    spawnSync('xattr', ['-rd', 'com.apple.quarantine', app], { stdio: 'ignore' })
  }
}

function npmInstall() {
  const frontendDir = path.join(INSTALL_DIR, 'frontend')

  if (getElectronBinary(frontendDir)) {
    console.log('[vexRTC] Dependencies already installed.')
    return
  }

  const electronDir = path.join(frontendDir, 'node_modules', 'electron')
  const installScript = path.join(electronDir, 'install.js')

  // npm sometimes restores the electron package from cache but skips the
  // postinstall binary download (path.txt absent). Run install.js directly
  // in that case — it only downloads the binary, much faster than full reinstall.
  if (fs.existsSync(installScript)) {
    console.log('[vexRTC] Electron binary missing — downloading...')
    spawnSync('node', [installScript], {
      cwd: electronDir,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '0' },
    })
    clearMacOSQuarantine(frontendDir)
    if (getElectronBinary(frontendDir)) return
    // install.js failed — delete package and do a full reinstall
    removeDir(electronDir)
  }

  console.log('[vexRTC] Installing dependencies (Electron ~120 MB)...')

  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
    env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '0' },
  })

  if (result.status !== 0) {
    console.error('[vexRTC] npm install failed. Check your internet connection.\n')
    process.exit(1)
  }

  clearMacOSQuarantine(frontendDir)

  if (!getElectronBinary(frontendDir)) {
    const electronDir2 = path.join(frontendDir, 'node_modules', 'electron')
    const manualFix = process.platform === 'win32'
      ? `cd %USERPROFILE%\\.vexrtc\\frontend\\node_modules\\electron && node install.js`
      : `cd ~/.vexrtc/frontend/node_modules/electron && node install.js`
    console.error('[vexRTC] Electron binary could not be downloaded.')
    if (process.platform === 'win32') {
      console.error('[vexRTC] Windows Defender may be blocking it — check your antivirus settings.')
    }
    console.error(`[vexRTC] Manual fix: ${manualFix}\n`)
    process.exit(1)
  }
}

function buildFrontend() {
  const distIndex = path.join(INSTALL_DIR, 'frontend', 'dist', 'index.html')
  if (fs.existsSync(distIndex)) {
    console.log('[vexRTC] Frontend already built.')
    return
  }
  console.log('[vexRTC] Building frontend...')
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: INSTALL_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  })
  if (result.status !== 0) {
    console.error('[vexRTC] Frontend build failed.\n')
    process.exit(1)
  }
}

module.exports = function serve() {
  // Re-spawn as a completely detached background process so the calling
  // terminal is freed immediately. All install output goes to install.log.
  if (!process.env.VEXRTC_BG) {
    fs.mkdirSync(INSTALL_DIR, { recursive: true })
    const logFile = path.join(INSTALL_DIR, 'install.log')
    const logFd = fs.openSync(logFile, 'w')

    const child = spawn(process.execPath, process.argv.slice(1), {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
      env: { ...process.env, VEXRTC_BG: '1' },
    })
    child.unref()
    fs.closeSync(logFd)

    const logPath = process.platform === 'win32'
      ? '%USERPROFILE%\\.vexrtc\\install.log'
      : '~/.vexrtc/install.log'

    console.log('')
    console.log('  ┌──────────────────────────────────────────────┐')
    console.log('  │   vexRTC  ·  Screen Share Setup              │')
    console.log('  └──────────────────────────────────────────────┘')
    console.log('')
    console.log('  Installing in the background.')
    console.log('  First run downloads Electron (~120 MB) — takes 1-2 min.')
    console.log(`  Progress: ${logPath}`)
    console.log('  Status:   npx vexrtc -status')
    console.log('  Stop:     npx vexrtc -stop')
    console.log('')
    console.log('  You can close this terminal.')
    console.log('')
    process.exit(0)
  }

  // ── Background worker: perform the actual installation ──────────────────
  const service = require('./service')

  if (service.isRunning()) {
    console.log('[vexRTC] Already running.')
    process.exit(0)
  }

  console.log('[vexRTC] [1/4] Copying files...')
  copyPackage()

  console.log('[vexRTC] [2/4] Checking dependencies...')
  npmInstall()

  console.log('[vexRTC] [3/4] Checking frontend build...')
  buildFrontend()

  console.log('[vexRTC] [4/4] Registering autostart service...')
  service.install()

  console.log('[vexRTC] Done. vexRTC is running in the background.')
  console.log('[vexRTC] Daemon log: ' + path.join(INSTALL_DIR, 'daemon.log'))
}
