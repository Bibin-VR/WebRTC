class WebRTCPeerConnection {
  constructor(sessionId, config = {}) {
    this.sessionId = sessionId
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['stun:stun1.l.google.com:19302'] },
      ],
      ...config,
    })

    this.localStream = null
    this.remoteStream = null
    this.dataChannels = {}

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(event.candidate)
      }
    }

    this.pc.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind)
      this.remoteStream = event.streams[0]
      this.onRemoteStream?.(this.remoteStream)
    }

    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel)
    }

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.pc.connectionState)
      this.onConnectionStateChange?.(this.pc.connectionState)
    }
  }

  async addLocalStream(stream) {
    this.localStream = stream
    stream.getTracks().forEach((track) => {
      this.pc.addTrack(track, stream)
    })
  }

  async createOffer() {
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })
    await this.pc.setLocalDescription(offer)
    return offer
  }

  async createAnswer() {
    const answer = await this.pc.createAnswer()
    await this.pc.setLocalDescription(answer)
    return answer
  }

  async setRemoteOffer(offer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer))
  }

  async setRemoteAnswer(answer) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer))
  }

  async addIceCandidate(candidate) {
    if (candidate) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
  }

  createDataChannel(label) {
    const channel = this.pc.createDataChannel(label)
    this.setupDataChannel(channel)
    return channel
  }

  setupDataChannel(channel) {
    this.dataChannels[channel.label] = channel

    channel.onopen = () => {
      console.log('[WebRTC] Data channel opened:', channel.label)
      this.onDataChannelOpen?.(channel)
    }

    channel.onclose = () => {
      console.log('[WebRTC] Data channel closed:', channel.label)
      delete this.dataChannels[channel.label]
    }

    channel.onerror = (event) => {
      console.error('[WebRTC] Data channel error:', channel.label, event)
    }

    channel.onmessage = (event) => {
      this.onDataChannelMessage?.(channel.label, event.data)
    }
  }

  getLocalStream() {
    return this.localStream
  }

  getRemoteStream() {
    return this.remoteStream
  }

  close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
    }
    this.pc.close()
  }
}

export class WebRTCManager {
  constructor(wsClient) {
    this.wsClient = wsClient
    this.connections = {}
    this.setupSignalingHandlers()
  }

  setupSignalingHandlers() {
    this.wsClient.on('signal:offer', async (msg) => {
      const conn = this.connections[msg.session_id]
      if (conn) {
        await conn.setRemoteOffer(JSON.parse(msg.sdp))
        const answer = await conn.createAnswer()
        this.wsClient.send({
          type: 'signal:answer',
          session_id: msg.session_id,
          sdp: JSON.stringify(answer),
        })
      }
    })

    this.wsClient.on('signal:answer', async (msg) => {
      const conn = this.connections[msg.session_id]
      if (conn) {
        await conn.setRemoteAnswer(JSON.parse(msg.sdp))
      }
    })

    this.wsClient.on('signal:ice-candidate', async (msg) => {
      const conn = this.connections[msg.session_id]
      if (conn) {
        await conn.addIceCandidate(msg.candidate)
      }
    })
  }

  createConnection(sessionId) {
    const conn = new WebRTCPeerConnection(sessionId)
    this.connections[sessionId] = conn

    conn.onIceCandidate = (candidate) => {
      this.wsClient.send({
        type: 'signal:ice-candidate',
        session_id: sessionId,
        candidate,
      })
    }

    return conn
  }

  getConnection(sessionId) {
    return this.connections[sessionId]
  }

  closeConnection(sessionId) {
    const conn = this.connections[sessionId]
    if (conn) {
      conn.close()
      delete this.connections[sessionId]
    }
  }

  closeAll() {
    Object.values(this.connections).forEach((conn) => conn.close())
    this.connections = {}
  }
}
