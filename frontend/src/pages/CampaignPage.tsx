import { useEffect, useState, lazy, Suspense } from 'react'

// Chargé paresseusement : la section Monde (1 400 lignes) n'est téléchargée que si
// on l'ouvre, au lieu de peser sur chaque visite de la campagne.
const CampaignWorldSection = lazy(() => import('./campaign/CampaignWorldSection'))
const CampaignChapterSection = lazy(() => import('./campaign/CampaignChapterSection'))
const CampaignAdventureSection = lazy(() => import('./campaign/CampaignAdventureSection'))
const CampaignOverviewSection = lazy(() => import('./campaign/CampaignOverviewSection'))
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getCampaign,
  updateCampaign,
  addCharacterToCampaign,
  type Campaign,
  type Npc,
  type Location,
  type Faction,
  type Quest,
} from '../api/campaigns'
import { type Character } from '../api/characters'
import {
  listChapters,
  type Chapter,
} from '../api/chapters'
import { useAuth } from '../contexts/AuthContext'
import { createEcho, REALTIME_CONFIGURED } from '../lib/echo'
import { useToast } from '../contexts/ToastContext'

// ── Helpers ───────────────────────────────────────────────────────────────────





// ── Main page ─────────────────────────────────────────────────────────────────

export function CampaignPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const { token } = useAuth()
  const navigate = useNavigate()

  const [campaign, setCampaign]     = useState<Campaign | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)


  // Add character modal
  const [showAddModal, setShowAddModal]         = useState(false)
  const [allChars, setAllChars]                 = useState<Character[]>([])

  // Share

  // Group rest

  // DM Screen

  // Notes MJ

  // PNJs

  // Calendrier

  // Chapitres
  const [chapters, setChapters]               = useState<Chapter[]>([])

  // Quêtes

  // Trésor partagé

  // Lieux

  // Préparation de session

  // Bestiaire personnalisé

  // Factions

  // Générateur de PNJ

  // XP

  // Tables aléatoires

  // Scènes de préparation

  // Jalons de campagne

  // Carte de campagne

  // Navigation par onglets
  const VALID_TABS = ['chapitres', 'monde', 'aventure', 'campagne'] as const
  type Tab = typeof VALID_TABS[number]
  /**
   * L'onglet vit dans l'URL, pas dans le localStorage : sans ça, aucun lien
   * partageable vers une section, et le bouton « Retour » du navigateur ne
   * ramenait pas à l'onglet précédent.
   */
  const { tab: tabParam } = useParams<{ tab?: string }>()
  const activeTab: Tab = VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'chapitres'

  // URL canonique : /campaigns/:id renvoie vers sa première section, sinon aucune
  // entrée de la barre latérale n'apparaîtrait active.
  useEffect(() => {
    if (id && !VALID_TABS.includes(tabParam as Tab)) {
      navigate(`/campaigns/${id}/chapitres`, { replace: true })
    }
  }, [id, tabParam, navigate])

  // Tableau de bord

  // Export / Import

  // Recherche globale
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('taverne-search-history') ?? '[]') } catch { return [] }
  })
  const [searchFavorites, setSearchFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('taverne-search-favorites') ?? '[]') } catch { return [] }
  })

  // Copy feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Audit

  // HP rapide (tableau de bord santé du groupe)

  // Load campaign
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getCampaign(Number(id))
      .then(c => {
        setCampaign(c)
        setCharacters(c.characters)
      })
      .catch(() => navigate('/campaigns'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (!id) return
    listChapters(Number(id)).then(setChapters).catch(() => {})
  }, [id])

  // Real-time WS subscription per character
  const charIds = characters.map(c => c.id).join(',')
  useEffect(() => {
    if (!token || characters.length === 0 || !REALTIME_CONFIGURED) return
    const echo = createEcho(token)
    characters.forEach(c => {
      echo.private(`character.${c.id}`).listen('.character.updated', (e: { character: Character }) => {
        setCharacters(prev => prev.map(ch => ch.id === e.character.id ? e.character : ch))
      })
    })
    return () => {
      characters.forEach(c => echo.leave(`character.${c.id}`))
      echo.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, charIds])




  async function handleAdd(characterId: number) {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await addCharacterToCampaign(campaign.id, characterId)
      setCampaign(updated)
      setCharacters(updated.characters)
      setShowAddModal(false)
    } finally { setSaving(false) }
  }

  /**
   * A character cannot exist outside a campaign, so pulling one out of the
   * campaign means deleting it. The button says so.
   */
















































































  function copyToClipboard(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 1500)
    })
  }

  function saveSearchToHistory(q: string) {
    if (q.trim().length < 2) return
    setSearchHistory(prev => {
      const next = [q.trim(), ...prev.filter(s => s !== q.trim())].slice(0, 10)
      try { localStorage.setItem('taverne-search-history', JSON.stringify(next)) } catch {}
      return next
    })
  }

  function toggleSearchFavorite(q: string) {
    setSearchFavorites(prev => {
      const next = prev.includes(q) ? prev.filter(s => s !== q) : [...prev, q]
      try { localStorage.setItem('taverne-search-favorites', JSON.stringify(next)) } catch {}
      return next
    })
  }

  function removeFromHistory(q: string) {
    setSearchHistory(prev => {
      const next = prev.filter(s => s !== q)
      try { localStorage.setItem('taverne-search-history', JSON.stringify(next)) } catch {}
      return next
    })
  }

  function exportSection(sectionKey: string, data: unknown[]) {
    if (!campaign) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_${sectionKey}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importSectionData(file: File, section: 'npcs' | 'locations' | 'quests' | 'factions') {
    if (!campaign) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const arr: unknown[] = Array.isArray(parsed) ? parsed : (Array.isArray((parsed as { data?: unknown[] }).data) ? (parsed as { data: unknown[] }).data : [])
      if (arr.length === 0) return
      let updated: Campaign
      if (section === 'npcs') updated = await updateCampaign(Number(id), { npcs: [...(campaign.npcs ?? []), ...(arr as Npc[])] })
      else if (section === 'locations') updated = await updateCampaign(Number(id), { locations: [...(campaign.locations ?? []), ...(arr as Location[])] })
      else if (section === 'quests') updated = await updateCampaign(Number(id), { quests: [...(campaign.quests ?? []), ...(arr as Quest[])] })
      else updated = await updateCampaign(Number(id), { factions: [...(campaign.factions ?? []), ...(arr as Faction[])] })
      setCampaign(updated)
    } catch { toast.error('Fichier invalide ou format non reconnu.') }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!campaign) return null

  // Ce que les sections partagent réellement. Le reste de l'état (195 déclarations
  // sur 214) appartient à une seule section et y descend.
  const sectionProps = {
    campaign, setCampaign, characters, setCharacters, saving, setSaving,
    chapters, setChapters,
    setAllChars, setShowAddModal,
    copiedKey, copyToClipboard, exportSection, importSectionData,
  }

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/campaigns?all=1" className="text-stone-400 hover:text-stone-200 text-sm shrink-0 transition-colors">
              ← Campagnes
            </Link>
            <span className="text-stone-700">|</span>
            <span className="text-amber-400 font-display font-semibold tracking-wide truncate">{campaign.name}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {saving && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
          </div>
        </div>
      </header>

      {/* Onglets */}

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Recherche globale */}
        {(() => {
          const q = searchQuery.trim().toLowerCase()
          const active = q.length >= 2
          const npcs = active ? (campaign.npcs ?? []).filter(n =>
            n.name.toLowerCase().includes(q) || n.role.toLowerCase().includes(q) || n.notes.toLowerCase().includes(q)
          ) : []
          const locs = active ? (campaign.locations ?? []).filter(l => l.name.toLowerCase().includes(q) || l.notes.toLowerCase().includes(q)) : []
          const monsters = active ? (campaign.custom_monsters ?? []).filter(m => m.name.toLowerCase().includes(q)) : []
          const chaps = active ? chapters.filter(c => c.title.toLowerCase().includes(q) || (c.notes ?? '').toLowerCase().includes(q)) : []
          const quests = active ? (campaign.quests ?? []).filter(qt => qt.title.toLowerCase().includes(q) || qt.description.toLowerCase().includes(q) || qt.giver.toLowerCase().includes(q)) : []
          const factions = active ? (campaign.factions ?? []).filter(f => f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)) : []
          const total = npcs.length + locs.length + monsters.length + chaps.length + quests.length + factions.length
          return (
            <>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher dans la campagne — PNJ, lieux, monstres, chapitres, quêtes, factions…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
                {active ? (
                  <button onClick={() => { saveSearchToHistory(searchQuery); setSearchQuery('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-lg leading-none transition-colors">×</button>
                ) : (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 text-sm">🔍</span>
                )}
                {searchFocused && !active && (searchFavorites.length > 0 || searchHistory.filter(s => !searchFavorites.includes(s)).length > 0) && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-stone-900 border border-stone-800 rounded-xl shadow-xl overflow-hidden">
                    {searchFavorites.map(s => (
                      <div key={s} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-800 group">
                        <span className="text-amber-400 text-xs shrink-0">⭐</span>
                        <button onMouseDown={() => setSearchQuery(s)} className="flex-1 text-left text-sm text-stone-300 truncate">{s}</button>
                        <button onMouseDown={() => toggleSearchFavorite(s)} className="text-stone-600 hover:text-stone-400 text-xs opacity-0 group-hover:opacity-100 shrink-0" title="Désépingler">✕</button>
                      </div>
                    ))}
                    {searchHistory.filter(s => !searchFavorites.includes(s)).map(s => (
                      <div key={s} className="flex items-center gap-2 px-3 py-2 hover:bg-stone-800 group border-t border-stone-800/60">
                        <span className="text-stone-600 text-xs shrink-0">🕐</span>
                        <button onMouseDown={() => setSearchQuery(s)} className="flex-1 text-left text-sm text-stone-500 truncate">{s}</button>
                        <button onMouseDown={() => toggleSearchFavorite(s)} className="text-stone-600 hover:text-amber-400 text-xs opacity-0 group-hover:opacity-100 shrink-0" title="Épingler">⭐</button>
                        <button onMouseDown={() => removeFromHistory(s)} className="text-stone-600 hover:text-stone-400 text-xs opacity-0 group-hover:opacity-100 shrink-0" title="Supprimer">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {active && (
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-4 -mt-3">
                  {total === 0 ? (
                    <p className="text-stone-500 text-sm text-center py-2">Aucun résultat pour «{searchQuery.trim()}»</p>
                  ) : (
                    <>
                      {npcs.length > 0 && (
                        <div>
                          <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">PNJ ({npcs.length})</p>
                          <div className="divide-y divide-stone-800">
                            {npcs.map((n, i) => (
                              <div key={i} className="flex items-center gap-3 py-1.5">
                                <span className="text-base shrink-0">{n.status === 'allié' ? '🟢' : n.status === 'ennemi' ? '🔴' : n.status === 'neutre' ? '🟡' : '❓'}</span>
                                <span className="text-white text-sm font-medium">{n.name}</span>
                                {n.role && <span className="text-stone-500 text-xs">{n.role}</span>}
                                {n.location && <span className="text-stone-600 text-xs">📍 {n.location}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {locs.length > 0 && (
                        <div>
                          <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Lieux ({locs.length})</p>
                          <div className="divide-y divide-stone-800">
                            {locs.map((l, i) => (
                              <div key={i} className="flex items-center gap-3 py-1.5">
                                <span className="text-white text-sm font-medium">{l.name}</span>
                                <span className="text-stone-500 text-xs capitalize">{l.type}</span>
                                <span className={`text-xs ${l.status === 'exploré' ? 'text-emerald-400' : l.status === 'connu' ? 'text-amber-400' : 'text-stone-500'}`}>{l.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {monsters.length > 0 && (
                        <div>
                          <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Bestiaire ({monsters.length})</p>
                          <div className="divide-y divide-stone-800">
                            {monsters.map((m, i) => (
                              <div key={i} className="flex items-center gap-3 py-1.5">
                                <span className="text-white text-sm font-medium">{m.name}</span>
                                <span className="text-stone-500 text-xs">CR {m.cr} · {m.hp_avg} PV · CA {m.ac}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {chaps.length > 0 && (
                        <div>
                          <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Chapitres ({chaps.length})</p>
                          <div className="divide-y divide-stone-800">
                            {chaps.map(c => (
                              <div key={c.id} className="flex items-center gap-3 py-1.5">
                                <span className="text-white text-sm font-medium">{c.title}</span>
                                {c.done && <span className="text-stone-500 text-xs">terminé</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {quests.length > 0 && (
                        <div>
                          <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Quêtes ({quests.length})</p>
                          <div className="divide-y divide-stone-800">
                            {quests.map(qt => (
                              <div key={qt.id} className="flex items-center gap-3 py-1.5">
                                <span className="text-base shrink-0">{qt.status === 'active' ? '🟡' : qt.status === 'completed' ? '🟢' : qt.status === 'failed' ? '🔴' : '⚪'}</span>
                                <span className="text-white text-sm font-medium">{qt.title}</span>
                                {qt.giver && <span className="text-stone-500 text-xs">— {qt.giver}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {factions.length > 0 && (
                        <div>
                          <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Factions ({factions.length})</p>
                          <div className="divide-y divide-stone-800">
                            {factions.map((f, i) => (
                              <div key={i} className="flex items-center gap-3 py-1.5">
                                <span className="text-white text-sm font-medium">{f.name}</span>
                                {f.description && <span className="text-stone-500 text-xs truncate max-w-xs">{f.description}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )
        })()}

        {/* Section Chapitres : chunk séparé. */}
        <Suspense fallback={<p className="text-stone-600 text-sm py-8 text-center">Chargement…</p>}>
          {activeTab === 'chapitres' && <CampaignChapterSection {...sectionProps} />}
        </Suspense>

        {/* Section Campagne : chunk séparé. */}
        <Suspense fallback={<p className="text-stone-600 text-sm py-8 text-center">Chargement…</p>}>
          {activeTab === 'campagne' && <CampaignOverviewSection {...sectionProps} />}
        </Suspense>

        {/* Section Monde : chunk séparé, chargé seulement si on ouvre l'onglet. */}
        <Suspense fallback={<p className="text-stone-600 text-sm py-8 text-center">Chargement…</p>}>
          {activeTab === 'monde' && <CampaignWorldSection {...sectionProps} />}
        </Suspense>




        {/* Section Aventure : chunk séparé. */}
        <Suspense fallback={<p className="text-stone-600 text-sm py-8 text-center">Chargement…</p>}>
          {activeTab === 'aventure' && <CampaignAdventureSection {...sectionProps} />}
        </Suspense>






      </main>

      {/* Add character modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-stone-900 border border-stone-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-white font-semibold mb-4">Ajouter un personnage</h2>
            {allChars.length === 0 ? (
              <p className="text-stone-500 text-sm">
                Tous vos personnages sont déjà dans cette campagne ou vous n'en avez pas encore.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {allChars.map(c => (
                  <button
                    key={c.id}
                    onClick={() => handleAdd(c.id)}
                    disabled={saving}
                    className="w-full flex items-center justify-between bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl px-4 py-3 transition-colors disabled:opacity-40 text-left"
                  >
                    <div>
                      <p className="text-white font-medium text-sm">{c.name}</p>
                      <p className="text-stone-500 text-xs">{c.race} · {c.character_class} · Niv. {c.level}</p>
                    </div>
                    <span className="text-amber-400 text-sm font-bold ml-3">+</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowAddModal(false)}
              className="mt-4 w-full text-stone-500 hover:text-stone-300 text-sm transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
