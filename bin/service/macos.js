'use strict'

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const INSTALL_DIR = path.join(os.homedir(), '.vexrtc')
const PLIST_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents')
const PLIST_FILE = path.join(PLIST_DIR, 'com.vexrtc.serve.plist')

function electronPath() {
  const electronDir = path.join(INSTALL_DIR, 'frontend', 'node_modules', 'electron')
  const pathFile = path.join(electronDir, 'path.txt')
  if (!fs.existsSync(pathFile)) {
    console.error('\n  Electron is not installed. Run "npx vexrtc -serve" to install it.\n')
    process.exit(1)
  }
  const rel = fs.readFileSync(pathFile, 'utf8').trim()
  const full = path.join(electronDir, rel)
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

  fs.mkdirSync(PLIST_DIR, { recursive: true })

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.vexrtc.serve</string>
  <key>ProgramArguments</key>
  <array>
    <string>${electron}</string>
    <string>${mainJs}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>ELECTRON_DISABLE_SECURITY_WARNINGS</key>
    <string>1</string>
    <key>HOME</key>
    <string>${os.homedir()}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logFile}</string>
  <key>StandardErrorPath</key>
  <string>${logFile}</string>
</dict>
</plist>
`

  fs.writeFileSync(PLIST_FILE, plist)
  try { execSync(`launchctl unload "${PLIST_FILE}" 2>/dev/null`) } catch { /* ignore if not loaded */ }
  execSync(`launchctl load "${PLIST_FILE}"`)
}

function uninstall() {
  try { execSync(`launchctl unload "${PLIST_FILE}"`) } catch { /* ignore */ }
  try { fs.unlinkSync(PLIST_FILE) } catch { /* ignore */ }
}

function isRunning() {
  if (!fs.existsSync(PLIST_FILE)) return false
  try {
    const out = execSync('launchctl list com.vexrtc.serve', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // Old tabular format (macOS < 12): "1234  0  com.vexrtc.serve"
    // New dict format (macOS 12+):     "PID" = 12345;
    return /^\s*\d+\s/m.test(out) || /"PID"\s*=\s*\d+/.test(out)
  } catch { return false }
}

module.exports = { install, uninstall, isRunning }
