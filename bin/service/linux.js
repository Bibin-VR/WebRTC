'use strict'

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const INSTALL_DIR = path.join(os.homedir(), '.vexrtc')
const SERVICE_DIR = path.join(os.homedir(), '.config', 'systemd', 'user')
const SERVICE_FILE = path.join(SERVICE_DIR, 'vexrtc.service')

function electronPath() {
  const electronDir = path.join(INSTALL_DIR, 'frontend', 'node_modules', 'electron')
  const pathFile = path.join(electronDir, 'path.txt')
  if (!fs.existsSync(pathFile)) {
    console.error('\n  Electron is not installed. Run "npx vexrtc -serve" to install it.\n')
    process.exit(1)
  }
  const rel = fs.readFileSync(pathFile, 'utf8').trim()
  const full = path.join(electronDir, 'dist', rel)
  if (!fs.existsSync(full)) {
    console.error('\n  Electron binary missing. Run "npx vexrtc -serve" to re-download.\n')
    process.exit(1)
  }
  return full
}

function install() {
  const electron = electronPath()
  const mainJs = path.join(INSTALL_DIR, 'frontend', 'electron', 'main.js')
  const logFile = path.join(INSTALL_DIR, 'daemon.log')

  fs.mkdirSync(SERVICE_DIR, { recursive: true })

  const unit = [
    '[Unit]',
    'Description=vexRTC Screen Sharing Daemon',
    'After=network-online.target',
    '',
    '[Service]',
    'Type=simple',
    `ExecStart=${electron} ${mainJs}`,
    'Restart=always',
    'RestartSec=5',
    `StandardOutput=append:${logFile}`,
    `StandardError=append:${logFile}`,
    'Environment=ELECTRON_DISABLE_SECURITY_WARNINGS=1',
    '',
    '[Install]',
    'WantedBy=default.target',
  ].join('\n')

  fs.writeFileSync(SERVICE_FILE, unit)

  run('systemctl --user daemon-reload')
  run('systemctl --user enable vexrtc')
  run('systemctl --user start vexrtc')

  // Allow daemon to keep running when user is not logged in
  try { run(`loginctl enable-linger ${os.userInfo().username}`) } catch { /* non-fatal */ }
}

function uninstall() {
  try { run('systemctl --user stop vexrtc') } catch { /* ignore */ }
  try { run('systemctl --user disable vexrtc') } catch { /* ignore */ }
  try { fs.unlinkSync(SERVICE_FILE) } catch { /* ignore */ }
  try { run('systemctl --user daemon-reload') } catch { /* ignore */ }
}

function isRunning() {
  try {
    const out = execSync('systemctl --user is-active vexrtc', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim() === 'active'
  } catch { return false }
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

module.exports = { install, uninstall, isRunning }
