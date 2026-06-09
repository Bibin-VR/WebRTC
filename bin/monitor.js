'use strict'

const { startServer } = require('./server')
const open = require('open')

module.exports = async function startMonitor(slot) {
  const { port } = await startServer()
  const url = `http://127.0.0.1:${port}/monitor/${slot}`

  console.log('')
  console.log('  ┌──────────────────────────────────────────┐')
  console.log('  │   WebRTC Remote  ·  Monitor Mode          │')
  console.log(`  │   Connecting to Device #${String(slot).padEnd(17)} │`)
  console.log(`  │   ${url.padEnd(41)} │`)
  console.log('  │   Press Ctrl+C to disconnect              │')
  console.log('  └──────────────────────────────────────────┘')
  console.log('')

  await open(url)
}
