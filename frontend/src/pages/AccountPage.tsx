import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { updateProfile, updatePassword } from '../api/auth'
import { createPortalSession, createCheckoutSession } from '../api/billing'
import { useSharedTheme, type ThemeChoice } from '../lib/sharedTheme'

const THEME_OPTIONS: [ThemeChoice, string, string][] = [
  ['dark', 'Sombre', 'Fond sombre, idéal en soirée'],
  ['light', 'Clair', 'Parchemin clair, teinté selon l\'heure'],
  ['system', 'Système', 'Suit le réglage de l\'appareil'],
]

const PLAN_LABELS: Record<string, string> = {
  free:        'Gratuit',
  adventurer:  'Aventurier',
  guild:       'Guilde',
}

export function AccountPage() {
  const toast = useToast()
  const { user, setAuth } = useAuth()
  const { themeChoice, chooseTheme } = useSharedTheme()

  const [nameDraft, setNameDraft]   = useState(user?.name ?? '')
  const [emailDraft, setEmailDraft] = useState(user?.email ?? '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving]   = useState(false)
  const [pwMsg, setPwMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  const [upgradingPlan, setUpgradingPlan] = useState<'adventurer' | 'guild' | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const isPaid = user?.plan === 'adventurer' || user?.plan === 'guild'

  async function handleProfileSave() {
    if (!nameDraft.trim() || !emailDraft.trim()) return
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      const fresh = await updateProfile(nameDraft.trim(), emailDraft.trim())
      // preserve token already in context
      const token = localStorage.getItem('token') ?? ''
      setAuth(token, fresh)
      setProfileMsg({ ok: true, text: 'Profil mis à jour.' })
    } catch {
      setProfileMsg({ ok: false, text: 'Erreur lors de la mise à jour.' })
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordSave() {
    if (!currentPw || !newPw || newPw !== confirmPw) return
    setPwSaving(true)
    setPwMsg(null)
    try {
      await updatePassword(currentPw, newPw, confirmPw)
      setPwMsg({ ok: true, text: 'Mot de passe mis à jour.' })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (err: unknown) {
      const msg = (err as { body?: { message?: string } })?.body?.message ?? 'Erreur.'
      setPwMsg({ ok: false, text: msg })
    } finally {
      setPwSaving(false)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const url = await createPortalSession()
      window.location.href = url
    } catch {
      setPortalLoading(false)
      toast.error("Impossible d'ouvrir la gestion de l'abonnement. Réessayez dans un instant.")
    }
  }

  async function handleUpgrade(plan: 'adventurer' | 'guild') {
    setUpgradingPlan(plan)
    try {
      const url = await createCheckoutSession(plan)
      window.location.href = url
    } catch {
      setUpgradingPlan(null)
      toast.error("Impossible d'ouvrir le paiement. Réessayez dans un instant.")
    }
  }

  return (
    <div className="min-h-screen bg-stone-950">
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-center">
          <span className="text-amber-400 font-bold">Mon compte</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Plan */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6">
          <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-4">Abonnement</h2>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-white font-semibold text-lg">
                Plan{' '}
                <span className={isPaid ? 'text-amber-400' : 'text-stone-400'}>
                  {PLAN_LABELS[user?.plan ?? 'free']}
                </span>
              </p>
              <p className="text-stone-500 text-sm mt-0.5">
                {user?.plan === 'free'
                  ? '1 campagne, 4 joueurs max'
                  : user?.plan === 'guild'
                  ? 'Campagnes illimitées · Multi-tables · Support prioritaire'
                  : 'Campagnes illimitées · Joueurs illimités'}
              </p>
            </div>
            {isPaid ? (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
              >
                {portalLoading ? '...' : 'Gérer l\'abonnement'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpgrade('adventurer')}
                  disabled={upgradingPlan !== null}
                  className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  {upgradingPlan === 'adventurer' ? '...' : 'Aventurier — 5€/mois'}
                </button>
                <button
                  onClick={() => handleUpgrade('guild')}
                  disabled={upgradingPlan !== null}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  {upgradingPlan === 'guild' ? '...' : 'Guilde — 10€/mois'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Apparence */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Apparence</h2>
            <p className="text-stone-500 text-sm mt-1">Thème des fiches partagées aux joueurs.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(([choice, label, desc]) => (
              <button
                key={choice}
                onClick={() => chooseTheme(choice)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  themeChoice === choice
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-stone-700 hover:border-stone-600'
                }`}
              >
                <p className={`text-sm font-semibold ${themeChoice === choice ? 'text-amber-400' : 'text-stone-200'}`}>{label}</p>
                <p className="text-stone-500 text-xs mt-0.5 leading-snug">{desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Profile */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Profil</h2>
          <div className="space-y-3">
            <div>
              <label className="text-stone-400 text-xs mb-1 block">Nom</label>
              <input
                type="text"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs mb-1 block">Email</label>
              <input
                type="email"
                value={emailDraft}
                onChange={e => setEmailDraft(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
          {profileMsg && (
            <p className={`text-sm ${profileMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{profileMsg.text}</p>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleProfileSave}
              disabled={profileSaving || !nameDraft.trim() || !emailDraft.trim()}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
            >
              {profileSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </section>

        {/* Password */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Mot de passe</h2>
          <div className="space-y-3">
            <div>
              <label className="text-stone-400 text-xs mb-1 block">Mot de passe actuel</label>
              <input
                type="password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs mb-1 block">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-stone-400 text-xs mb-1 block">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePasswordSave() }}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{pwMsg.text}</p>
          )}
          <div className="flex justify-end">
            <button
              onClick={handlePasswordSave}
              disabled={pwSaving || !currentPw || !newPw || newPw !== confirmPw}
              className="bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
            >
              {pwSaving ? 'Mise à jour…' : 'Changer le mot de passe'}
            </button>
          </div>
        </section>

      </main>
    </div>
  )
}
