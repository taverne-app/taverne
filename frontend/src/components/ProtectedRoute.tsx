import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from './AppLayout'
import { FloatingDiceRoller } from './FloatingDiceRoller'
import { RulesCompendium } from './RulesCompendium'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return (
    <AppLayout>
      {children}
      <FloatingDiceRoller />
      <RulesCompendium />
    </AppLayout>
  )
}
