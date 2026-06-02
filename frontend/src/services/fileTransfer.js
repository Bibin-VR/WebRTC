import { sha256 } from '../utils/crypto'

export class FileTransferManager {
  constructor(wsClient) {
    this.wsClient = wsClient
    this.activeTransfers = {}
    this.setupHandlers()
  }

  setupHandlers() {
    this.wsClient.on('file:offer', (msg) => {
      if (this.onFileOffer) {
        this.onFileOffer(msg)
      }
    })

    this.wsClient.on('file:accept', (msg) => {
      const transfer = this.activeTransfers[msg.file_id]
      if (transfer) {
        transfer.accepted = true
      }
    })

    this.wsClient.on('file:reject', (msg) => {
      const transfer = this.activeTransfers[msg.file_id]
      if (transfer) {
        transfer.rejected = true
      }
    })
  }

  async sendFile(sessionId, file, onProgress) {
    const fileId = this.generateFileId()
    const checksum = await this.calculateChecksum(file)

    const transfer = {
      id: fileId,
      file,
      checksum,
      progress: 0,
      totalSize: file.size,
      accepted: false,
      rejected: false,
    }

    this.activeTransfers[fileId] = transfer

    this.wsClient.send({
      type: 'file:offer',
      session_id: sessionId,
      file_id: fileId,
      filename: file.name,
      size: file.size,
      checksum,
    })

    // Wait for acceptance (timeout after 30s)
    const accepted = await this.waitForAcceptance(fileId, 30000)
    if (!accepted) {
      delete this.activeTransfers[fileId]
      return false
    }

    // Send file chunks over data channel
    await this.sendFileChunks(sessionId, transfer, onProgress)

    delete this.activeTransfers[fileId]
    return true
  }

  async sendFileChunks(sessionId, transfer, onProgress) {
    const chunkSize = 64 * 1024 // 64KB chunks
    const file = transfer.file
    let offset = 0

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize)
      const chunkData = await chunk.arrayBuffer()

      const message = {
        type: 'chunk',
        file_id: transfer.id,
        chunk_id: Math.floor(offset / chunkSize),
        offset,
        data: Array.from(new Uint8Array(chunkData)),
      }

      // Send via data channel if available, otherwise use signaling
      this.sendChunk(sessionId, message)

      offset += chunkSize
      transfer.progress = offset
      if (onProgress) {
        onProgress(offset, file.size)
      }
    }

    this.wsClient.send({
      type: 'file:complete',
      session_id: sessionId,
      file_id: transfer.id,
      checksum: transfer.checksum,
    })
  }

  async acceptFile(sessionId, fileId) {
    this.wsClient.send({
      type: 'file:accept',
      session_id: sessionId,
      file_id: fileId,
    })
  }

  async rejectFile(sessionId, fileId) {
    this.wsClient.send({
      type: 'file:reject',
      session_id: sessionId,
      file_id: fileId,
    })
  }

  async calculateChecksum(file) {
    const buffer = await file.arrayBuffer()
    return sha256(new Uint8Array(buffer))
  }

  async verifyChecksum(data, expectedChecksum) {
    const actualChecksum = sha256(data)
    return actualChecksum === expectedChecksum
  }

  generateFileId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  waitForAcceptance(fileId, timeout) {
    return new Promise((resolve) => {
      const startTime = Date.now()

      const checkAcceptance = () => {
        const transfer = this.activeTransfers[fileId]
        if (!transfer) {
          resolve(false)
          return
        }

        if (transfer.accepted) {
          resolve(true)
        } else if (transfer.rejected || Date.now() - startTime > timeout) {
          resolve(false)
        } else {
          setTimeout(checkAcceptance, 100)
        }
      }

      checkAcceptance()
    })
  }

  sendChunk(sessionId, message) {
    // Try to send via data channel first
    // Falls back to signaling if no data channel
    const conn = this.rtcManager?.getConnection(sessionId)
    if (conn) {
      const dc = conn.dataChannels['file-transfer']
      if (dc && dc.readyState === 'open') {
        dc.send(JSON.stringify(message))
        return
      }
    }

    // Fallback to signaling server
    this.wsClient.send({
      type: 'file:chunk',
      session_id: sessionId,
      ...message,
    })
  }
}
