import { useEffect, useState } from 'react'
import { useAuthStore } from './hooks/useAuth'
import { AuthPages } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import './App.css'

function App() {
  const { isAuthenticated, loading, initAuth } = useAuthStore()

  useEffect(() => {
    initAuth()
  }, [])

  if (loading) {
    return (
      <div className="app loading">
        <div className="loader"></div>
      </div>
    )
  }

  return (
    <div className="app">
      {isAuthenticated ? <Dashboard /> : <AuthPages />}
    </div>
  )
}

export default App
