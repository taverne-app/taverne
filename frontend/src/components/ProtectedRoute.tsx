import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from './AppLayout'
import { FloatingDiceRoller, type RollerCampaign } from './FloatingDiceRoller'
import { RulesCompendium } from './RulesCompendium'

/** `bare` renders without the sidebar — used by the campaign list, which sits above any campaign. */
export function ProtectedRoute({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const { token } = useAuth()
  const location = useLocation()
  const params = useParams()
  const [searchParams] = useSearchParams()

  // Le lanceur flotte sur toutes les pages ; il n'a d'historique de table que sur une
  // page rattachée à une campagne. /campaigns/:id porte l'id dans l'URL, /combat le
  // porte en query (?campaign=). Ailleurs (/characters/:id…), pas de contexte campagne :
  // surtout ne pas confondre un id de personnage avec un id de campagne.
  let campaign: RollerCampaign | undefined
  if (location.pathname.startsWith('/campaigns/') && params.id) {
    campaign = { kind: 'dm', id: Number(params.id) }
  } else if (location.pathname === '/combat' && searchParams.get('campaign')) {
    campaign = { kind: 'dm', id: Number(searchParams.get('campaign')) }
  }

  if (!token) return <Navigate to="/login" replace />
  if (bare) return <>{children}</>
  return (
    <AppLayout>
      {children}
      <FloatingDiceRoller campaign={campaign} />
      <RulesCompendium />
    </AppLayout>
  )
}
