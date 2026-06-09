'use strict'

const express = require('express')
const path = require('path')
const http = require('http')

const DIST = path.join(__dirname, '../frontend/dist')

function startServer() {
  return new Promise((resolve, reject) => {
    const app = express()
    app.use(express.static(DIST))
    // SPA fallback — all routes serve index.html
    app.get('*', (_, res) => res.sendFile(path.join(DIST, 'index.html')))

    const server = http.createServer(app)
    // Port 0 = OS picks an available port automatically
    server.listen(0, '127.0.0.1', () => {
      resolve({ port: server.address().port, server })
    })
    server.on('error', reject)
  })
}

module.exports = { startServer }
