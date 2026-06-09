import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  getDeviceBySlot, watchDevices,
  publishOffer, watchAnswer,
  addIceCandidate, watchIceCandidates,
  cleanupSignaling,
} from '../services/firebaseDb'
import './MonitorPage.css'

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

export const MonitorPage = () => {
  const { slot } = useParams()
  const slotNum = parseInt(slot)
  const [status, setStatus] = useState(`Looking up Device #${slotNum}…`)
  const [connected, setConnected] = useState(false)
  const [videoSize, setVideoSize] = useState({ w: 1920, h: 1080 })

  const videoRef = useRef(null)
  const state = useRef({
    pc: null,
    controlChannel: null,
    monitorId: crypto.randomUUID(),
    deviceId: null,
    unsubs: [],
  })

  useEffect(() => {
    const s = state.current
    connect(s)
    return () => {
      s.unsubs.forEach((fn) => fn())
      s.pc?.close()
      if (s.deviceId) cleanupSignaling(s.deviceId, s.monitorId)
    }
  }, [slotNum])

  async function connect(s) {
    // Clean up any previous connection attempt
    s.unsubs.forEach((fn) => fn())
    s.unsubs = []
    s.pc?.close()
    s.pc = null
    setConnected(false)

    setStatus(`Looking up Device #${slotNum}…`)
    let device = await getDeviceBySlot(slotNum)

    if (!device) {
      setStatus(`Device #${slotNum} is offline — waiting for it to come online…`)
      const unsubWait = watchDevices((devices) => {
        const d = devices.find((d) => d.slot === slotNum)
        if (d) {
          unsubWait()
          connect(s)
        }
      })
      s.unsubs.push(unsubWait)
      return
    }

    s.deviceId = device.id
    s.monitorId = crypto.randomUUID() // fresh ID for each connection attempt
    setStatus(`Device #${slotNum} found — connecting…`)

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    s.pc = pc

    // Create control data channel before the offer (gets negotiated into SDP)
    const ctrl = pc.createDataChannel('control')
    s.controlChannel = ctrl

    // Receive the target's screen stream
    pc.ontrack = ({ streams }) => {
      if (videoRef.current && streams[0]) {
        videoRef.current.srcObject = streams[0]
        setConnected(true)
        setStatus(`Device #${slotNum}`)
      }
    }

    const iceBuf = []
    let remoteSet = false

    pc.onicecandidate = async ({ candidate }) => {
      if (candidate) await addIceCandidate(s.deviceId, s.monitorId, 'monitor', candidate.toJSON())
    }

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed'].includes(pc.connectionState)) {
        setConnected(false)
        setStatus('Connection lost — reconnecting…')
        setTimeout(() => connect(state.current), 2000)
      }
    }

    // Buffer target ICE candidates until we have the answer (remote desc set)
    const unsubIce = watchIceCandidates(s.deviceId, s.monitorId, 'target', async (c) => {
      if (remoteSet) { try { await pc.addIceCandidate(c) } catch { /* stale candidate */ } }
      else iceBuf.push(c)
    })
    s.unsubs.push(unsubIce)

    // Watch for the target's answer
    const unsubAnswer = watchAnswer(s.deviceId, s.monitorId, async (answer) => {
      if (pc.remoteDescription) return
      unsubAnswer()

      await pc.setRemoteDescription(answer)
      remoteSet = true
      for (const c of iceBuf) try { await pc.addIceCandidate(c) } catch { /* stale candidate */ }
      iceBuf.length = 0
    })
    s.unsubs.push(unsubAnswer)

    // Create offer and send to target via Firebase RTDB
    const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
    await pc.setLocalDescription(offer)
    await publishOffer(s.deviceId, s.monitorId, offer)
  }

  // Scale mouse coordinates from the displayed video element to the original screen resolution
  function toRemoteCoords(e) {
    const rect = videoRef.current?.getBoundingClientRect()
    if (!rect) return { x: e.clientX, y: e.clientY }
    return {
      x: Math.round((e.clientX - rect.left) * (videoSize.w / rect.width)),
      y: Math.round((e.clientY - rect.top) * (videoSize.h / rect.height)),
    }
  }

  const sendControl = useCallback((event) => {
    const ch = state.current.controlChannel
    if (ch?.readyState === 'open') ch.send(JSON.stringify(event))
  }, [])

  return (
    <div
      className="monitor-page"
      tabIndex={0}
      onKeyDown={(e) => { e.preventDefault(); sendControl({ type: 'keydown', key: e.key, code: e.code }) }}
      onKeyUp={(e) => { e.preventDefault(); sendControl({ type: 'keyup', key: e.key, code: e.code }) }}
    >
      {!connected && (
        <div className="monitor-overlay">
          <div className="monitor-spinner" />
          <div className="monitor-status">{status}</div>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="remote-video"
        onLoadedMetadata={(e) => setVideoSize({ w: e.target.videoWidth, h: e.target.videoHeight })}
        onMouseMove={(e) => sendControl({ type: 'mousemove', ...toRemoteCoords(e) })}
        onMouseDown={(e) => { e.preventDefault(); sendControl({ type: 'mousedown', button: e.button, ...toRemoteCoords(e) }) }}
        onMouseUp={(e) => sendControl({ type: 'mouseup', button: e.button, ...toRemoteCoords(e) })}
        onWheel={(e) => sendControl({ type: 'wheel', deltaX: e.deltaX, deltaY: e.deltaY })}
        onContextMenu={(e) => e.preventDefault()}
      />

      {connected && (
        <div className="monitor-label">Device #{slotNum}</div>
      )}
    </div>
  )
}
