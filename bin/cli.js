#!/usr/bin/env node
'use strict'

const path = require('path')
const fs = require('fs')

const args = process.argv.slice(2)
const command = args[0]
const DIST = path.join(__dirname, '../frontend/dist')

function checkBuild() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('\n  Frontend not built. Run first:\n')
    console.error('    npm run build\n')
    process.exit(1)
  }
}

switch (command) {
  case 'start':
    checkBuild()
    require('./start')
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
    webrtc-remote start         Share this screen  (run on the target machine)
    webrtc-remote monitor <N>   View and control device #N  (run on your machine)

  Example workflow:
    Industrial machine:  npx webrtc-remote start      →  appears as Device #1
    Your laptop:         npx webrtc-remote monitor 1  →  connects to Device #1

  Build first (one time):
    npm run build
`)
}
