import { useState } from 'react'
import { useAuthStore } from './useAuth'

function firebaseErrorMessage(code) {
  switch (code) {
    case 'auth/email-already-in-use': return 'Email already registered'
    case 'auth/invalid-email': return 'Invalid email address'
    case 'auth/weak-password': return 'Password must be at least 6 characters'
    case 'auth/user-not-found': return 'No account with this email'
    case 'auth/wrong-password': return 'Incorrect password'
    case 'auth/invalid-credential': return 'Invalid email or password'
    case 'auth/too-many-requests': return 'Too many attempts — try again later'
    default: return 'Authentication failed'
  }
}

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
      setError(firebaseErrorMessage(err.code))
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
      setError(firebaseErrorMessage(err.code))
      return false
    } finally {
      setLoading(false)
    }
  }

  return { handleRegister, loading, error }
}
