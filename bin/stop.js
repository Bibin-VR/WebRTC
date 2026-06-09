'use strict'

const fs = require('fs')
const path = require('path')

const PID_FILE = path.join(__dirname, '../.webrtc-remote.pid')

const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'))

try {
  process.kill(pid, 'SIGTERM')
  console.log('\n  Stopped (PID ' + pid + ')\n')
} catch {
  console.log('\n  Process already stopped.\n')
}

fs.unlinkSync(PID_FILE)
