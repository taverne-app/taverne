import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchCurrentUser, type User } from '../api/auth'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthState>({} as AuthState)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? (JSON.parse(stored) as User) : null
    } catch {
      return null
    }
  })

  function setAuth(newToken: string, newUser: User) {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  function clearAuth() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  async function refreshUser() {
    try {
      const fresh = await fetchCurrentUser()
      localStorage.setItem('user', JSON.stringify(fresh))
      setUser(fresh)
    } catch { /* ignore — clearAuth appelé ailleurs si 401 */ }
  }

  return (
    <AuthContext.Provider value={{ token, user, setAuth, clearAuth, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
