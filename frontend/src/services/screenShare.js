export class ScreenShareManager {
  constructor(rtcManager, wsClient) {
    this.rtcManager = rtcManager
    this.wsClient = wsClient
    this.screenStream = null
    this.currentSessionId = null
  }

  async startScreenShare(sessionId) {
    try {
      this.currentSessionId = sessionId

      if (window.electron) {
        const source = await this.getElectronScreen()
        this.screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              minWidth: 1280,
              maxWidth: 1920,
              minHeight: 720,
              maxHeight: 1080,
            },
          },
        })
      } else {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: false,
        })
      }

      const conn = this.rtcManager.getConnection(sessionId)
      if (conn) {
        const videoTrack = this.screenStream.getVideoTracks()[0]
        const sender = conn.pc
          .getSenders()
          .find((s) => s.track?.kind === 'video')

        if (sender) {
          await sender.replaceTrack(videoTrack)
        } else {
          conn.pc.addTrack(videoTrack, this.screenStream)
        }

        videoTrack.onended = () => {
          this.stopScreenShare(sessionId)
        }
      }

      this.wsClient.send({
        type: 'stream:start-screen',
        session_id: sessionId,
      })

      return true
    } catch (error) {
      console.error('[ScreenShare] Error starting screen share:', error)
      return false
    }
  }

  async stopScreenShare(sessionId) {
    try {
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((track) => track.stop())
        this.screenStream = null
      }

      const conn = this.rtcManager.getConnection(sessionId)
      if (conn) {
        const sender = conn.pc
          .getSenders()
          .find((s) => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(null)
        }
      }

      this.wsClient.send({
        type: 'stream:stop-screen',
        session_id: sessionId,
      })

      this.currentSessionId = null
      return true
    } catch (error) {
      console.error('[ScreenShare] Error stopping screen share:', error)
      return false
    }
  }

  async getElectronScreen() {
    if (!window.electron) return null

    const sources = await window.electron.getDisplayMedia()
    return sources[0]
  }

  isSharing() {
    return this.screenStream !== null
  }

  getScreenStream() {
    return this.screenStream
  }
}
