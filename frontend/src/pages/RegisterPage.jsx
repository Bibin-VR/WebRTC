import { useState } from 'react'
import { useRegister } from '../hooks/useLogin'
import './RegisterPage.css'

export const RegisterPage = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const { handleRegister, loading, error } = useRegister()

  const onSubmit = async (e) => {
    e.preventDefault()
    const success = await handleRegister(email, password, displayName)
    if (success) {
      window.location.reload()
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>WebRTC Platform</h1>
        <p>Create your account</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
              required
              disabled={loading}
            />
          </div>

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
              minLength="8"
              required
              disabled={loading}
            />
            <small>At least 8 characters</small>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="switch-auth">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="link-button"
            disabled={loading}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
