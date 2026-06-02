import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuth'
import { usersApi, devicesApi, sessionsApi } from '../services/api'
import { wsClient } from '../services/websocket'
import './Dashboard.css'

export const Dashboard = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [users, setUsers] = useState([])
  const [devices, setDevices] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)
  const [initiatingCall, setInitiatingCall] = useState(null)

  useEffect(() => {
    initDashboard()
  }, [])

  const initDashboard = async () => {
    try {
      // Load devices
      const devicesRes = await devicesApi.list()
      setDevices(devicesRes.data.devices || [])

      // Connect WebSocket
      await wsClient.connect(localStorage.getItem('access_token'), user?.id, devicesRes.data.devices?.[0]?.id)
      setWsConnected(true)

      // Listen for presence updates
      wsClient.on('user:online', () => {
        // Presence tracking handled by server
      })

      wsClient.on('user:offline', () => {
        // Presence tracking handled by server
      })

      // Start heartbeat
      const heartbeatInterval = setInterval(() => {
        wsClient.heartbeat()
      }, 30000)

      setLoading(false)

      return () => {
        clearInterval(heartbeatInterval)
        wsClient.disconnect()
      }
    } catch (error) {
      console.error('Failed to initialize dashboard:', error)
      setLoading(false)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    try {
      const res = await usersApi.search(searchQuery)
      setUsers(res.data.users || [])
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  const handleInitiateCall = async (targetUserId, targetDeviceId) => {
    setInitiatingCall(targetDeviceId)
    try {
      const userDevice = devices[0]
      if (!userDevice) {
        alert('No device registered. Please register a device first.')
        return
      }

      const res = await sessionsApi.create(
        targetUserId,
        targetDeviceId,
        userDevice.id,
      )
      const sessionId = res.data.id

      navigate(`/call/${sessionId}`)
    } catch (error) {
      console.error('Failed to initiate call:', error)
      alert('Failed to initiate call')
      setInitiatingCall(null)
    }
  }

  if (loading) {
    return <div className="dashboard loading">Loading...</div>
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>WebRTC Platform</h1>
        <div className="header-right">
          <span className={`ws-status ${wsConnected ? 'connected' : 'disconnected'}`}>
            {wsConnected ? '● Connected' : '● Disconnected'}
          </span>
          <span className="user-name">{user?.displayName}</span>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="sidebar">
          <h2>Your Devices</h2>
          <div className="devices-list">
            {devices.length === 0 ? (
              <p className="empty">No devices registered</p>
            ) : (
              devices.map((device) => (
                <div key={device.id} className="device-item">
                  <div className="device-name">{device.device_name}</div>
                  <div className="device-type">{device.platform}</div>
                  <div className={`device-status ${device.is_online ? 'online' : 'offline'}`}>
                    {device.is_online ? '● Online' : '● Offline'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="main">
          <div className="search-section">
            <form onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search users by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="btn btn-primary">
                Search
              </button>
            </form>
          </div>

          <div className="users-section">
            <h2>Available Users</h2>
            {users.length === 0 ? (
              <p className="empty">No users found. Try searching or wait for online users.</p>
            ) : (
              <div className="users-grid">
                {users.map((u) => (
                  <div key={u.user_id} className="user-card">
                    <div className="user-info">
                      <h3>{u.display_name}</h3>
                      <p>{u.email}</p>
                    </div>
                    <div className="user-devices">
                      {u.devices?.map((device) => (
                        <div
                          key={device.device_id}
                          className={`device-badge ${device.is_online ? 'online' : 'offline'}`}
                        >
                          {device.device_name}
                        </div>
                      ))}
                    </div>
                    {u.devices?.map(
                      (device) =>
                        device.is_online && (
                          <button
                            key={device.device_id}
                            className="btn btn-sm btn-primary"
                            onClick={() =>
                              handleInitiateCall(u.user_id, device.device_id)
                            }
                            disabled={initiatingCall === device.device_id}
                          >
                            {initiatingCall === device.device_id
                              ? 'Calling...'
                              : 'Call'}
                          </button>
                        ),
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
