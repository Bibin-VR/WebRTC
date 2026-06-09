'use strict'

const { startServer } = require('./server')
const { WebSocketServer } = require('ws')
const open = require('open')

// Control event injection via robotjs (optional — falls back to view-only)
let robot = null
try { robot = require('robotjs') } catch { /* not installed — view only mode */ }

const CONTROL_PORT = 9877

async function main() {
  // WebSocket server: receives control events from the browser and injects them into the OS
  const wss = new WebSocketServer({ port: CONTROL_PORT, host: '127.0.0.1' })
  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try { injectEvent(JSON.parse(data.toString())) } catch { /* ignore */ }
    })
  })
  wss.on('error', () => {
    // Port already in use (another instance running) — that's fine, control still works
  })

  const { port } = await startServer()
  const url = `http://127.0.0.1:${port}/target`

  console.log('')
  console.log('  ┌──────────────────────────────────────────┐')
  console.log('  │   WebRTC Remote  ·  Target Mode           │')
  console.log(`  │   ${url.padEnd(41)} │`)
  console.log('  │   Press Ctrl+C to stop sharing            │')
  console.log('  └──────────────────────────────────────────┘')
  console.log('')

  if (!robot) {
    console.log('  [view-only]  Install robotjs for full keyboard/mouse control:')
    console.log('               npm install -g robotjs\n')
  }

  await open(url)
  console.log('  Waiting for monitor connections...\n')
}

function injectEvent(event) {
  if (!robot) return
  try {
    switch (event.type) {
      case 'mousemove':
        robot.moveMouse(Math.round(event.x), Math.round(event.y))
        break
      case 'mousedown':
        robot.mouseToggle('down', event.button === 2 ? 'right' : 'left')
        break
      case 'mouseup':
        robot.mouseToggle('up', event.button === 2 ? 'right' : 'left')
        break
      case 'wheel':
        robot.scrollMouse(event.deltaX || 0, event.deltaY || 0)
        break
      case 'keydown': {
        const k = mapKey(event.key)
        if (k) robot.keyToggle(k, 'down')
        break
      }
      case 'keyup': {
        const k = mapKey(event.key)
        if (k) robot.keyToggle(k, 'up')
        break
      }
    }
  } catch { /* injection error — ignore */ }
}

function mapKey(key) {
  const map = {
    Enter: 'enter', Backspace: 'backspace', Tab: 'tab', Escape: 'escape',
    Delete: 'delete', ' ': 'space', ArrowLeft: 'left', ArrowRight: 'right',
    ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end',
    PageUp: 'pageup', PageDown: 'pagedown', F1: 'f1', F2: 'f2', F3: 'f3',
    F4: 'f4', F5: 'f5', F6: 'f6', F7: 'f7', F8: 'f8', F9: 'f9',
    F10: 'f10', F11: 'f11', F12: 'f12',
    Control: 'control', Alt: 'alt', Shift: 'shift', Meta: 'command',
    CapsLock: 'caps_lock', Insert: 'insert',
  }
  return map[key] || (key.length === 1 ? key.toLowerCase() : null)
}

main().catch((err) => {
  console.error('Failed to start:', err.message)
  process.exit(1)
})
