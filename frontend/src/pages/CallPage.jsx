import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { wsClient } from '../services/websocket'
import { WebRTCManager } from '../services/webrtc'
import { ScreenShareManager } from '../services/screenShare'
import { FileTransferManager } from '../services/fileTransfer'
import { CallView } from '../components/CallView'
import { FileTransferDialog } from '../components/FileTransferDialog'
import './CallPage.css'

export const CallPage = () => {
  const navigate = useNavigate()
  const { sessionId } = useParams()

  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [connectionState, setConnectionState] = useState('connecting')
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [fileTransfer, setFileTransfer] = useState(null)
  const [fileProgress, setFileProgress] = useState(0)

  const rtcManager = useRef(null)
  const screenShareManager = useRef(null)
  const fileTransferManager = useRef(null)

  useEffect(() => {
    initializeCall()
    return () => cleanupCall()
  }, [sessionId])

  const initializeCall = async () => {
    try {
      rtcManager.current = new WebRTCManager(wsClient)
      screenShareManager.current = new ScreenShareManager(rtcManager.current, wsClient)
      fileTransferManager.current = new FileTransferManager(wsClient)

      const connection = rtcManager.current.createConnection(sessionId)

      connection.onRemoteStream = (stream) => {
        setRemoteStream(stream)
      }

      connection.onConnectionStateChange = (state) => {
        setConnectionState(state)
      }

      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 640, height: 480 },
      })
      setLocalStream(stream)
      await connection.addLocalStream(stream)

      // Setup file transfer
      fileTransferManager.current.onFileOffer = (msg) => {
        setFileTransfer({
          id: msg.file_id,
          filename: msg.filename,
          totalSize: msg.size,
          checksum: msg.checksum,
        })
      }
    } catch (error) {
      console.error('Failed to initialize call:', error)
      alert('Failed to start call')
      navigate('/dashboard')
    }
  }

  const cleanupCall = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop())
    }
    if (screenShareManager.current?.isSharing()) {
      screenShareManager.current.stopScreenShare(sessionId)
    }
    const conn = rtcManager.current?.getConnection(sessionId)
    if (conn) {
      conn.close()
    }
  }

  const handleScreenShare = async () => {
    const success = await screenShareManager.current.startScreenShare(sessionId)
    if (success) {
      setIsScreenSharing(true)
    }
  }

  const handleScreenStop = async () => {
    await screenShareManager.current.stopScreenShare(sessionId)
    setIsScreenSharing(false)
  }

  const handleSendFile = async (file) => {
    setFileTransfer({
      filename: file.name,
      totalSize: file.size,
    })

    const success = await fileTransferManager.current.sendFile(
      sessionId,
      file,
      (progress) => {
        setFileProgress(progress)
      },
    )

    if (success) {
      alert('File sent successfully')
    } else {
      alert('File transfer failed')
    }
    setFileTransfer(null)
    setFileProgress(0)
  }

  const handleAcceptFile = async () => {
    await fileTransferManager.current.acceptFile(sessionId, fileTransfer.id)
  }

  const handleRejectFile = async () => {
    await fileTransferManager.current.rejectFile(sessionId, fileTransfer.id)
    setFileTransfer(null)
  }

  return (
    <div className="call-page">
      <CallView
        localStream={localStream}
        remoteStream={remoteStream}
        isScreenSharing={isScreenSharing}
        onScreenShare={handleScreenShare}
        onScreenStop={handleScreenStop}
        onSendFile={handleSendFile}
        connectionState={connectionState}
      />

      <FileTransferDialog
        isOpen={!!fileTransfer}
        fileInfo={fileTransfer}
        progress={fileProgress}
        onAccept={handleAcceptFile}
        onReject={handleRejectFile}
        isReceiving={!fileTransfer?.isReceiving}
      />
    </div>
  )
}
