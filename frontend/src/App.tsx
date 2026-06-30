import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { CharactersPage } from './pages/CharactersPage'
import { CharacterPage } from './pages/CharacterPage'
import { CombatPage } from './pages/CombatPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { CampaignPage } from './pages/CampaignPage'
import { SharedCampaignPage } from './pages/SharedCampaignPage'
import { DashboardPage } from './pages/DashboardPage'
import { CharacterPrintPage } from './pages/CharacterPrintPage'
import { SharedCharacterPage } from './pages/SharedCharacterPage'
import { LiveCombatPage } from './pages/LiveCombatPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/characters"
            element={
              <ProtectedRoute>
                <CharactersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/characters/:id"
            element={
              <ProtectedRoute>
                <CharacterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/combat"
            element={
              <ProtectedRoute>
                <CombatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <CampaignsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaigns/:id"
            element={
              <ProtectedRoute>
                <CampaignPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/characters/:id/print"
            element={
              <ProtectedRoute>
                <CharacterPrintPage />
              </ProtectedRoute>
            }
          />
          <Route path="/share/:token/live" element={<LiveCombatPage />} />
          <Route path="/share/:token" element={<SharedCampaignPage />} />
          <Route path="/share/character/:token" element={<SharedCharacterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
