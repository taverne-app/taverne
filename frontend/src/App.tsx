import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { CampaignProvider } from './contexts/CampaignContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { AccountPage } from './pages/AccountPage'
import { LegalPage } from './pages/LegalPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { CharactersPage } from './pages/CharactersPage'
import { CharacterPage } from './pages/CharacterPage'
import { CombatPage } from './pages/CombatPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { CampaignPage } from './pages/CampaignPage'
import ToolsPage from './pages/ToolsPage'
import { SharedCampaignPage } from './pages/SharedCampaignPage'
import { DashboardPage } from './pages/DashboardPage'
import { CharacterPrintPage } from './pages/CharacterPrintPage'
import { SharedCharacterPage } from './pages/SharedCharacterPage'
import { LiveCombatPage } from './pages/LiveCombatPage'

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <CampaignProvider>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
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
              <ProtectedRoute bare>
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
          {/* Chaque section de campagne a son URL : lien partageable et bouton Retour. */}
          <Route
            path="/campaigns/:id/:tab"
            element={
              <ProtectedRoute>
                <CampaignPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/outils"
            element={
              <ProtectedRoute>
                <ToolsPage />
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
          <Route path="/legal"   element={<LegalPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
        </CampaignProvider>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
