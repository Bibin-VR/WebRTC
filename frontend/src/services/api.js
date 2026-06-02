import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  register: (email, password, displayName) =>
    api.post('/auth/register', { email, password, display_name: displayName }),
  login: (email, password) =>
    api.post('/auth/login', { email, password }),
  refresh: (refreshToken) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),
  logout: (refreshToken) =>
    api.post('/auth/logout', { refresh_token: refreshToken }),
}

export const usersApi = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (displayName) =>
    api.put('/users/me', { display_name: displayName }),
  search: (query, limit = 20) =>
    api.get('/users/search', { params: { query, limit } }),
}

export const devicesApi = {
  list: () => api.get('/devices'),
  register: (deviceName, deviceType, platform) =>
    api.post('/devices/register', { device_name: deviceName, device_type: deviceType, platform }),
  get: (deviceId) => api.get(`/devices/${deviceId}`),
  update: (deviceId, deviceName) =>
    api.put(`/devices/${deviceId}`, { device_name: deviceName }),
  delete: (deviceId) => api.delete(`/devices/${deviceId}`),
}

export const sessionsApi = {
  create: (targetUserId, targetDeviceId, initiatorDeviceId) =>
    api.post('/sessions', {
      target_user_id: targetUserId,
      target_device_id: targetDeviceId,
      initiator_device_id: initiatorDeviceId,
    }),
  get: (sessionId) => api.get(`/sessions/${sessionId}`),
  end: (sessionId) => api.delete(`/sessions/${sessionId}`),
}

export default api
