import { useEffect, useRef } from 'react'
import './CallView.css'

export const CallView = ({
  localStream,
  remoteStream,
  isScreenSharing,
  onScreenShare,
  onScreenStop,
  onSendFile,
  connectionState,
}) => {
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const screenVideoRef = useRef(null)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      await onScreenStop()
    } else {
      await onScreenShare()
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      onSendFile(file)
    }
  }

  return (
    <div className="call-view">
      <div className="video-container">
        <div className="video-grid">
          <div className="video-box local">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="video"
            />
            <div className="video-label">You</div>
          </div>

          <div className="video-box remote">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="video"
            />
            <div className="video-label">Remote</div>
          </div>
        </div>

        {isScreenSharing && (
          <div className="screen-share-container">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="screen-share-video"
            />
            <div className="screen-share-label">Screen Share</div>
          </div>
        )}
      </div>

      <div className="call-controls">
        <div className="connection-status">
          <span className={`status-dot ${connectionState}`}></span>
          <span>{connectionState || 'connecting'}</span>
        </div>

        <div className="control-buttons">
          <button
            className={`btn control-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={handleScreenShare}
            title="Share Screen"
          >
            {isScreenSharing ? '⏹ Stop Screen' : '🖥 Share Screen'}
          </button>

          <label className="btn control-btn file-btn" title="Send File">
            📁 Send File
            <input
              type="file"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </label>

          <button className="btn control-btn btn-danger" title="End Call">
            ☎ End Call
          </button>
        </div>
      </div>
    </div>
  )
}
