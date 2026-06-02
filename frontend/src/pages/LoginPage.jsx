import { useState } from 'react'
import { useLogin } from '../hooks/useLogin'
import './LoginPage.css'

export const LoginPage = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { handleLogin, loading, error } = useLogin()

  const onSubmit = async (e) => {
    e.preventDefault()
    const success = await handleLogin(email, password)
    if (success) {
      window.location.reload()
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>WebRTC Platform</h1>
        <p>Sign in to your account</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="switch-auth">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="link-button"
            disabled={loading}
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  )
}
