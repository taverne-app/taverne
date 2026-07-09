import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from './AppLayout'
import { FloatingDiceRoller } from './FloatingDiceRoller'
import { RulesCompendium } from './RulesCompendium'

/** `bare` renders without the sidebar — used by the campaign list, which sits above any campaign. */
export function ProtectedRoute({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (bare) return <>{children}</>
  return (
    <AppLayout>
      {children}
      <FloatingDiceRoller />
      <RulesCompendium />
    </AppLayout>
  )
}
