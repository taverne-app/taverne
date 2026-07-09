import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export function RegisterPage() {
  const { setAuth } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setGlobalError(null)
    setLoading(true)
    try {
      const { token, user } = await register(name, email, password)
      setAuth(token, user)
      navigate('/campaigns')
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors((err.data.errors as Record<string, string[]>) ?? {})
      } else {
        setGlobalError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      }
    } finally {
      setLoading(false)
    }
  }

  const fieldError = (field: string) =>
    errors[field]?.[0] ? (
      <p className="text-red-400 text-xs mt-1">{errors[field][0]}</p>
    ) : null

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🍺</span>
          <h1 className="text-3xl font-bold text-amber-400 mt-2">Taverne</h1>
          <p className="text-stone-400 text-sm mt-1">Créez votre compte</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-stone-900 rounded-xl p-6 space-y-4 border border-stone-800"
        >
          {globalError && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-2">
              {globalError}
            </div>
          )}

          <div>
            <label className="block text-stone-300 text-sm font-medium mb-1.5">
              Nom d'aventurier
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="name"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
            {fieldError('name')}
          </div>

          <div>
            <label className="block text-stone-300 text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
            {fieldError('email')}
          </div>

          <div>
            <label className="block text-stone-300 text-sm font-medium mb-1.5">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
            {fieldError('password')}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-stone-500 text-center text-sm mt-4">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
