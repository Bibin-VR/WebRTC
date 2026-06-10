'use strict'

const crypto = require('crypto')

/**
 * Prompt for a password without echoing characters. Shows • per keystroke.
 * Falls back to plain readline when stdin is not a TTY (pipe/CI).
 */
function promptHidden(msg) {
  return new Promise((resolve) => {
    process.stdout.write(msg)

    if (!process.stdin.isTTY) {
      let d = ''
      process.stdin.resume()
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', (c) => { d += c })
      process.stdin.once('end', () => resolve(d.trim()))
      return
    }

    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')

    let pw = ''

    function onData(ch) {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        process.stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(pw)
      } else if (ch === '') {           // Ctrl+C
        process.stdout.write('\n')
        process.exit(0)
      } else if (ch === '' || ch === '\b') {  // Backspace
        if (pw.length > 0) {
          pw = pw.slice(0, -1)
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
          process.stdout.write(msg + '•'.repeat(pw.length))
        }
      } else {
        pw += ch
        process.stdout.write('•')
      }
    }

    process.stdin.on('data', onData)
  })
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

module.exports = { promptHidden, sha256 }
