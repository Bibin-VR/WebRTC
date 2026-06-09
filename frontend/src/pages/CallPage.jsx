import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { sessionsApi } from '../services/api'
import { FirebaseSignalingService } from '../services/firebaseSignaling'
import { FileTransferDialog } from '../components/FileTransferDialog'
import { MultiCallView } from '../components/MultiCallView'
import './CallPage.css'

export const CallPage = () => {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const { user } = useAuthStore()

  const [localStream, setLocalStream] = useState(null)
  // Array of { peerId, stream, displayName, connectionState }
  const [remoteParticipants, setRemoteParticipants] = useState([])
  const [participants, setParticipants] = useState({})
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [fileTransfer, setFileTransfer] = useState(null)
  const [fileProgress, setFileProgress] = useState(0)

  const signalingRef = useRef(null)
  const screenStreamRef = useRef(null)
  const originalVideoTrackRef = useRef(null)

  const updateParticipant = useCallback((peerId, updates) => {
    setRemoteParticipants((prev) => {
      const existing = prev.find((p) => p.peerId === peerId)
      if (existing) {
        return prev.map((p) => (p.peerId === peerId ? { ...p, ...updates } : p))
      }
      return [...prev, { peerId, stream: null, displayName: peerId, connectionState: 'connecting', ...updates }]
    })
  }, [])

  useEffect(() => {
    initializeCall()
    return () => {
      signalingRef.current?.leave()
    }
  }, [sessionId])

  const initializeCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 640, height: 480 },
      })
      setLocalStream(stream)
      originalVideoTrackRef.current = stream.getVideoTracks()[0]

      const displayName = user?.displayName || user?.email || 'Me'
      const signaling = new FirebaseSignalingService(sessionId, user?.id, displayName)
      signalingRef.current = signaling

      signaling.onPeerConnected = (peerId, remoteStream, peerDisplayName) => {
        updateParticipant(peerId, { stream: remoteStream, displayName: peerDisplayName })
      }

      signaling.onPeerDisconnected = (peerId) => {
        setRemoteParticipants((prev) => prev.filter((p) => p.peerId !== peerId))
      }

      signaling.onParticipantsChanged = (all) => {
        setParticipants(all)
      }

      signaling.onConnectionStateChange = (peerId, state) => {
        updateParticipant(peerId, { connectionState: state })
      }

      await signaling.join(stream)
    } catch (error) {
      console.error('Failed to initialize call:', error)
      alert('Failed to start call. Check camera/microphone permissions.')
      navigate('/dashboard')
    }
  }

  const handleScreenShare = async () => {
    try {
      // Use Electron's desktopCapturer if available, otherwise browser API
      let screenStream
      if (window.electronAPI?.getDisplayMedia) {
        const sourceId = await window.electronAPI.getDisplayMedia()
        screenStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } },
        })
      } else {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      }

      const screenTrack = screenStream.getVideoTracks()[0]
      screenStreamRef.current = screenStream

      // Replace video track in all peer connections
      signalingRef.current?.replaceVideoTrack(screenTrack)

      // Replace in local preview
      setLocalStream((prev) => {
        if (!prev) return screenStream
        const newStream = new MediaStream()
        prev.getAudioTracks().forEach((t) => newStream.addTrack(t))
        newStream.addTrack(screenTrack)
        return newStream
      })

      screenTrack.onended = () => handleScreenStop()
      setIsScreenSharing(true)
    } catch (error) {
      console.error('Screen share failed:', error)
    }
  }

  const handleScreenStop = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenStreamRef.current = null

    const originalTrack = originalVideoTrackRef.current
    if (originalTrack) {
      signalingRef.current?.replaceVideoTrack(originalTrack)
      setLocalStream((prev) => {
        if (!prev) return null
        const newStream = new MediaStream()
        prev.getAudioTracks().forEach((t) => newStream.addTrack(t))
        newStream.addTrack(originalTrack)
        return newStream
      })
    }
    setIsScreenSharing(false)
  }, [])

  const handleEndCall = async () => {
    await signalingRef.current?.leave()
    try {
      await sessionsApi.end(sessionId)
    } catch {
      // ignore — session may already be ended
    }
    navigate('/dashboard')
  }

  const handleSendFile = async (file) => {
    // File transfer via data channel to first connected peer
    const firstPeer = remoteParticipants.find((p) => p.stream)
    if (!firstPeer) return alert('No connected peers')

    setFileTransfer({ filename: file.name, totalSize: file.size })

    const CHUNK_SIZE = 64 * 1024
    const channel = signalingRef.current?.getDataChannel(firstPeer.peerId, 'file-transfer')
    if (!channel) return alert('Data channel not available')

    channel.onopen = async () => {
      const buffer = await file.arrayBuffer()
      let offset = 0
      while (offset < buffer.byteLength) {
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE)
        channel.send(chunk)
        offset += chunk.byteLength
        setFileProgress(offset)
      }
      setFileTransfer(null)
      setFileProgress(0)
      alert('File sent successfully')
    }
  }

  const participantCount = Object.keys(participants).length

  return (
    <div className="call-page">
      <div className="call-header">
        <span className="session-info">
          Session · {participantCount} participant{participantCount !== 1 ? 's' : ''}
        </span>
        <button className="btn btn-danger btn-end-call" onClick={handleEndCall}>
          End Call
        </button>
      </div>

      <MultiCallView
        localStream={localStream}
        remoteParticipants={remoteParticipants}
        isScreenSharing={isScreenSharing}
        onScreenShare={handleScreenShare}
        onScreenStop={handleScreenStop}
        onSendFile={handleSendFile}
        localDisplayName={user?.displayName || 'You'}
      />

      <FileTransferDialog
        isOpen={!!fileTransfer}
        fileInfo={fileTransfer}
        progress={fileProgress}
        onAccept={() => {}}
        onReject={() => setFileTransfer(null)}
        isReceiving={false}
      />
    </div>
  )
}
