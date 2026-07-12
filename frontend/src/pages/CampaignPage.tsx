import { useEffect, useState, lazy, Suspense } from 'react'

// Chargé paresseusement : la section Monde (1 400 lignes) n'est téléchargée que si
// on l'ouvre, au lieu de peser sur chaque visite de la campagne.
const CampaignWorldSection = lazy(() => import('./campaign/CampaignWorldSection'))
const CampaignSessionSection = lazy(() => import('./campaign/CampaignSessionSection'))
const CampaignAdventureSection = lazy(() => import('./campaign/CampaignAdventureSection'))
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getCampaign,
  createCampaign,
  updateCampaign,
  addCharacterToCampaign,
  type Campaign,
  type Npc,
  type GameCalendar,
  type TreasureItem,
  type Location,
  type SessionPrep,
  type CustomMonster,
  type Faction,
  type RandomTable,
  type CampaignMap,
  type Milestone,
  type Quest,
  type SavedEncounter,
} from '../api/campaigns'
import { generateShareToken, revokeShareToken } from '../api/share'
import { importCharacter, updateIdentity, type Character } from '../api/characters'
import {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  type CampaignSession,
} from '../api/sessions'
import { useAuth } from '../contexts/AuthContext'
import { createEcho, REALTIME_CONFIGURED } from '../lib/echo'
import { archiveFilename, buildCampaignZip, parseCampaignArchive, ArchiveError } from '../lib/campaignArchive'
import { ZipError } from '../lib/zip'
import { MarkdownText } from '../components/MarkdownText'
import { MicButton } from '../components/MicButton'
import { useToast } from '../contexts/ToastContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}




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

  // Inline name/description editing
  const [editing, setEditing]       = useState(false)
  const [nameDraft, setNameDraft]   = useState('')
  const [descDraft, setDescDraft]   = useState('')

  // Add character modal
  const [showAddModal, setShowAddModal]         = useState(false)
  const [allChars, setAllChars]                 = useState<Character[]>([])

  // Share
  const [copied, setCopied] = useState(false)

  // Group rest

  // DM Screen

  // Notes MJ

  // PNJs

  // Calendrier
  const [calendarDraft, setCalendarDraft] = useState<Partial<GameCalendar>>({})
  const [savingCalendar, setSavingCalendar] = useState(false)

  // Sessions
  const emptySessionDraft = () => ({ title: '', session_date: '', notes: '', xp_awarded: '', loot_notes: '' })
  const [sessions, setSessions]               = useState<CampaignSession[]>([])
  const [addingSession, setAddingSession]     = useState(false)
  const [sessionDraft, setSessionDraft]       = useState(emptySessionDraft())
  const [editingSession, setEditingSession]   = useState<number | null>(null)
  const [editSessionDraft, setEditSessionDraft] = useState(emptySessionDraft())
  const [expandedSession, setExpandedSession] = useState<number | null>(null)
  const [sessionView, setSessionView] = useState<'list' | 'timeline'>('list')
  const [sessionSearch, setSessionSearch] = useState('')
  const [sessionSort, setSessionSort] = useState<'newest' | 'oldest' | 'title'>('newest')

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
  const emptyMilestone = (): Omit<Milestone, 'id'> => ({ date: '', title: '', type: 'other', notes: '' })
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [milestoneDraft, setMilestoneDraft] = useState<Omit<Milestone, 'id'>>(emptyMilestone())
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [editMilestoneDraft, setEditMilestoneDraft] = useState<Omit<Milestone, 'id'>>(emptyMilestone())
  const [milestoneTypeFilter, setMilestoneTypeFilter] = useState<'all' | Milestone['type']>('all')
  const [milestoneSearch, setMilestoneSearch] = useState('')
  const [timelineSort, setTimelineSort] = useState<'newest' | 'oldest'>('newest')

  // Carte de campagne

  // Navigation par onglets
  const VALID_TABS = ['session', 'monde', 'aventure', 'journal', 'campagne'] as const
  type Tab = typeof VALID_TABS[number]
  /**
   * L'onglet vit dans l'URL, pas dans le localStorage : sans ça, aucun lien
   * partageable vers une section, et le bouton « Retour » du navigateur ne
   * ramenait pas à l'onglet précédent.
   */
  const { tab: tabParam } = useParams<{ tab?: string }>()
  const activeTab: Tab = VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'session'
  const setActiveTab = (t: Tab) => navigate(`/campaigns/${id}/${t}`)

  // Tableau de bord

  // Export / Import
  const [importing, setImporting] = useState(false)

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
  const [showAudit, setShowAudit] = useState(false)

  // HP rapide (tableau de bord santé du groupe)

  // Load campaign
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getCampaign(Number(id))
      .then(c => {
        setCampaign(c)
        setCharacters(c.characters)
        setCalendarDraft(c.game_calendar ?? {})
      })
      .catch(() => navigate('/campaigns'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (!id) return
    listSessions(Number(id)).then(setSessions).catch(() => {})
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

  function startEdit() {
    if (!campaign) return
    setNameDraft(campaign.name)
    setDescDraft(campaign.description ?? '')
    setEditing(true)
  }

  async function saveEdit() {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await updateCampaign(campaign.id, {
        name: nameDraft.trim() || campaign.name,
        description: descDraft.trim() || undefined,
      })
      setCampaign(updated)
      setEditing(false)
    } finally { setSaving(false) }
  }


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


  async function handleShare() {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await generateShareToken(campaign.id)
      setCampaign(updated)
    } finally { setSaving(false) }
  }

  async function handleRevoke() {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await revokeShareToken(campaign.id)
      setCampaign(updated)
    } finally { setSaving(false) }
  }

  function copyLink() {
    if (!campaign?.share_token) return
    navigator.clipboard.writeText(`${window.location.origin}/share/${campaign.share_token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCreateSession() {
    if (!campaign || !sessionDraft.title.trim()) return
    setSaving(true)
    try {
      const s = await createSession(campaign.id, {
        title: sessionDraft.title.trim(),
        session_date: sessionDraft.session_date || null,
        notes: sessionDraft.notes || null,
        xp_awarded: sessionDraft.xp_awarded ? parseInt(sessionDraft.xp_awarded, 10) || null : null,
        loot_notes: sessionDraft.loot_notes.trim() || null,
      })
      setSessions(prev => [s, ...prev])
      setAddingSession(false)
      setSessionDraft(emptySessionDraft())
      setExpandedSession(s.id)
    } finally { setSaving(false) }
  }

  async function handleUpdateSession(sessionId: number) {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await updateSession(campaign.id, sessionId, {
        title: editSessionDraft.title.trim(),
        session_date: editSessionDraft.session_date || null,
        notes: editSessionDraft.notes || null,
        xp_awarded: editSessionDraft.xp_awarded ? parseInt(editSessionDraft.xp_awarded, 10) || null : null,
        loot_notes: editSessionDraft.loot_notes.trim() || null,
      })
      setSessions(prev => prev.map(s => s.id === sessionId ? updated : s))
      setEditingSession(null)
    } finally { setSaving(false) }
  }

  async function handleDistributeSessionXp(sessionId: number, xpAmount: number) {
    if (!campaign || characters.length === 0) return
    setSaving(true)
    try {
      const perChar = Math.floor(xpAmount / characters.length)
      const updated = await Promise.all(
        characters.map(c => updateIdentity(c.id, { experience_points: c.experience_points + perChar }))
      )
      setCharacters(updated)
      const updatedSession = await updateSession(campaign.id, sessionId, { xp_distributed: true })
      setSessions(prev => prev.map(s => s.id === sessionId ? updatedSession : s))
    } finally { setSaving(false) }
  }






  async function handleDeleteSession(sessionId: number) {
    if (!campaign) return
    await deleteSession(campaign.id, sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (editingSession === sessionId) setEditingSession(null)
    if (expandedSession === sessionId) setExpandedSession(null)
  }


  async function handleSaveCalendar(patch: Partial<GameCalendar>) {
    if (!campaign) return
    const next = { ...calendarDraft, ...patch }
    setCalendarDraft(next)
    setSavingCalendar(true)
    try {
      const updated = await updateCampaign(campaign.id, { game_calendar: next })
      setCampaign(updated)
    } finally { setSavingCalendar(false) }
  }













































  async function handleAddMilestone() {
    if (!campaign || !milestoneDraft.title.trim()) return
    const milestone: Milestone = { ...milestoneDraft, id: uuid(), title: milestoneDraft.title.trim() }
    const next = [...(campaign.campaign_milestones ?? []), milestone]
    const updated = await updateCampaign(campaign.id, { campaign_milestones: next })
    setCampaign(updated)
    setMilestoneDraft(emptyMilestone())
    setAddingMilestone(false)
  }

  async function handleDeleteMilestone(id: string) {
    if (!campaign) return
    const next = (campaign.campaign_milestones ?? []).filter(m => m.id !== id)
    const updated = await updateCampaign(campaign.id, { campaign_milestones: next })
    setCampaign(updated)
  }

  async function handleUpdateMilestone(id: string) {
    if (!campaign || !editMilestoneDraft.title.trim()) return
    const next = (campaign.campaign_milestones ?? []).map(m =>
      m.id === id ? { ...editMilestoneDraft, id, title: editMilestoneDraft.title.trim() } : m
    )
    const updated = await updateCampaign(campaign.id, { campaign_milestones: next })
    setCampaign(updated)
    setEditingMilestoneId(null)
  }















  function handleExportJournal() {
    if (!campaign || sessions.length === 0) return
    const sorted = [...sessions].sort((a, b) => (a.session_date ?? a.created_at).localeCompare(b.session_date ?? b.created_at))
    const lines: string[] = [`# Journal — ${campaign.name}`, '']
    for (const s of sorted) {
      const date = s.session_date
        ? new Date(s.session_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : null
      lines.push(`## ${s.title}${date ? ` — ${date}` : ''}`)
      if (s.xp_awarded != null) lines.push(`> +${s.xp_awarded.toLocaleString('fr-FR')} XP`)
      if (s.loot_notes) lines.push(`> 🎁 ${s.loot_notes}`)
      if (s.xp_awarded != null || s.loot_notes) lines.push('')
      if (s.notes) { lines.push(s.notes); lines.push('') }
      lines.push('---', '')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}_journal.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportCampaign() {
    if (!campaign) return
    const blob = buildCampaignZip(campaign, campaign.characters ?? [], sessions)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = archiveFilename(campaign.name)
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportCampaign(file: File) {
    setImporting(true)
    try {
      const { campaign: data, characters } = await parseCampaignArchive(file)
      const newCampaign = await createCampaign(
        (data.name as string) ?? 'Campagne importée',
        (data.description as string) ?? null,
      )
      await updateCampaign(newCampaign.id, {
        dm_notes: (data.dm_notes as string) ?? null,
        npcs: (data.npcs as Npc[]) ?? [],
        locations: (data.locations as Location[]) ?? [],
        party_treasury: (data.party_treasury as TreasureItem[]) ?? [],
        saved_encounters: (data.saved_encounters as SavedEncounter[]) ?? [],
        custom_monsters: (data.custom_monsters as CustomMonster[]) ?? [],
        factions: (data.factions as Faction[]) ?? [],
        random_tables: (data.random_tables as RandomTable[]) ?? [],
        game_calendar: (data.game_calendar as GameCalendar) ?? {},
        session_prep: (data.session_prep as SessionPrep) ?? null,
        campaign_milestones: (data.campaign_milestones as Milestone[]) ?? [],
        quests: (data.quests as Quest[]) ?? [],
        campaign_map: (data.campaign_map as CampaignMap) ?? null,
      })
      if (Array.isArray(data.sessions)) {
        for (const s of data.sessions as CampaignSession[]) {
          await createSession(newCampaign.id, { title: s.title, session_date: s.session_date, notes: s.notes, xp_awarded: s.xp_awarded ?? null, loot_notes: s.loot_notes ?? null })
        }
      }
      for (const archived of characters) {
        await importCharacter(newCampaign.id, archived)
      }
      navigate(`/campaigns/${newCampaign.id}`)
    } catch (err) {
      toast.error(err instanceof ZipError || err instanceof ArchiveError
        ? err.message
        : 'Fichier invalide ou corrompu.')
    } finally {
      setImporting(false)
    }
  }

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
      {(() => {
        const activeQuests = (campaign.quests ?? []).filter(q => q.status === 'active').length
        const badges: Partial<Record<Tab, number>> = {
          session:  characters.length || undefined,
          monde:    ((campaign.npcs ?? []).length + (campaign.locations ?? []).length) || undefined,
          aventure: activeQuests || undefined,
          journal:  sessions.length || undefined,
        }
        return (
          <div className="border-b border-stone-800 bg-stone-900/60 sticky top-14 z-10">
            <div className="max-w-5xl mx-auto px-4 flex gap-1">
              {([
                { key: 'session',  label: 'Session' },
                { key: 'monde',    label: 'Monde' },
                { key: 'aventure', label: 'Aventure' },
                { key: 'journal',  label: 'Journal' },
                { key: 'campagne', label: 'Campagne' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key)
                  }}
                  className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                    activeTab === tab.key
                      ? 'border-amber-400 text-amber-400'
                      : 'border-transparent text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {tab.label}
                  {badges[tab.key] !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${
                      activeTab === tab.key ? 'bg-amber-400/20 text-amber-400' : 'bg-stone-700 text-stone-400'
                    }`}>
                      {badges[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

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
          const sess = active ? sessions.filter(s => s.title.toLowerCase().includes(q) || (s.notes ?? '').toLowerCase().includes(q)) : []
          const quests = active ? (campaign.quests ?? []).filter(qt => qt.title.toLowerCase().includes(q) || qt.description.toLowerCase().includes(q) || qt.giver.toLowerCase().includes(q)) : []
          const factions = active ? (campaign.factions ?? []).filter(f => f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)) : []
          const total = npcs.length + locs.length + monsters.length + sess.length + quests.length + factions.length
          return (
            <>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher dans la campagne — PNJ, lieux, monstres, sessions, quêtes, factions…"
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
                      {sess.length > 0 && (
                        <div>
                          <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Sessions ({sess.length})</p>
                          <div className="divide-y divide-stone-800">
                            {sess.map(s => (
                              <div key={s.id} className="flex items-center gap-3 py-1.5">
                                <span className="text-white text-sm font-medium">{s.title}</span>
                                {s.session_date && <span className="text-stone-500 text-xs">{new Date(s.session_date + 'T00:00:00').toLocaleDateString('fr-FR')}</span>}
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

        {/* Section Session : chunk séparé. */}
        <Suspense fallback={<p className="text-stone-600 text-sm py-8 text-center">Chargement…</p>}>
          {activeTab === 'session' && <CampaignSessionSection {...sectionProps} />}
        </Suspense>

        {activeTab === 'campagne' && <>
        {/* Campaign identity */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white font-semibold text-lg focus:outline-none focus:border-amber-500 transition-colors"
              />
              <textarea
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                placeholder="Description…"
                rows={2}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setEditing(false)}
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-white text-xl font-bold">{campaign.name}</h1>
                {campaign.description && (
                  <p className="text-stone-400 text-sm mt-1">{campaign.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                <button
                  onClick={handleExportCampaign}
                  title="Exporter la campagne et ses personnages (archive ZIP)"
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                >
                  ↓ Export
                </button>
                {sessions.length > 0 && (
                  <button
                    onClick={handleExportJournal}
                    title="Exporter le journal de session en Markdown"
                    className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                  >
                    ↓ Journal
                  </button>
                )}
                <label
                  title="Importer une campagne depuis une archive ZIP (ou un ancien JSON)"
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors cursor-pointer"
                >
                  {importing ? '…' : '↑ Import'}
                  <input
                    type="file"
                    accept=".zip,.json"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImportCampaign(f); e.target.value = '' }}
                  />
                </label>
                <button
                  onClick={startEdit}
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                >
                  Modifier
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Audit de campagne */}
        {(() => {
          const npcNames = new Set((campaign.npcs ?? []).map(n => n.name.toLowerCase()))
          const locationNames = new Set((campaign.locations ?? []).map(l => l.name.toLowerCase()))
          const factionNames = new Set((campaign.factions ?? []).map(f => f.name.toLowerCase()))
          const monsterNames = new Set([...(campaign.custom_monsters ?? []).map(m => m.name)])

          const issues: { type: string; msg: string }[] = []

          ;(campaign.quests ?? []).filter(q => q.giver && q.giver.trim()).forEach(q => {
            if (!npcNames.has(q.giver.toLowerCase())) {
              issues.push({ type: 'quête', msg: `Quête «${q.title}» — donneur «${q.giver}» introuvable dans les PNJs` })
            }
          })
          ;(campaign.npcs ?? []).filter(n => n.faction && n.faction.trim()).forEach(n => {
            if (!factionNames.has(n.faction!.toLowerCase())) {
              issues.push({ type: 'pnj', msg: `PNJ «${n.name}» — faction «${n.faction}» introuvable` })
            }
          })
          ;(campaign.npcs ?? []).filter(n => n.location && n.location.trim()).forEach(n => {
            if (!locationNames.has(n.location!.toLowerCase())) {
              issues.push({ type: 'pnj', msg: `PNJ «${n.name}» — lieu «${n.location}» introuvable` })
            }
          })
          ;(campaign.saved_encounters ?? []).forEach(enc => {
            enc.entries.forEach(e => {
              if (!monsterNames.has(e.monster_name)) {
                issues.push({ type: 'rencontre', msg: `Rencontre «${enc.name}» — monstre «${e.monster_name}» introuvable dans le bestiaire custom` })
              }
            })
          })

          return (
            <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowAudit(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-stone-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-stone-300 text-sm font-semibold">Rapport d'audit</span>
                  {issues.length > 0 && (
                    <span className="text-xs bg-amber-900/60 border border-amber-700/50 text-amber-300 rounded-full px-2 py-0.5">
                      {issues.length} problème{issues.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className="text-stone-500 text-xs">{showAudit ? '▲' : '▼'}</span>
              </button>
              {showAudit && (
                <div className="px-5 pb-5 border-t border-stone-800 pt-4">
                  {issues.length === 0 ? (
                    <p className="text-emerald-400 text-sm">✓ Aucun problème détecté dans la campagne.</p>
                  ) : (
                    <div className="space-y-2">
                      {issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className={`shrink-0 text-xs font-medium rounded px-1.5 py-0.5 mt-0.5 ${
                            issue.type === 'quête' ? 'bg-amber-900/40 text-amber-400' : issue.type === 'pnj' ? 'bg-violet-900/40 text-violet-400' : 'bg-red-900/40 text-red-400'
                          }`}>{issue.type}</span>
                          <span className="text-stone-400 text-xs leading-relaxed">{issue.msg}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* Share / Vue MJ */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-stone-300 text-sm font-semibold">Vue MJ</h2>
              <p className="text-stone-500 text-xs mt-0.5">
                Lien en lecture seule — HP, conditions et initiative en temps réel
              </p>
            </div>
            {campaign.share_token ? (
              <button
                onClick={handleRevoke}
                disabled={saving}
                className="text-red-500 hover:text-red-400 text-xs transition-colors disabled:opacity-40"
              >
                Révoquer
              </button>
            ) : (
              <button
                onClick={handleShare}
                disabled={saving}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
              >
                Créer le lien
              </button>
            )}
          </div>

          {campaign.share_token && (
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-stone-800 text-stone-400 text-xs rounded-lg px-3 py-2 truncate font-mono">
                {window.location.origin}/share/{campaign.share_token}
              </code>
              <button
                onClick={copyLink}
                className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                  copied
                    ? 'bg-emerald-700 text-emerald-200'
                    : 'bg-stone-700 hover:bg-stone-600 text-stone-300'
                }`}
              >
                {copied ? 'Copié !' : 'Copier'}
              </button>
              <a
                href={`/share/${campaign.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-stone-500 hover:text-stone-300 transition-colors px-2 py-2"
              >
                Ouvrir
              </a>
            </div>
          )}
        </div>

        </>}


        {activeTab === 'journal' && <>
        {/* Statistiques de campagne */}
        {(characters.length > 0 || sessions.length > 0) && (() => {
          const totalHp = characters.reduce((s, c) => s + c.combat.current_hp, 0)
          const totalMaxHp = characters.reduce((s, c) => s + c.combat.max_hp, 0)
          const avgLevel = characters.length > 0
            ? (characters.reduce((s, c) => s + c.level, 0) / characters.length).toFixed(1)
            : null
          const totalXp = characters.reduce((s, c) => s + c.experience_points, 0)
          const dying = characters.filter(c => c.combat.current_hp <= 0).length
          const hpPct = totalMaxHp > 0 ? Math.round((totalHp / totalMaxHp) * 100) : null

          const dates = sessions
            .filter(s => s.session_date)
            .map(s => new Date(s.session_date! + 'T00:00:00').getTime())
          const firstDate = dates.length > 0 ? Math.min(...dates) : null
          const lastDate  = dates.length > 0 ? Math.max(...dates) : null
          const durationDays = firstDate && lastDate
            ? Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24))
            : null

          return (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">Statistiques</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-stone-800 rounded-lg p-3 text-center">
                  <p className="text-stone-500 text-xs mb-1">Sessions</p>
                  <p className="text-white font-bold text-xl">{sessions.length}</p>
                </div>
                {avgLevel && (
                  <div className="bg-stone-800 rounded-lg p-3 text-center">
                    <p className="text-stone-500 text-xs mb-1">Niveau moyen</p>
                    <p className="text-white font-bold text-xl">{avgLevel}</p>
                  </div>
                )}
                {hpPct != null && (
                  <div className="bg-stone-800 rounded-lg p-3 text-center">
                    <p className="text-stone-500 text-xs mb-1">PV groupe</p>
                    <p className={`font-bold text-xl ${dying > 0 ? 'text-red-400' : hpPct > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {hpPct}%
                    </p>
                    <p className="text-stone-600 text-xs">{totalHp}/{totalMaxHp}</p>
                  </div>
                )}
                {characters.length > 0 && (
                  <div className="bg-stone-800 rounded-lg p-3 text-center">
                    <p className="text-stone-500 text-xs mb-1">XP total</p>
                    <p className="text-white font-bold text-xl">{totalXp.toLocaleString('fr-FR')}</p>
                  </div>
                )}
                {sessions.some(s => s.xp_awarded != null) && (
                  <div className="bg-stone-800 rounded-lg p-3 text-center">
                    <p className="text-stone-500 text-xs mb-1">XP sessions</p>
                    <p className="text-amber-400 font-bold text-xl">
                      {sessions.reduce((sum, s) => sum + (s.xp_awarded ?? 0), 0).toLocaleString('fr-FR')}
                    </p>
                  </div>
                )}
              </div>
              {durationDays != null && (
                <p className="text-stone-600 text-xs mt-2 text-center">
                  {durationDays === 0
                    ? `${sessions.length} session${sessions.length > 1 ? 's' : ''} enregistrée${sessions.length > 1 ? 's' : ''}`
                    : `${durationDays} jour${durationDays > 1 ? 's' : ''} de campagne · ${sessions.length} session${sessions.length > 1 ? 's' : ''}`
                  }
                </p>
              )}
            </div>
          )
        })()}

        </>}


        {activeTab === 'campagne' && <>
        {/* Calendrier de campagne */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-stone-300 text-sm font-semibold">Calendrier de campagne</h2>
            {savingCalendar && <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin shrink-0" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-stone-500 text-xs block mb-1">Date en jeu</label>
              <input
                type="text"
                placeholder="ex. 14 Marpenoth, an 1492…"
                value={calendarDraft.date ?? ''}
                onChange={e => setCalendarDraft(d => ({ ...d, date: e.target.value }))}
                onBlur={() => handleSaveCalendar({ date: calendarDraft.date })}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-stone-500 text-xs block mb-1">Météo</label>
              <input
                type="text"
                placeholder="ex. Ensoleillé, Orage, Brouillard…"
                value={calendarDraft.weather ?? ''}
                onChange={e => setCalendarDraft(d => ({ ...d, weather: e.target.value }))}
                onBlur={() => handleSaveCalendar({ weather: calendarDraft.weather })}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-stone-500 text-xs block mb-1">Note rapide</label>
              <input
                type="text"
                placeholder="ex. Pleine lune, marché à Phandalin…"
                value={calendarDraft.notes ?? ''}
                onChange={e => setCalendarDraft(d => ({ ...d, notes: e.target.value }))}
                onBlur={() => handleSaveCalendar({ notes: calendarDraft.notes })}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>
          </div>
        </div>

        </>}

        {/* Section Monde : chunk séparé, chargé seulement si on ouvre l'onglet. */}
        <Suspense fallback={<p className="text-stone-600 text-sm py-8 text-center">Chargement…</p>}>
          {activeTab === 'monde' && <CampaignWorldSection {...sectionProps} />}
        </Suspense>




        {/* Section Aventure : chunk séparé. */}
        <Suspense fallback={<p className="text-stone-600 text-sm py-8 text-center">Chargement…</p>}>
          {activeTab === 'aventure' && <CampaignAdventureSection {...sectionProps} />}
        </Suspense>






        {activeTab === 'journal' && <>
        {/* Sessions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Journal de sessions ({sessions.length})
              </h2>
              {sessions.length > 1 && (
                <div className="flex rounded overflow-hidden border border-stone-700">
                  <button
                    onClick={() => setSessionView('list')}
                    className={`text-xs px-2 py-0.5 transition-colors ${sessionView === 'list' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}
                  >Liste</button>
                  <button
                    onClick={() => setSessionView('timeline')}
                    className={`text-xs px-2 py-0.5 transition-colors ${sessionView === 'timeline' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}
                  >Frise</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setAddingMilestone(v => !v); setMilestoneDraft(emptyMilestone()) }}
                className="text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors"
              >
                {addingMilestone ? 'Annuler' : '⭐ Jalon'}
              </button>
              <button
                onClick={() => { setAddingSession(v => !v); setSessionDraft({ title: '', session_date: '', notes: '', xp_awarded: '', loot_notes: '' }) }}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                {addingSession ? 'Annuler' : '+ Nouvelle session'}
              </button>
            </div>
          </div>

          {/* Add session form */}
          {addingSession && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Titre de la session *"
                  value={sessionDraft.title}
                  onChange={e => setSessionDraft(d => ({ ...d, title: e.target.value }))}
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <input
                  type="date"
                  value={sessionDraft.session_date}
                  onChange={e => setSessionDraft(d => ({ ...d, session_date: e.target.value }))}
                  className="w-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-stone-500 text-xs shrink-0">XP distribué</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={sessionDraft.xp_awarded}
                    onChange={e => setSessionDraft(d => ({ ...d, xp_awarded: e.target.value }))}
                    min={0}
                    className="w-28 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Butins & récompenses (résumé)"
                  value={sessionDraft.loot_notes}
                  onChange={e => setSessionDraft(d => ({ ...d, loot_notes: e.target.value }))}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-stone-600 text-xs">Notes</span>
                  <MicButton onTranscript={text => setSessionDraft(d => ({ ...d, notes: d.notes ? d.notes + '\n' + text : text }))} />
                </div>
                <textarea
                  placeholder={"Notes de la session…\n\nSyntaxe : ## Titre  **gras**  *italique*  - liste  ---"}
                  value={sessionDraft.notes}
                  onChange={e => setSessionDraft(d => ({ ...d, notes: e.target.value }))}
                  rows={5}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleCreateSession}
                  disabled={saving || !sessionDraft.title.trim()}
                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Créer
                </button>
              </div>
            </div>
          )}

          {/* Add milestone form */}
          {addingMilestone && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Titre du jalon *"
                  value={milestoneDraft.title}
                  onChange={e => setMilestoneDraft(d => ({ ...d, title: e.target.value }))}
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <input
                  type="date"
                  value={milestoneDraft.date}
                  onChange={e => setMilestoneDraft(d => ({ ...d, date: e.target.value }))}
                  className="w-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={milestoneDraft.type}
                  onChange={e => setMilestoneDraft(d => ({ ...d, type: e.target.value as Milestone['type'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                >
                  <option value="discovery">🔍 Découverte</option>
                  <option value="death">💀 Mort / perte</option>
                  <option value="arc">🏆 Arc narratif</option>
                  <option value="combat">⚔ Combat notable</option>
                  <option value="other">⭐ Autre</option>
                </select>
                <input
                  type="text"
                  placeholder="Notes optionnelles…"
                  value={milestoneDraft.notes}
                  onChange={e => setMilestoneDraft(d => ({ ...d, notes: e.target.value }))}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  onClick={handleAddMilestone}
                  disabled={!milestoneDraft.title.trim()}
                  className="text-sky-400 hover:text-sky-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {sessions.length === 0 && !addingSession ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
              <p className="text-stone-500 text-sm">
                Aucune session enregistrée.{' '}
                <button onClick={() => setAddingSession(true)} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Créer la première
                </button>
              </p>
            </div>
          ) : sessionView === 'timeline' ? (() => {
            type TimelineItem =
              | { kind: 'session'; sortKey: string; data: CampaignSession }
              | { kind: 'milestone'; sortKey: string; data: Milestone }
            const milestones = campaign.campaign_milestones ?? []
            const allItems: TimelineItem[] = [
              ...sessions.map(s => ({ kind: 'session' as const, sortKey: s.session_date ?? s.created_at ?? '', data: s })),
              ...milestones.map(m => ({ kind: 'milestone' as const, sortKey: m.date ?? '', data: m })),
            ].sort((a, b) => timelineSort === 'oldest' ? a.sortKey.localeCompare(b.sortKey) : b.sortKey.localeCompare(a.sortKey))
            const items = milestoneTypeFilter === 'all'
              ? allItems
              : allItems.filter(item => item.kind === 'session' || item.data.type === milestoneTypeFilter)
            const filteredItems = milestoneSearch
              ? items.filter(item => item.data.title.toLowerCase().includes(milestoneSearch.toLowerCase()))
              : items
            const sessionNums = new Map(sessions.map((s, si) => [s.id, si + 1]))
            const milestoneIcons: Record<Milestone['type'], string> = { discovery: '🔍', death: '💀', arc: '🏆', combat: '⚔', other: '⭐' }
            const milestoneColors: Record<Milestone['type'], string> = {
              discovery: 'bg-sky-500', death: 'bg-red-600', arc: 'bg-amber-500', combat: 'bg-orange-500', other: 'bg-violet-500',
            }
            const milestoneLabels: Record<Milestone['type'], string> = { discovery: 'Découverte', death: 'Mort', arc: 'Arc', combat: 'Combat', other: 'Autre' }
            const usedTypes = [...new Set(milestones.map(m => m.type))] as Milestone['type'][]
            return (
            <div className="space-y-0">
              {allItems.length > 3 && (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={milestoneSearch}
                    onChange={e => setMilestoneSearch(e.target.value)}
                    placeholder="Rechercher…"
                    className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                  />
                  <select
                    value={timelineSort}
                    onChange={e => setTimelineSort(e.target.value as typeof timelineSort)}
                    className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-stone-600 transition-colors"
                  >
                    <option value="newest">Plus récent</option>
                    <option value="oldest">Plus ancien</option>
                  </select>
                </div>
              )}
              {milestones.length > 1 && usedTypes.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(['all', ...usedTypes] as ('all' | Milestone['type'])[]).map(t => (
                    <button
                      key={t}
                      onClick={() => setMilestoneTypeFilter(t)}
                      className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                        milestoneTypeFilter === t
                          ? 'bg-sky-900/60 border-sky-600/60 text-sky-300'
                          : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      {t === 'all' ? 'Tous' : `${milestoneIcons[t]} ${milestoneLabels[t]}`}
                    </button>
                  ))}
                </div>
              )}
              {filteredItems.map((item, i) => (
                <div key={item.kind === 'session' ? `s-${item.data.id}` : `m-${item.data.id}`} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 w-5">
                    {item.kind === 'milestone' ? (
                      <div className={`w-3.5 h-3.5 rounded-sm mt-3 shrink-0 ${milestoneColors[item.data.type]}`} />
                    ) : (
                      <div className={`w-3 h-3 rounded-full mt-3 border-2 border-stone-950 shrink-0 transition-colors ${expandedSession === item.data.id ? 'bg-amber-500' : 'bg-stone-600'}`} />
                    )}
                    {i < filteredItems.length - 1 && <div className="flex-1 w-0.5 bg-stone-800 my-1 min-h-3" />}
                  </div>
                  {item.kind === 'milestone' ? (
                    <div className="flex-1 pb-2">
                      {editingMilestoneId === item.data.id ? (
                        <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 my-1 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editMilestoneDraft.title}
                              onChange={e => setEditMilestoneDraft(d => ({ ...d, title: e.target.value }))}
                              autoFocus
                              placeholder="Titre *"
                              className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                            />
                            <input
                              type="date"
                              value={editMilestoneDraft.date}
                              onChange={e => setEditMilestoneDraft(d => ({ ...d, date: e.target.value }))}
                              className="w-36 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                            />
                          </div>
                          <div className="flex gap-2">
                            <select
                              value={editMilestoneDraft.type}
                              onChange={e => setEditMilestoneDraft(d => ({ ...d, type: e.target.value as Milestone['type'] }))}
                              className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                            >
                              <option value="discovery">🔍 Découverte</option>
                              <option value="death">💀 Mort</option>
                              <option value="arc">🏆 Arc narratif</option>
                              <option value="combat">⚔ Combat notable</option>
                              <option value="other">⭐ Autre</option>
                            </select>
                            <input
                              type="text"
                              value={editMilestoneDraft.notes}
                              onChange={e => setEditMilestoneDraft(d => ({ ...d, notes: e.target.value }))}
                              placeholder="Notes…"
                              className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                            />
                          </div>
                          <div className="flex justify-between items-center">
                            <button onClick={() => setEditingMilestoneId(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                            <button onClick={() => handleUpdateMilestone(item.data.id)} disabled={!editMilestoneDraft.title.trim()} className="text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors disabled:opacity-40">Enregistrer</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-2">
                          <span className="text-sm">{milestoneIcons[item.data.type]}</span>
                          <span className="text-stone-200 text-sm font-medium">{item.data.title}</span>
                          {item.data.date && <span className="text-stone-600 text-xs">{new Date(item.data.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                          {item.data.notes && <span className="text-stone-500 text-xs italic truncate max-w-xs">{item.data.notes}</span>}
                          <button
                            onClick={() => { setEditingMilestoneId(item.data.id); setEditMilestoneDraft({ title: item.data.title, date: item.data.date, type: item.data.type, notes: item.data.notes }) }}
                            className="text-stone-600 hover:text-sky-400 text-sm leading-none transition-colors"
                            title="Modifier"
                          >✎</button>
                          <button onClick={() => handleDeleteMilestone(item.data.id)} className="ml-auto text-stone-700 hover:text-red-400 text-xs transition-colors">✕</button>
                        </div>
                      )}
                    </div>
                  ) : (
                  <div className="flex-1 pb-2">
                    {editingSession === item.data.id ? (
                      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-3">
                        <div className="flex gap-3">
                          <input type="text" value={editSessionDraft.title}
                            onChange={e => setEditSessionDraft(d => ({ ...d, title: e.target.value }))}
                            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                          <input type="date" value={editSessionDraft.session_date}
                            onChange={e => setEditSessionDraft(d => ({ ...d, session_date: e.target.value }))}
                            className="w-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                        </div>
                        <div className="flex gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-stone-500 text-xs shrink-0">XP</label>
                            <input type="number" placeholder="0" value={editSessionDraft.xp_awarded} onChange={e => setEditSessionDraft(d => ({ ...d, xp_awarded: e.target.value }))} min={0}
                              className="w-24 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                          </div>
                          <input type="text" placeholder="Butins & récompenses" value={editSessionDraft.loot_notes} onChange={e => setEditSessionDraft(d => ({ ...d, loot_notes: e.target.value }))}
                            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-stone-600 text-xs">Notes</span>
                            <MicButton onTranscript={text => setEditSessionDraft(d => ({ ...d, notes: d.notes ? d.notes + '\n' + text : text }))} />
                          </div>
                          <textarea value={editSessionDraft.notes}
                            onChange={e => setEditSessionDraft(d => ({ ...d, notes: e.target.value }))}
                            rows={5} placeholder={"## Titre  **gras**  *italique*  - liste"}
                            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono" />
                        </div>
                        <div className="flex items-center justify-between">
                          <button onClick={() => setEditingSession(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                          <div className="flex gap-4">
                            <button onClick={() => handleDeleteSession(item.data.id)} className="text-red-500 hover:text-red-400 text-xs transition-colors">Supprimer</button>
                            <button onClick={() => handleUpdateSession(item.data.id)} disabled={saving || !editSessionDraft.title.trim()}
                              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40">Enregistrer</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedSession(expandedSession === item.data.id ? null : item.data.id)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-800/50 transition-colors text-left group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-stone-600 text-xs font-mono shrink-0">#{sessionNums.get(item.data.id)}</span>
                              <span className="text-white text-sm font-medium truncate">{item.data.title}</span>
                            </div>
                            {item.data.session_date && (
                              <p className="text-stone-500 text-xs mt-0.5">
                                {new Date(item.data.session_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setEditSessionDraft({ title: item.data.title, session_date: item.data.session_date ?? '', notes: item.data.notes ?? '', xp_awarded: item.data.xp_awarded != null ? String(item.data.xp_awarded) : '', loot_notes: item.data.loot_notes ?? '' }); setEditingSession(item.data.id); setExpandedSession(null) }}
                            className="shrink-0 text-stone-600 hover:text-stone-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                          >Modifier</button>
                        </button>
                        {expandedSession === item.data.id && (
                          <div className="px-4 pb-4 border-t border-stone-800 pt-3 space-y-2">
                            {(item.data.xp_awarded != null || item.data.loot_notes) && (
                              <div className="flex flex-wrap items-center gap-3 mb-2">
                                {item.data.xp_awarded != null && (
                                  <span className="text-xs bg-amber-900/40 border border-amber-700/40 text-amber-300 rounded-full px-2.5 py-0.5">
                                    +{item.data.xp_awarded.toLocaleString('fr-FR')} XP
                                  </span>
                                )}
                                {item.data.loot_notes && (
                                  <span className="text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded-full px-2.5 py-0.5">
                                    🎁 {item.data.loot_notes}
                                  </span>
                                )}
                                {item.data.xp_awarded != null && characters.length > 0 && !item.data.xp_distributed && (
                                  <button
                                    onClick={() => handleDistributeSessionXp(item.data.id, item.data.xp_awarded!)}
                                    disabled={saving}
                                    className="text-xs bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/60 rounded-full px-2.5 py-0.5 transition-colors disabled:opacity-50"
                                    title={`Distribuer ${Math.floor(item.data.xp_awarded / characters.length)} XP à chaque personnage`}
                                  >
                                    ↗ Distribuer XP
                                  </button>
                                )}
                                {item.data.xp_distributed && (
                                  <span className="text-xs text-stone-600">✓ XP distribué</span>
                                )}
                              </div>
                            )}
                            {item.data.notes && <MarkdownText>{item.data.notes}</MarkdownText>}
                            {!item.data.notes && !item.data.xp_awarded && !item.data.loot_notes && (
                              <p className="text-stone-600 text-sm">Aucune note pour cette session.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              ))}
            </div>
          )})() : (
            <div className="space-y-2">
              {sessions.length > 3 && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={e => setSessionSearch(e.target.value)}
                    placeholder="Rechercher une session…"
                    className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                  />
                  <select
                    value={sessionSort}
                    onChange={e => setSessionSort(e.target.value as typeof sessionSort)}
                    className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-stone-600 transition-colors"
                  >
                    <option value="newest">Plus récente</option>
                    <option value="oldest">Plus ancienne</option>
                    <option value="title">Titre A→Z</option>
                  </select>
                </div>
              )}
              {sessions
                .filter(s => !sessionSearch || s.title.toLowerCase().includes(sessionSearch.toLowerCase()) || (s.session_date ?? '').includes(sessionSearch))
                .sort((a, b) => {
                  if (sessionSort === 'title') return a.title.localeCompare(b.title, 'fr')
                  const da = a.session_date ?? ''
                  const db = b.session_date ?? ''
                  return sessionSort === 'newest' ? db.localeCompare(da) : da.localeCompare(db)
                })
                .map(s => (
                <div key={s.id} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                  {editingSession === s.id ? (
                    <div className="p-5 space-y-3">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={editSessionDraft.title}
                          onChange={e => setEditSessionDraft(d => ({ ...d, title: e.target.value }))}
                          className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <input
                          type="date"
                          value={editSessionDraft.session_date}
                          onChange={e => setEditSessionDraft(d => ({ ...d, session_date: e.target.value }))}
                          className="w-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-stone-500 text-xs shrink-0">XP</label>
                          <input type="number" placeholder="0" value={editSessionDraft.xp_awarded} onChange={e => setEditSessionDraft(d => ({ ...d, xp_awarded: e.target.value }))} min={0}
                            className="w-24 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                        </div>
                        <input type="text" placeholder="Butins & récompenses" value={editSessionDraft.loot_notes} onChange={e => setEditSessionDraft(d => ({ ...d, loot_notes: e.target.value }))}
                          className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                      </div>
                      <textarea
                        value={editSessionDraft.notes}
                        onChange={e => setEditSessionDraft(d => ({ ...d, notes: e.target.value }))}
                        rows={5}
                        placeholder={"## Titre  **gras**  *italique*  - liste"}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono"
                      />
                      <div className="flex items-center justify-between">
                        <button onClick={() => setEditingSession(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                        <div className="flex gap-4">
                          <button
                            onClick={() => handleDeleteSession(s.id)}
                            className="text-red-500 hover:text-red-400 text-xs transition-colors"
                          >
                            Supprimer
                          </button>
                          <button
                            onClick={() => handleUpdateSession(s.id)}
                            disabled={saving || !editSessionDraft.title.trim()}
                            className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-stone-800/50 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-stone-500 text-xs" style={{ transform: expandedSession === s.id ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
                          <span className="text-white text-sm font-medium truncate">{s.title}</span>
                          {s.session_date && (
                            <span className="shrink-0 text-stone-500 text-xs">
                              {new Date(s.session_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setEditSessionDraft({ title: s.title, session_date: s.session_date ?? '', notes: s.notes ?? '', xp_awarded: s.xp_awarded != null ? String(s.xp_awarded) : '', loot_notes: s.loot_notes ?? '' })
                            setEditingSession(s.id)
                            setExpandedSession(null)
                          }}
                          className="shrink-0 text-stone-600 hover:text-stone-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Modifier
                        </button>
                      </button>
                      {expandedSession === s.id && (
                        <div className="px-5 pb-5 border-t border-stone-800 pt-4 space-y-2">
                          {(s.xp_awarded != null || s.loot_notes) && (
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                              {s.xp_awarded != null && (
                                <span className="text-xs bg-amber-900/40 border border-amber-700/40 text-amber-300 rounded-full px-2.5 py-0.5">
                                  +{s.xp_awarded.toLocaleString('fr-FR')} XP
                                </span>
                              )}
                              {s.loot_notes && (
                                <span className="text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded-full px-2.5 py-0.5">
                                  🎁 {s.loot_notes}
                                </span>
                              )}
                              {s.xp_awarded != null && characters.length > 0 && !s.xp_distributed && (
                                <button
                                  onClick={() => handleDistributeSessionXp(s.id, s.xp_awarded!)}
                                  disabled={saving}
                                  className="text-xs bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/60 rounded-full px-2.5 py-0.5 transition-colors disabled:opacity-50"
                                  title={`Distribuer ${Math.floor(s.xp_awarded / characters.length)} XP à chaque personnage`}
                                >
                                  ↗ Distribuer XP
                                </button>
                              )}
                              {s.xp_distributed && (
                                <span className="text-xs text-stone-600">✓ XP distribué</span>
                              )}
                            </div>
                          )}
                          {s.notes && <MarkdownText>{s.notes}</MarkdownText>}
                          {!s.notes && !s.xp_awarded && !s.loot_notes && (
                            <p className="text-stone-600 text-sm">Aucune note pour cette session.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </>}
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
