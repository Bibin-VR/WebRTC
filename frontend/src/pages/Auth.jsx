import { useState } from 'react'
import { LoginPage } from './LoginPage'
import { RegisterPage } from './RegisterPage'

export const AuthPages = () => {
  const [page, setPage] = useState('login')

  return (
    <>
      {page === 'login' ? (
        <LoginPage onSwitchToRegister={() => setPage('register')} />
      ) : (
        <RegisterPage onSwitchToLogin={() => setPage('login')} />
      )}
    </>
  )
}
