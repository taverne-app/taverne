import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth'
import { ApiError } from '../api/client'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== passwordConfirmation) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      await resetPassword(token, email, password, passwordConfirmation)
      navigate('/login?reset=1')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-2xl">⚠️</p>
          <p className="text-stone-300">Lien de réinitialisation invalide.</p>
          <Link to="/forgot-password" className="text-amber-400 hover:text-amber-300 text-sm transition-colors">
            Faire une nouvelle demande
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🍺</span>
          <h1 className="text-3xl font-bold text-amber-400 mt-2">Taverne</h1>
          <p className="text-stone-400 text-sm mt-1">Nouveau mot de passe</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-stone-900 rounded-xl p-6 space-y-4 border border-stone-800"
        >
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
              readOnly
              className="w-full bg-stone-800/50 border border-stone-700 rounded-lg px-3 py-2 text-stone-400 text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-stone-300 text-sm font-medium mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="new-password"
              minLength={8}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-stone-300 text-sm font-medium mb-1.5">Confirmer le mot de passe</label>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={e => setPasswordConfirmation(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
          >
            {loading ? 'Réinitialisation…' : 'Réinitialiser le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
