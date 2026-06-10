'use strict'

// Legacy stop — delegates to service manager
const service = require('./service')

if (service.isRunning()) {
  service.uninstall()
  console.log('\n  vexRTC stopped and removed from autostart.\n')
} else {
  console.log('\n  vexRTC is not running.\n')
}
