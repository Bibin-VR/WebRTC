'use strict'

const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

const PID_FILE = path.join(__dirname, '../.webrtc-remote.pid')
const ELECTRON = path.join(__dirname, '../frontend/node_modules/.bin/electron')
const MAIN = path.join(__dirname, '../frontend/electron/main.js')
const LOG_FILE = path.join(__dirname, '../.webrtc-remote.log')

if (!fs.existsSync(ELECTRON)) {
  console.error('\n  Electron not found. Run:  npm install --prefix frontend\n')
  process.exit(1)
}

const logFd = fs.openSync(LOG_FILE, 'a')

const child = spawn(ELECTRON, [MAIN], {
  detached: true,
  stdio: ['ignore', logFd, logFd],
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
})

child.unref()

fs.writeFileSync(PID_FILE, String(child.pid))

console.log('')
console.log('  Started in background (PID ' + child.pid + ')')
console.log('  Device will register in Firebase within seconds.')
console.log('')
console.log('  Commands:')
console.log('    webrtc-remote stop      Stop sharing')
console.log('    webrtc-remote status    Check if running')
console.log('')

process.exit(0)
