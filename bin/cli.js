#!/usr/bin/env node
'use strict'

const path = require('path')
const fs = require('fs')

const args = process.argv.slice(2)
const command = args[0]
const DIST = path.join(__dirname, '../frontend/dist')
const PID_FILE = path.join(__dirname, '../.webrtc-remote.pid')

function checkBuild() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('\n  Frontend not built. Run first:\n')
    console.error('    npm run build\n')
    process.exit(1)
  }
}

function isRunning(pid) {
  try { process.kill(pid, 0); return true } catch { return false }
}

switch (command) {
  case 'start':
    checkBuild()
    if (fs.existsSync(PID_FILE)) {
      const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf8'))
      if (isRunning(oldPid)) {
        console.log('\n  Already running (PID ' + oldPid + '). Use "stop" first.\n')
        process.exit(0)
      }
      fs.unlinkSync(PID_FILE)
    }
    require('./start')
    break

  case 'stop':
    if (!fs.existsSync(PID_FILE)) {
      console.log('\n  Not running.\n')
      process.exit(0)
    }
    require('./stop')
    break

  case 'status':
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'))
      if (isRunning(pid)) {
        console.log('\n  Running (PID ' + pid + ')\n')
      } else {
        fs.unlinkSync(PID_FILE)
        console.log('\n  Not running (stale PID file removed).\n')
      }
    } else {
      console.log('\n  Not running.\n')
    }
    break

  case 'monitor': {
    checkBuild()
    const slot = parseInt(args[1])
    if (!slot || slot < 1) {
      console.error('\n  Usage:  webrtc-remote monitor <device-number>\n')
      console.error('  Example: webrtc-remote monitor 1\n')
      process.exit(1)
    }
    require('./monitor')(slot)
    break
  }

  default:
    console.log(`
  webrtc-remote — zero-auth remote screen sharing

  Commands:
    start          Share this screen silently (hidden background process)
    stop           Stop sharing and kill the background process
    status         Check if the background process is running
    monitor <N>    View and control device #N

  Example workflow:
    Industrial machine:  npx webrtc-remote start        (silently starts sharing)
    Your laptop:         npx webrtc-remote monitor 1    (connects to device #1)
    Industrial machine:  npx webrtc-remote stop         (stops sharing)
`)
}
