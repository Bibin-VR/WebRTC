import { create } from 'zustand'
import { authApi } from '../services/api'

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  accessToken: null,
  refreshToken: null,

  initAuth: async () => {
    const savedUser = localStorage.getItem('user')
    const savedAccessToken = localStorage.getItem('access_token')
    const savedRefreshToken = localStorage.getItem('refresh_token')

    if (savedUser && savedAccessToken) {
      set({
        user: JSON.parse(savedUser),
        isAuthenticated: true,
        accessToken: savedAccessToken,
        refreshToken: savedRefreshToken,
        loading: false,
      })
    } else {
      set({ loading: false })
    }
  },

  register: async (email, password, displayName) => {
    const response = await authApi.register(email, password, displayName)
    const { user_id, email: userEmail, display_name, access_token, refresh_token } = response.data

    const user = {
      id: user_id,
      email: userEmail,
      displayName: display_name,
    }

    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)

    set({
      user,
      isAuthenticated: true,
      accessToken: access_token,
      refreshToken: refresh_token,
    })

    return user
  },

  login: async (email, password) => {
    const response = await authApi.login(email, password)
    const { user_id, email: userEmail, display_name, access_token, refresh_token } = response.data

    const user = {
      id: user_id,
      email: userEmail,
      displayName: display_name,
    }

    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('access_token', access_token)
    localStorage.setItem('refresh_token', refresh_token)

    set({
      user,
      isAuthenticated: true,
      accessToken: access_token,
      refreshToken: refresh_token,
    })

    return user
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refresh_token')
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken)
      } catch (error) {
        console.error('Logout error:', error)
      }
    }

    localStorage.removeItem('user')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')

    set({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
    })
  },

  updateUser: (user) => set({ user }),
}))
