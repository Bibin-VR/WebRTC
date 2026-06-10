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

function isElectronBinaryInstalled(frontendDir) {
  try {
    // require('electron') returns the path to the actual binary.
    // If the post-install download was skipped or failed, this throws.
    const electronExe = require(path.join(frontendDir, 'node_modules', 'electron'))
    return fs.existsSync(electronExe)
  } catch {
    return false
  }
}

function npmInstall() {
  const frontendDir = path.join(INSTALL_DIR, 'frontend')

  if (isElectronBinaryInstalled(frontendDir)) {
    console.log('  Dependencies already installed.')
    return
  }

  // node_modules/electron folder may exist but the binary was never downloaded.
  // Remove it so npm re-runs the post-install binary download.
  const electronDir = path.join(frontendDir, 'node_modules', 'electron')
  if (fs.existsSync(electronDir)) {
    console.log('  Electron binary missing — re-downloading (this can take a minute)...')
    fs.rmSync(electronDir, { recursive: true, force: true })
  } else {
    console.log('  Installing dependencies (downloading Electron ~120 MB, please wait)...')
  }

  const result = spawnSync('npm', ['install', '--prefer-offline', '--no-audit', '--no-fund'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '0' },
  })

  if (result.status !== 0) {
    console.error('\n  npm install failed. Check your internet connection and try again.\n')
    process.exit(1)
  }

  if (!isElectronBinaryInstalled(frontendDir)) {
    console.error('\n  Electron downloaded but binary still missing.')
    console.error('  On Windows: antivirus / Windows Defender may be blocking the download.')
    console.error(`  Manual fix: cd ${path.join(INSTALL_DIR, 'frontend')} && npm install\n`)
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
