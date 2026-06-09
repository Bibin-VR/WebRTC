import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import {
  searchUsers, listDevices, registerDevice, deleteDevice,
  watchOnlineUsers, createSession, watchIncomingCalls, acceptSession, rejectSession,
} from '../services/firebaseDb'
import './Dashboard.css'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [users, setUsers] = useState([])
  const [devices, setDevices] = useState([])
  const [onlineUsers, setOnlineUsers] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [initiatingCall, setInitiatingCall] = useState(null)
  const [incomingCalls, setIncomingCalls] = useState([])
  const [newDeviceName, setNewDeviceName] = useState('')

  useEffect(() => {
    if (!user?.id) return

    const loadDevices = async () => {
      const devs = await listDevices(user.id)
      setDevices(devs)
      setLoading(false)
    }
    loadDevices()

    const unsubPresence = watchOnlineUsers((online) => setOnlineUsers(online))
    const unsubCalls = watchIncomingCalls(user.id, (calls) => setIncomingCalls(calls))

    return () => {
      unsubPresence()
      unsubCalls()
    }
  }, [user?.id])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    const results = await searchUsers(searchQuery)
    setUsers(results.filter((u) => u.id !== user.id))
  }

  const handleRegisterDevice = async (e) => {
    e.preventDefault()
    if (!newDeviceName.trim()) return
    const platform = navigator.userAgent.includes('Mac') ? 'macOS'
      : navigator.userAgent.includes('Win') ? 'Windows' : 'Linux'
    const dev = await registerDevice(user.id, newDeviceName, platform)
    setDevices((prev) => [...prev, dev])
    setNewDeviceName('')
  }

  const handleDeleteDevice = async (deviceId) => {
    await deleteDevice(user.id, deviceId)
    setDevices((prev) => prev.filter((d) => d.id !== deviceId))
  }

  const handleInitiateCall = async (targetUserId) => {
    setInitiatingCall(targetUserId)
    try {
      const session = await createSession(user.id, targetUserId)
      navigate(`/call/${session.id}`)
    } catch (error) {
      console.error('Failed to initiate call:', error)
      alert('Failed to initiate call')
      setInitiatingCall(null)
    }
  }

  const handleAcceptCall = async (sessionId) => {
    await acceptSession(sessionId)
    navigate(`/call/${sessionId}`)
  }

  const handleRejectCall = async (sessionId) => {
    await rejectSession(sessionId)
  }

  if (loading) {
    return <div className="dashboard loading">Loading...</div>
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>WebRTC Platform</h1>
        <div className="header-right">
          <span className="ws-status connected">● Online</span>
          <span className="user-name">{user?.displayName}</span>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </header>

      {/* Incoming call banner */}
      {incomingCalls.map((call) => (
        <div key={call.id} className="incoming-call-banner">
          <span>Incoming call from {call.initiatorId}</span>
          <button className="btn btn-sm btn-primary" onClick={() => handleAcceptCall(call.id)}>Accept</button>
          <button className="btn btn-sm btn-secondary" onClick={() => handleRejectCall(call.id)}>Reject</button>
        </div>
      ))}

      <div className="dashboard-content">
        <div className="sidebar">
          <h2>Your Devices</h2>
          <form onSubmit={handleRegisterDevice} className="add-device-form">
            <input
              type="text"
              placeholder="Device name..."
              value={newDeviceName}
              onChange={(e) => setNewDeviceName(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="btn btn-primary btn-sm">Add</button>
          </form>
          <div className="devices-list">
            {devices.length === 0 ? (
              <p className="empty">No devices registered</p>
            ) : (
              devices.map((device) => (
                <div key={device.id} className="device-item">
                  <div className="device-name">{device.deviceName}</div>
                  <div className="device-type">{device.platform}</div>
                  <button className="btn-delete" onClick={() => handleDeleteDevice(device.id)}>x</button>
                </div>
              ))
            )}
          </div>

          <h2>Online Users</h2>
          <div className="devices-list">
            {Object.entries(onlineUsers)
              .filter(([uid]) => uid !== user.id)
              .map(([uid, data]) => (
              <div key={uid} className="device-item online-user">
                <div className="device-name">{data.displayName || uid}</div>
                <div className="device-status online">● Online</div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => handleInitiateCall(uid)}
                  disabled={initiatingCall === uid}
                >
                  {initiatingCall === uid ? 'Calling...' : 'Call'}
                </button>
              </div>
            ))}
            {Object.keys(onlineUsers).filter((uid) => uid !== user.id).length === 0 && (
              <p className="empty">No other users online</p>
            )}
          </div>
        </div>

        <div className="main">
          <div className="search-section">
            <form onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
          </div>

          <div className="users-section">
            <h2>Search Results</h2>
            {users.length === 0 ? (
              <p className="empty">Search for users above or call online users from the sidebar.</p>
            ) : (
              <div className="users-grid">
                {users.map((u) => (
                  <div key={u.id} className="user-card">
                    <div className="user-info">
                      <h3>{u.displayName}</h3>
                      <p>{u.email}</p>
                    </div>
                    <div className={`user-online-badge ${onlineUsers[u.id] ? 'online' : 'offline'}`}>
                      {onlineUsers[u.id] ? '● Online' : '● Offline'}
                    </div>
                    {onlineUsers[u.id] && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleInitiateCall(u.id)}
                        disabled={initiatingCall === u.id}
                      >
                        {initiatingCall === u.id ? 'Calling...' : 'Call'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
