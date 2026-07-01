import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const resetSuccess = params.get('reset') === '1'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await login(email, password)
      setAuth(token, user)
      navigate('/characters')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Identifiants invalides.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🍺</span>
          <h1 className="text-3xl font-bold text-amber-400 mt-2">Taverne</h1>
          <p className="text-stone-400 text-sm mt-1">Connectez-vous à votre compte</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-stone-900 rounded-xl p-6 space-y-4 border border-stone-800"
        >
          {resetSuccess && (
            <div className="bg-green-900/40 border border-green-700 text-green-300 text-sm rounded-lg px-4 py-2">
              Mot de passe réinitialisé. Vous pouvez vous connecter.
            </div>
          )}
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-stone-300 text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-stone-300 text-sm font-medium">
                Mot de passe
              </label>
              <Link to="/forgot-password" className="text-stone-500 hover:text-amber-400 text-xs transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-stone-500 text-center text-sm mt-4">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-amber-400 hover:text-amber-300 transition-colors">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
