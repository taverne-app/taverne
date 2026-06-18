import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FloatingDiceRoller } from './FloatingDiceRoller'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return (
    <>
      {children}
      <FloatingDiceRoller />
    </>
  )
}
