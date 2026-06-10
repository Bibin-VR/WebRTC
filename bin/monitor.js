'use strict'

const https = require('https')
const { startServer } = require('./server')

const RTDB_URL = 'https://tovex-eab23-default-rtdb.firebaseio.com'

function fetchPasswordHash(slot) {
  return new Promise((resolve, reject) => {
    https.get(`${RTDB_URL}/slots/${slot}/passwordHash.json`, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(null) }
      })
    }).on('error', reject)
  })
}

async function verifyPassword(slot) {
  const { promptHidden, sha256 } = require('./prompt')

  let storedHash
  try {
    process.stdout.write(`\n  Checking Device #${slot}...\r`)
    storedHash = await fetchPasswordHash(slot)
    process.stdout.clearLine(0)
    process.stdout.cursorTo(0)
  } catch {
    console.error(`\n  Could not reach Firebase. Check your internet connection.\n`)
    process.exit(1)
  }

  if (!storedHash) {
    console.error(`\n  Device #${slot} has no password set.`)
    console.error(`  Run "npx vexrtc -serve" on the target machine first.\n`)
    process.exit(1)
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    const pw = await promptHidden(`  Password for Device #${slot}: `)
    if (sha256(pw) === storedHash) return // authenticated
    console.log(attempt < 3 ? '  Wrong password. Try again.' : '  Wrong password.')
  }

  console.error('\n  Too many failed attempts.\n')
  process.exit(1)
}

module.exports = async function startMonitor(slot) {
  await verifyPassword(slot)

  const { port } = await startServer()
  const url = `http://127.0.0.1:${port}/#/monitor/${slot}`

  console.log('')
  console.log('  ┌──────────────────────────────────────────────┐')
  console.log('  │   vexRTC  ·  Monitor Mode                    │')
  console.log(`  │   Device #${String(slot).padEnd(37)} │`)
  console.log(`  │   ${url.padEnd(48)} │`)
  console.log('  │   Press Ctrl+C to disconnect                 │')
  console.log('  └──────────────────────────────────────────────┘')
  console.log('')

  const { default: open } = await import('open')
  await open(url)
}
