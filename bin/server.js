'use strict'

const express = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')

function findDist() {
  // Prefer the dist bundled in this npm package (npx cache or global install)
  const localDist = path.join(__dirname, '../frontend/dist')
  if (fs.existsSync(path.join(localDist, 'index.html'))) return localDist

  // Fall back to the installed daemon's dist at ~/.vexrtc/
  const daemonDist = path.join(os.homedir(), '.vexrtc', 'frontend', 'dist')
  if (fs.existsSync(path.join(daemonDist, 'index.html'))) return daemonDist

  console.error('\n  Frontend not found. Run "npx vexRTC -serve" on this machine first,')
  console.error('  or publish the package with a pre-built dist/ included.\n')
  process.exit(1)
}

function startServer() {
  return new Promise((resolve, reject) => {
    const dist = findDist()
    const app = express()
    app.use(express.static(dist))
    // SPA fallback — all routes serve index.html
    app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')))

    const server = http.createServer(app)
    // Port 0 = OS picks an available port automatically
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: server.address().port, server })
    })
    server.on('error', reject)
  })
}

module.exports = { startServer }
