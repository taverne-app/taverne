import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email)
    } catch {
      // always show success to avoid email enumeration
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🍺</span>
          <h1 className="text-3xl font-bold text-amber-400 mt-2">Taverne</h1>
          <p className="text-stone-400 text-sm mt-1">Réinitialisation du mot de passe</p>
        </div>

        <div className="bg-stone-900 rounded-xl p-6 border border-stone-800">
          {submitted ? (
            <div className="text-center space-y-4">
              <p className="text-2xl">📬</p>
              <p className="text-stone-300 text-sm leading-relaxed">
                Si un compte existe pour <span className="text-white font-medium">{email}</span>,
                vous recevrez un email avec un lien de réinitialisation dans quelques instants.
              </p>
              <p className="text-stone-500 text-xs">Vérifiez vos spams si vous ne le recevez pas.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-stone-400 text-sm leading-relaxed">
                Saisissez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
              </p>
              <div>
                <label className="block text-stone-300 text-sm font-medium mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {loading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>
          )}
        </div>

        <p className="text-stone-500 text-center text-sm mt-4">
          <Link to="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
