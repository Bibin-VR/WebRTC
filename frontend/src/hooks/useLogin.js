import { useState } from 'react'
import { useAuthStore } from './useAuth'

export const useLogin = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { login } = useAuthStore()

  const handleLogin = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
      return true
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { handleLogin, loading, error }
}

export const useRegister = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { register } = useAuthStore()

  const handleRegister = async (email, password, displayName) => {
    setLoading(true)
    setError(null)
    try {
      await register(email, password, displayName)
      return true
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { handleRegister, loading, error }
}
