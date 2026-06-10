'use strict'

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const INSTALL_DIR = path.join(os.homedir(), '.vexrtc')
// When run via npx, __dirname is inside the npx cache. Walk up to package root.
const PKG_DIR = path.join(__dirname, '..')

// Never copy these — they're large and will be (re)installed or auto-generated
const NEVER_COPY = new Set(['node_modules', '.git', '.gitignore', '.webrtc-remote.pid', '.webrtc-remote.log'])

function copyPackage() {
  // Create if missing; do NOT wipe INSTALL_DIR so existing node_modules are preserved
  fs.mkdirSync(INSTALL_DIR, { recursive: true })

  fs.cpSync(PKG_DIR, INSTALL_DIR, {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = path.relative(PKG_DIR, src)
      if (!rel) return true // the root directory itself
      const parts = rel.split(path.sep)
      return !parts.some((p) => NEVER_COPY.has(p))
    },
  })
}

// Read electron/path.txt to get the actual binary path — avoids require() cache issues.
function getElectronBinary(frontendDir) {
  const pathFile = path.join(frontendDir, 'node_modules', 'electron', 'path.txt')
  if (!fs.existsSync(pathFile)) return null
  const rel = fs.readFileSync(pathFile, 'utf8').trim()
  const full = path.join(frontendDir, 'node_modules', 'electron', rel)
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
    console.log('  Dependencies already installed.')
    return
  }

  const electronDir = path.join(frontendDir, 'node_modules', 'electron')
  const installScript = path.join(electronDir, 'install.js')

  // npm sometimes restores the electron package from cache but skips the
  // postinstall download step, leaving path.txt absent. In that case we can
  // run install.js directly without a full npm install cycle.
  if (fs.existsSync(installScript)) {
    console.log('  Electron binary missing — downloading (please wait)...')
    spawnSync('node', [installScript], {
      cwd: electronDir,
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '0' },
    })
    clearMacOSQuarantine(frontendDir)
    if (getElectronBinary(frontendDir)) return
    // install.js failed — delete the package and do a full reinstall
    fs.rmSync(electronDir, { recursive: true, force: true })
  }

  console.log('  Installing dependencies (downloading Electron ~120 MB, please wait)...')

  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '0' },
  })

  if (result.status !== 0) {
    console.error('\n  npm install failed. Check your internet connection and try again.\n')
    process.exit(1)
  }

  clearMacOSQuarantine(frontendDir)

  if (!getElectronBinary(frontendDir)) {
    const fixCmd =
      process.platform === 'win32'
        ? `cd %USERPROFILE%\\.vexrtc\\frontend\\node_modules\\electron && node install.js`
        : `cd ~/.vexrtc/frontend/node_modules/electron && node install.js`
    console.error('\n  Electron binary could not be downloaded.')
    if (process.platform === 'win32') {
      console.error('  Windows Defender / antivirus may be blocking the download.')
    } else if (process.platform === 'darwin') {
      console.error('  macOS may have blocked the download. Check your network and try again.')
    }
    console.error(`  Manual fix: ${fixCmd}\n`)
    process.exit(1)
  }
}

function buildFrontend() {
  const distIndex = path.join(INSTALL_DIR, 'frontend', 'dist', 'index.html')

  if (fs.existsSync(distIndex)) {
    console.log('  Frontend already built.')
    return
  }

  console.log('  Building frontend...')

  const result = spawnSync('npm', ['run', 'build'], {
    cwd: INSTALL_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.status !== 0) {
    console.error('\n  Frontend build failed.\n')
    process.exit(1)
  }
}

module.exports = function serve() {
  const service = require('./service')

  console.log('')
  console.log('  ┌──────────────────────────────────────────────┐')
  console.log('  │   vexRTC  ·  Screen Share Setup              │')
  console.log('  └──────────────────────────────────────────────┘')
  console.log('')

  if (service.isRunning()) {
    console.log('  Already running.')
    console.log('  Use "npx vexrtc -stop" to stop the daemon first.\n')
    process.exit(0)
  }

  console.log('  [1/4] Copying files to ~/.vexrtc/ ...')
  copyPackage()
  console.log('  Done.\n')

  console.log('  [2/4] Checking dependencies...')
  npmInstall()
  console.log('')

  console.log('  [3/4] Checking frontend build...')
  buildFrontend()
  console.log('')

  console.log('  [4/4] Registering autostart service...')
  service.install()
  console.log('')

  console.log('  ✓  vexRTC is running in the background.')
  console.log('  ✓  Auto-starts on every reboot.')
  console.log('')
  console.log('  Logs:    ~/.vexrtc/daemon.log')
  console.log('  Stop:    npx vexrtc -stop')
  console.log('  Watch:   npx vexrtc -monitor 1')
  console.log('')
}
