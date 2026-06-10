#!/usr/bin/env node
'use strict'

const args = process.argv.slice(2)
const command = args[0]

switch (command) {
  case '-serve':
    require('./serve')().catch((err) => { console.error('\n ' + err.message); process.exit(1) })
    break

  case '-stop': {
    const service = require('./service')
    if (!service.isRunning()) {
      console.log('\n  vexRTC is not running.\n')
      process.exit(0)
    }
    service.uninstall()
    console.log('\n  vexRTC stopped and removed from autostart.\n')
    break
  }

  case '-status': {
    const service = require('./service')
    if (service.isRunning()) {
      console.log('\n  vexRTC is running.\n')
    } else {
      console.log('\n  vexRTC is not running.\n')
    }
    break
  }

  case '-monitor': {
    const slot = parseInt(args[1]) || 1
    if (slot < 1) {
      console.error('\n  Usage:  npx vexrtc -monitor [device-number]\n')
      process.exit(1)
    }
    require('./monitor')(slot)
    break
  }

  default:
    console.log(`
  vexRTC — zero-auth remote screen sharing via WebRTC + Firebase

  Commands:
    -serve            Install and start screen sharing daemon (auto-starts on reboot)
    -stop             Stop daemon and remove from autostart
    -status           Check if daemon is running
    -monitor [N]      Open monitor UI for device #N (default: 1)

  Example workflow:
    Target machine:   npx vexrtc -serve        (installs once, runs forever)
    Monitor machine:  npx vexrtc -monitor 1    (connect to device #1)
    Target machine:   npx vexrtc -stop         (stop sharing)
`)
}
