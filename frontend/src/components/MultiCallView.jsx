import { useEffect, useRef } from 'react'
import './MultiCallView.css'

function VideoTile({ stream, label, connectionState, muted = false }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className={`video-tile ${!stream ? 'no-stream' : ''}`}>
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="video-el" />
      ) : (
        <div className="video-placeholder">
          <div className="avatar-circle">{label?.[0]?.toUpperCase() || '?'}</div>
        </div>
      )}
      <div className="tile-label">
        <span>{label}</span>
        {connectionState && connectionState !== 'connected' && (
          <span className={`tile-state ${connectionState}`}>{connectionState}</span>
        )}
      </div>
    </div>
  )
}

export const MultiCallView = ({
  localStream,
  remoteParticipants,
  isScreenSharing,
  onScreenShare,
  onScreenStop,
  onSendFile,
  localDisplayName,
}) => {
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) onSendFile(file)
  }

  // Total tiles = local + all remotes
  const totalTiles = 1 + remoteParticipants.length
  const gridClass = totalTiles <= 1 ? 'grid-1' : totalTiles <= 2 ? 'grid-2' : totalTiles <= 4 ? 'grid-4' : 'grid-6'

  return (
    <div className="multi-call-view">
      <div className={`video-grid ${gridClass}`}>
        {/* Local video always first */}
        <VideoTile
          stream={localStream}
          label={`${localDisplayName} (You)`}
          muted
        />

        {/* Remote participants */}
        {remoteParticipants.map(({ peerId, stream, displayName, connectionState }) => (
          <VideoTile
            key={peerId}
            stream={stream}
            label={displayName || peerId}
            connectionState={connectionState}
          />
        ))}
      </div>

      <div className="call-controls">
        <button
          className={`ctrl-btn ${isScreenSharing ? 'active' : ''}`}
          onClick={isScreenSharing ? onScreenStop : onScreenShare}
          title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        >
          {isScreenSharing ? '⏹ Stop Screen' : '🖥 Share Screen'}
        </button>

        <label className="ctrl-btn file-btn" title="Send File">
          📁 Send File
          <input type="file" onChange={handleFileSelect} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  )
}
