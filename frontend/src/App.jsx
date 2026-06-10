import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TargetPage } from './pages/TargetPage'
import { MonitorPage } from './pages/MonitorPage'
import './App.css'

function App() {
  return (
    <div className="app">
      <HashRouter>
        <Routes>
          <Route path="/target" element={<TargetPage />} />
          <Route path="/monitor/:slot" element={<MonitorPage />} />
          <Route path="/*" element={<Navigate to="/target" replace />} />
        </Routes>
      </HashRouter>
    </div>
  )
}

export default App
