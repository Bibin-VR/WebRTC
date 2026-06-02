const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

class WebSocketClient {
  constructor() {
    this.ws = null
    this.listeners = {}
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000
  }

  connect(token, userId, deviceId) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL + '/ws')

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected')
          this.reconnectAttempts = 0

          // Authenticate
          this.send({
            type: 'auth',
            token,
            device_id: deviceId,
          })

          // Listen for auth success
          const checkAuth = () => {
            this.once('auth:success', () => {
              resolve()
              this.removeEventListener('auth:success', checkAuth)
            })
            this.once('auth:error', (msg) => {
              reject(new Error(msg.message))
              this.removeEventListener('auth:error', checkAuth)
            })
          }
          checkAuth()
        }

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error)
          reject(error)
        }

        this.ws.onmessage = (event) => {
          const message = JSON.parse(event.data)
          this.emit(message.type, message)
        }

        this.ws.onclose = () => {
          console.log('[WebSocket] Disconnected')
          this.tryReconnect(token, userId, deviceId)
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('[WebSocket] Not connected, message not sent:', message)
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = []
    }
    this.listeners[eventType].push(callback)
  }

  once(eventType, callback) {
    const wrapper = (data) => {
      callback(data)
      this.removeEventListener(eventType, wrapper)
    }
    this.on(eventType, wrapper)
  }

  removeEventListener(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(
        (cb) => cb !== callback,
      )
    }
  }

  emit(eventType, data) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach((callback) => callback(data))
    }
  }

  tryReconnect(token, userId, deviceId) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
      setTimeout(() => {
        this.connect(token, userId, deviceId).catch((error) => {
          console.error('[WebSocket] Reconnection failed:', error)
        })
      }, delay)
    } else {
      console.error('[WebSocket] Max reconnection attempts reached')
    }
  }

  heartbeat() {
    this.send({ type: 'heartbeat' })
  }
}

export const wsClient = new WebSocketClient()
