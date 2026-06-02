import { useState } from 'react'
import './FileTransferDialog.css'

export const FileTransferDialog = ({
  isOpen,
  fileInfo,
  progress,
  onAccept,
  onReject,
  isReceiving = false,
}) => {
  const [accepting, setAccepting] = useState(false)

  const handleAccept = async () => {
    setAccepting(true)
    await onAccept()
    setAccepting(false)
  }

  if (!isOpen || !fileInfo) return null

  const progressPercent = fileInfo.totalSize
    ? Math.round((progress / fileInfo.totalSize) * 100)
    : 0

  return (
    <div className="file-transfer-overlay">
      <div className="file-transfer-dialog">
        <h3>{isReceiving ? 'Incoming File' : 'Sending File'}</h3>

        <div className="file-info">
          <div className="file-icon">📄</div>
          <div className="file-details">
            <div className="file-name">{fileInfo.filename}</div>
            <div className="file-size">
              {(fileInfo.totalSize / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        </div>

        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="progress-text">{progressPercent}%</div>
        </div>

        <div className="file-size-display">
          {(progress / 1024 / 1024).toFixed(2)} MB /{' '}
          {(fileInfo.totalSize / 1024 / 1024).toFixed(2)} MB
        </div>

        {isReceiving && !progress && (
          <div className="dialog-actions">
            <button
              className="btn btn-secondary"
              onClick={onReject}
              disabled={accepting}
            >
              Reject
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? 'Accepting...' : 'Accept'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
