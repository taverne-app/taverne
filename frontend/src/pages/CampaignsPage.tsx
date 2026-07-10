import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { createCampaign, deleteCampaign, getCampaign } from '../api/campaigns'
import { listSessions } from '../api/sessions'
import { createCheckoutSession, createPortalSession } from '../api/billing'
import { useAuth } from '../contexts/AuthContext'
import { useCampaigns } from '../contexts/CampaignContext'
import { archiveFilename, buildCampaignZip } from '../lib/campaignArchive'

export function CampaignsPage() {
  const { user, refreshUser } = useAuth()
  const { campaigns, loading, reload, select } = useCampaigns()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  const [creating, setCreating]   = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [saving, setSaving]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [exporting, setExporting] = useState<number | null>(null)
  const [upgradingPlan, setUpgradingPlan] = useState<'adventurer' | 'guild' | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const atCampaignLimit = user?.plan === 'free' && campaigns.length >= 1
  const isPaid = user?.plan === 'adventurer' || user?.plan === 'guild'

  // Un seul chemin à prendre : on l'emprunte. `?all=1` (switcher, gestion) force la liste.
  const showAll = searchParams.get('all') === '1'

  useEffect(() => {
    if (loading || showAll || campaigns.length !== 1) return
    select(campaigns[0].id)
    navigate(`/campaigns/${campaigns[0].id}`, { replace: true })
  }, [loading, showAll, campaigns, select, navigate])

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      refreshUser().then(() => {
        setUpgradeSuccess(true)
        setSearchParams({}, { replace: true })
        setTimeout(() => setUpgradeSuccess(false), 5000)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    if (!nameDraft.trim()) return
    setSaving(true)
    try {
      const c = await createCampaign(nameDraft.trim(), descDraft.trim() || undefined)
      await reload()
      setCreating(false)
      setNameDraft('')
      setDescDraft('')
      select(c.id)
      navigate(`/campaigns/${c.id}`)
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    await deleteCampaign(id)
    await reload()
    setConfirmDelete(null)
  }

  /**
   * Deleting a campaign takes its characters with it, so the archive is written
   * first and the delete only runs once it exists. The list carries no sessions,
   * hence the fetch.
   */
  async function handleExportThenDelete(id: number) {
    setExporting(id)
    try {
      const [full, sessions] = await Promise.all([getCampaign(id), listSessions(id)])
      const blob = buildCampaignZip(full, full.characters ?? [], sessions)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = archiveFilename(full.name)
      a.click()
      URL.revokeObjectURL(url)
      await handleDelete(id)
    } catch {
      alert('L\'export a échoué. La campagne n\'a pas été supprimée.')
    } finally {
      setExporting(null)
    }
  }

  async function handleUpgrade(plan: 'adventurer' | 'guild') {
    setUpgradingPlan(plan)
    try {
      const url = await createCheckoutSession(plan)
      window.location.href = url
    } catch {
      setUpgradingPlan(null)
    }
  }

  async function handlePortal() {
    try {
      const url = await createPortalSession()
      window.location.href = url
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-stone-950">
      <main className="max-w-4xl mx-auto px-4 py-8">
        {upgradeSuccess && (
          <div className="mb-5 bg-amber-950/50 border border-amber-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-amber-300 text-sm font-medium">
              Abonnement activé — bienvenue dans le plan {user?.plan === 'guild' ? 'Guilde' : 'Aventurier'} !
            </p>
            <button onClick={() => setUpgradeSuccess(false)} className="text-amber-600 hover:text-amber-400 text-lg leading-none">×</button>
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <h1 className="text-white text-xl font-display font-semibold tracking-wide">Mes campagnes</h1>
              {isPaid ? (
                <button
                  onClick={handlePortal}
                  className="text-amber-400 hover:text-amber-300 text-xs font-medium border border-amber-800 rounded-full px-2.5 py-0.5 transition-colors"
                >
                  {user?.plan === 'guild' ? 'Guilde' : 'Aventurier'} ✦
                </button>
              ) : (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="text-stone-500 hover:text-amber-400 text-xs border border-stone-700 hover:border-amber-700 rounded-full px-2.5 py-0.5 transition-colors"
                >
                  Gratuit — Passer Pro
                </button>
              )}
            </div>
            <p className="text-stone-500 text-sm">
              {campaigns.length} campagne{campaigns.length !== 1 ? 's' : ''}
            </p>
          </div>
          {atCampaignLimit ? (
            <div className="flex flex-col items-end gap-0.5">
              <button
                disabled
                className="bg-stone-700 text-stone-500 font-semibold text-sm rounded-lg px-4 py-2 cursor-not-allowed"
              >
                + Nouvelle
              </button>
              <span className="text-stone-600 text-xs">Plan gratuit — 1 campagne max</span>
            </div>
          ) : (
            <button
              onClick={() => { setCreating(v => !v); setNameDraft(''); setDescDraft('') }}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg px-4 py-2 transition-colors"
            >
              {creating ? 'Annuler' : '+ Nouvelle'}
            </button>
          )}
        </div>

        {/* Create form */}
        {creating && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-6 space-y-3">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Nouvelle campagne</h2>
            <input
              type="text"
              placeholder="Nom de la campagne"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              autoFocus
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
            <textarea
              placeholder="Description (optionnelle)"
              value={descDraft}
              onChange={e => setDescDraft(e.target.value)}
              rows={2}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
            <div className="flex justify-end">
              <button
                onClick={handleCreate}
                disabled={saving || !nameDraft.trim()}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
              >
                Créer
              </button>
            </div>
          </div>
        )}

        {/* Campaign list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-500 text-4xl mb-4">🗺️</p>
            <p className="text-stone-400 font-medium">Aucune campagne pour l'instant</p>
            <p className="text-stone-600 text-sm mt-1">Créez votre première aventure.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <div key={c.id} className="bg-stone-900 border border-stone-800 rounded-xl p-4 hover:border-stone-700 transition-colors group relative">
                <Link to={`/campaigns/${c.id}`} onClick={() => select(c.id)} className="absolute inset-0 rounded-xl" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold text-base truncate">{c.name}</h3>
                    {c.description && (
                      <p className="text-stone-400 text-sm mt-0.5 line-clamp-1">{c.description}</p>
                    )}
                    <p className="text-stone-600 text-xs mt-1.5">
                      {c.characters.length} personnage{c.characters.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 relative z-10">
                    {confirmDelete === c.id ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-stone-400 text-xs text-right leading-tight">
                          Supprimer emporte aussi {c.characters.length === 0
                            ? 'la campagne seule'
                            : <>ses <b className="text-stone-300">{c.characters.length} personnage{c.characters.length !== 1 ? 's' : ''}</b></>}.
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-stone-500 hover:text-stone-300 text-xs transition-colors px-2 py-1"
                          >
                            Annuler
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={exporting !== null}
                            className="text-red-400 hover:text-red-300 text-xs transition-colors px-2 py-1 disabled:opacity-40"
                          >
                            Supprimer sans exporter
                          </button>
                          <button
                            onClick={() => handleExportThenDelete(c.id)}
                            disabled={exporting !== null}
                            className="bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
                          >
                            {exporting === c.id ? 'Export…' : '↓ Exporter puis supprimer'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(c.id)}
                        className="text-stone-700 hover:text-red-400 text-xs transition-colors opacity-0 group-hover:opacity-100 px-2 py-1"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowUpgradeModal(false)}>
          <div className="bg-stone-900 border border-stone-700 rounded-2xl p-6 max-w-md w-full space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">Passer à la version Pro</h2>
                <p className="text-stone-400 text-sm mt-0.5">Campagnes illimitées, joueurs illimités.</p>
              </div>
              <button onClick={() => setShowUpgradeModal(false)} className="text-stone-600 hover:text-stone-400 text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Aventurier */}
              <div className="border border-stone-700 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-amber-400 font-semibold">Aventurier</p>
                  <p className="text-white font-bold text-2xl mt-0.5">5€<span className="text-stone-500 text-sm font-normal">/mois</span></p>
                </div>
                <ul className="text-stone-400 text-xs space-y-1">
                  <li>Campagnes illimitées</li>
                  <li>Joueurs illimités</li>
                  <li>Toutes les fonctionnalités</li>
                </ul>
                <button
                  onClick={() => handleUpgrade('adventurer')}
                  disabled={upgradingPlan !== null}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg py-2 transition-colors disabled:opacity-40"
                >
                  {upgradingPlan === 'adventurer' ? '...' : 'Choisir'}
                </button>
              </div>

              {/* Guilde */}
              <div className="border border-amber-700/50 bg-amber-950/20 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-amber-300 font-semibold">Guilde</p>
                  <p className="text-white font-bold text-2xl mt-0.5">10€<span className="text-stone-500 text-sm font-normal">/mois</span></p>
                </div>
                <ul className="text-stone-400 text-xs space-y-1">
                  <li>Tout Aventurier</li>
                  <li>Multi-tables</li>
                  <li>Support prioritaire</li>
                </ul>
                <button
                  onClick={() => handleUpgrade('guild')}
                  disabled={upgradingPlan !== null}
                  className="w-full bg-amber-400 hover:bg-amber-300 text-stone-950 font-semibold text-sm rounded-lg py-2 transition-colors disabled:opacity-40"
                >
                  {upgradingPlan === 'guild' ? '...' : 'Choisir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
