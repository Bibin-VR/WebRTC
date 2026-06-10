'use strict'

const platform = process.platform

let svc
if (platform === 'linux') {
  svc = require('./linux')
} else if (platform === 'darwin') {
  svc = require('./macos')
} else if (platform === 'win32') {
  svc = require('./windows')
} else {
  console.error(`\n  Unsupported platform: ${platform}\n`)
  process.exit(1)
}

module.exports = svc
