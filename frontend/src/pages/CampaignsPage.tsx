import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listCampaigns, createCampaign, deleteCampaign, type Campaign } from '../api/campaigns'
import { logout } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'

export function CampaignsPage() {
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [descDraft, setDescDraft] = useState('')
  const [saving, setSaving]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try { setCampaigns(await listCampaigns()) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleCreate() {
    if (!nameDraft.trim()) return
    setSaving(true)
    try {
      const c = await createCampaign(nameDraft.trim(), descDraft.trim() || undefined)
      setCampaigns(cs => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)))
      setCreating(false)
      setNameDraft('')
      setDescDraft('')
    } finally { setSaving(false) }
  }

  async function handleDelete(id: number) {
    await deleteCampaign(id)
    setCampaigns(cs => cs.filter(c => c.id !== id))
    setConfirmDelete(null)
  }

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-stone-950">
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/characters" className="text-stone-400 hover:text-stone-200 text-sm transition-colors">
              ← Personnages
            </Link>
            <span className="text-stone-700">|</span>
            <span className="text-amber-400 font-bold">Campagnes</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-stone-400 text-sm hidden sm:block">{user?.name}</span>
            <button onClick={handleLogout} className="text-stone-400 hover:text-stone-200 text-sm transition-colors">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-xl font-semibold">Mes campagnes</h1>
            <p className="text-stone-500 text-sm mt-0.5">
              {campaigns.length} campagne{campaigns.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => { setCreating(v => !v); setNameDraft(''); setDescDraft('') }}
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-lg px-4 py-2 transition-colors"
          >
            {creating ? 'Annuler' : '+ Nouvelle'}
          </button>
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
                <Link to={`/campaigns/${c.id}`} className="absolute inset-0 rounded-xl" />
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
                      <>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-stone-500 hover:text-stone-300 text-xs transition-colors px-2 py-1"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors px-2 py-1"
                        >
                          Confirmer
                        </button>
                      </>
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
    </div>
  )
}
