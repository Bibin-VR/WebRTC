import { useEffect, useState, useRef } from 'react'
import { authReady } from '../services/firebase'
import {
  getOrCreateDeviceId, registerDevice, setDeviceOffline,
  watchNewMonitors, watchOffer, publishAnswer,
  addIceCandidate, watchIceCandidates, cleanupSignaling, cleanupAllSignaling,
} from '../services/firebaseDb'
import './TargetPage.css'

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

// Connects to the CLI control WebSocket (bin/start.js) for OS event injection
function connectControlWs(state) {
  try {
    const ws = new WebSocket('ws://127.0.0.1:9877')
    ws.onopen = () => { state.controlWs = ws; state.wsRetries = 0 }
    ws.onerror = () => {}
    ws.onclose = () => {
      state.controlWs = null
      state.wsRetries = (state.wsRetries || 0) + 1
      if (state.wsRetries < 5) setTimeout(() => connectControlWs(state), 3000)
    }
  } catch { /* WebSocket not available in this environment */ }
}

async function handleMonitor(state, monitorId, onConnected, onDisconnected) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  state.peers[monitorId] = pc

  // Add screen tracks to this peer connection
  state.stream?.getTracks().forEach((t) => pc.addTrack(t, state.stream))

  // Receive control data channel sent by the monitor
  pc.ondatachannel = ({ channel }) => {
    if (channel.label !== 'control') return
    channel.onmessage = ({ data }) => {
      if (state.controlWs?.readyState === WebSocket.OPEN) state.controlWs.send(data)
    }
  }

  const iceBuf = []
  let remoteSet = false

  pc.onicecandidate = async ({ candidate }) => {
    if (candidate) await addIceCandidate(state.deviceId, monitorId, 'target', candidate.toJSON())
  }

  pc.onconnectionstatechange = () => {
    const { connectionState } = pc
    if (connectionState === 'connected') onConnected(monitorId)
    if (['disconnected', 'failed', 'closed'].includes(connectionState)) {
      onDisconnected(monitorId)
      pc.close()
      delete state.peers[monitorId]
      cleanupSignaling(state.deviceId, monitorId)
    }
  }

  // Buffer monitor's ICE candidates until we've set the remote description
  const unsubIce = watchIceCandidates(state.deviceId, monitorId, 'monitor', async (c) => {
    if (remoteSet) { try { await pc.addIceCandidate(c) } catch { /* stale candidate */ } }
    else iceBuf.push(c)
  })
  state.unsubs.push(unsubIce)

  // Wait for the offer, then answer it.
  // `let` + optional chain: Firebase fires the callback synchronously when stale data
  // exists in the DB, before watchOffer() returns — `const` would TDZ in that case.
  let unsubOffer
  unsubOffer = watchOffer(state.deviceId, monitorId, async (offer) => {
    if (pc.remoteDescription) return
    unsubOffer?.()

    await pc.setRemoteDescription(offer)
    remoteSet = true
    for (const c of iceBuf) try { await pc.addIceCandidate(c) } catch { /* stale candidate */ }
    iceBuf.length = 0

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await publishAnswer(state.deviceId, monitorId, answer)
  })
  state.unsubs.push(unsubOffer)
}

export const TargetPage = () => {
  const [slot, setSlot] = useState(null)
  const [status, setStatus] = useState('Starting...')
  const [monitorCount, setMonitorCount] = useState(0)
  const [error, setError] = useState(null)

  const state = useRef({
    deviceId: getOrCreateDeviceId(),
    stream: null,
    peers: {},
    controlWs: null,
    wsRetries: 0,
    unsubs: [],
  })

  useEffect(() => {
    const s = state.current
    let mounted = true

    async function init() {
      setStatus('Connecting to Firebase...')
      await authReady

      setStatus('Capturing screen...')
      try {
        // In Electron daemon mode, setDisplayMediaRequestHandler auto-selects
        // the primary screen — no picker dialog, no user interaction needed.
        // In a regular browser, getDisplayMedia shows the normal picker.
        s.stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 15, width: { ideal: 1920 } },
          audio: false, // system audio needs extra macOS drivers — video only for now
        })
        s.stream.getVideoTracks()[0].onended = () => {
          if (mounted) setStatus('Screen sharing stopped')
          setDeviceOffline(s.deviceId)
        }
      } catch (err) {
        if (mounted) setError(`Screen capture denied: ${err.message}`)
        return
      }

      connectControlWs(s)

      const platform = /Win/.test(navigator.userAgent) ? 'Windows'
        : /Mac/.test(navigator.userAgent) ? 'macOS' : 'Linux'

      try {
        const { slot: num } = await registerDevice(navigator.userAgent.substring(0, 30), platform)
        if (!mounted) return
        setSlot(num)
        setStatus(`Device #${num} — Waiting for monitor`)

        // Wipe stale signaling entries from previous sessions so onChildAdded
        // doesn't replay old offers on every startup.
        await cleanupAllSignaling(s.deviceId)

        const unsubMonitors = watchNewMonitors(s.deviceId, (monitorId) => {
          if (!s.peers[monitorId]) {
            handleMonitor(
              s, monitorId,
              () => { if (mounted) { setMonitorCount((n) => n + 1); setStatus(`Device #${num} — Connected`) } },
              () => { if (mounted) setMonitorCount((n) => Math.max(0, n - 1)) },
            )
          }
        })
        s.unsubs.push(unsubMonitors)
      } catch (err) {
        console.error('[target] Firebase error:', err.message)
        if (mounted) setError(`Firebase error: ${err.message}`)
      }
    }

    init()

    return () => {
      mounted = false
      s.unsubs.forEach((fn) => fn())
      Object.values(s.peers).forEach((pc) => pc.close())
      s.stream?.getTracks().forEach((t) => t.stop())
      s.controlWs?.close()
      setDeviceOffline(s.deviceId)
    }
  }, [])

  if (error) {
    return (
      <div className="target-page">
        <div className="target-card error">
          <div className="target-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="target-page">
      <div className="target-card">
        <div className="target-icon">📡</div>
        <h2>Device #{slot ?? '…'}</h2>
        <p className="target-status">{status}</p>
        {monitorCount > 0 && (
          <div className="monitor-badge">
            {monitorCount} monitor{monitorCount > 1 ? 's' : ''} connected
          </div>
        )}
        <p className="target-hint">
          On the monitor machine, run:<br />
          <code>webrtc-remote monitor {slot ?? 'N'}</code>
        </p>
      </div>
    </div>
  )
}
