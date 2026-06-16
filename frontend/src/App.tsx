import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { CharactersPage } from './pages/CharactersPage'
import { CharacterPage } from './pages/CharacterPage'
import { CombatPage } from './pages/CombatPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
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
          <Route path="*" element={<Navigate to="/characters" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
