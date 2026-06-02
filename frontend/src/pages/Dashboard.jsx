import { useEffect, useState } from 'react'
import { useAuthStore } from '../hooks/useAuth'
import { usersApi, devicesApi } from '../services/api'
import { wsClient } from '../services/websocket'
import './Dashboard.css'

export const Dashboard = () => {
  const { user, logout } = useAuthStore()
  const [users, setUsers] = useState([])
  const [devices, setDevices] = useState([])
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [wsConnected, setWsConnected] = useState(false)

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
      wsClient.on('user:online', (msg) => {
        setOnlineUsers((prev) => new Set([...prev, msg.user_id]))
      })

      wsClient.on('user:offline', (msg) => {
        setOnlineUsers((prev) => {
          const newSet = new Set(prev)
          newSet.delete(msg.user_id)
          return newSet
        })
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
                    {u.devices?.some((d) => d.is_online) && (
                      <button className="btn btn-sm btn-primary">Connect</button>
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
