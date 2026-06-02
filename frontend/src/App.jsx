import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './hooks/useAuth'
import { AuthPages } from './pages/Auth'
import { Dashboard } from './pages/Dashboard'
import { CallPage } from './pages/CallPage'
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
      <BrowserRouter>
        <Routes>
          {!isAuthenticated ? (
            <Route path="/*" element={<AuthPages />} />
          ) : (
            <>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/call/:sessionId" element={<CallPage />} />
              <Route path="/*" element={<Navigate to="/dashboard" replace />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
