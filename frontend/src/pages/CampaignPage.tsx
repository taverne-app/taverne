import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getCampaign,
  updateCampaign,
  addCharacterToCampaign,
  removeCharacterFromCampaign,
  type Campaign,
  type Npc,
  type GameCalendar,
  type TreasureItem,
  type Location,
  type SessionPrep,
} from '../api/campaigns'
import { generateShareToken, revokeShareToken } from '../api/share'
import { listCharacters, longRest, updateInventory, type Character } from '../api/characters'
import {
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  type CampaignSession,
} from '../api/sessions'
import { logout } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { createEcho, REVERB_CONFIGURED } from '../lib/echo'
import { canLevelUp } from '../data/xp'
import { MarkdownText } from '../components/MarkdownText'
import { computeEncounterDifficulty, difficultyColor, difficultyBg } from '../data/encounter_difficulty'

// ── Helpers ───────────────────────────────────────────────────────────────────

function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}

const CONDITIONS_FR: Record<string, string> = {
  blinded: 'Aveuglé', charmed: 'Charmé', deafened: 'Assourdi',
  exhaustion: 'Épuisé', frightened: 'Effrayé', grappled: 'Agrippé',
  incapacitated: 'Hors de combat', invisible: 'Invisible', paralyzed: 'Paralysé',
  petrified: 'Pétrifié', poisoned: 'Empoisonné', prone: 'À terre',
  restrained: 'Entravé', stunned: 'Étourdi', unconscious: 'Inconscient',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CampaignPage() {
  const { id } = useParams<{ id: string }>()
  const { token, user, clearAuth } = useAuth()
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
  const [confirmRemove, setConfirmRemove]       = useState<number | null>(null)

  // Share
  const [copied, setCopied] = useState(false)

  // Group rest
  const [restingAll, setRestingAll] = useState(false)
  const [restDone, setRestDone]     = useState<'long' | null>(null)

  // DM Screen
  const [showDmScreen, setShowDmScreen] = useState(false)

  // Notes MJ
  const [dmNotesDraft, setDmNotesDraft] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // PNJs
  const [npcDraft, setNpcDraft] = useState<Npc>({ name: '', role: '', status: 'inconnu', location: '', notes: '' })
  const [addingNpc, setAddingNpc] = useState(false)
  const [expandedNpc, setExpandedNpc] = useState<number | null>(null)

  // Calendrier
  const [calendarDraft, setCalendarDraft] = useState<Partial<GameCalendar>>({})
  const [savingCalendar, setSavingCalendar] = useState(false)

  // Sessions
  const [sessions, setSessions]               = useState<CampaignSession[]>([])
  const [addingSession, setAddingSession]     = useState(false)
  const [sessionDraft, setSessionDraft]       = useState({ title: '', session_date: '', notes: '' })
  const [editingSession, setEditingSession]   = useState<number | null>(null)
  const [editSessionDraft, setEditSessionDraft] = useState({ title: '', session_date: '', notes: '' })
  const [expandedSession, setExpandedSession] = useState<number | null>(null)
  const [sessionView, setSessionView] = useState<'list' | 'timeline'>('list')

  // Trésor partagé
  const emptyTreasureDraft = (): TreasureItem => ({ name: '', quantity: 1, value: '', notes: '' })
  const [addingTreasury, setAddingTreasury]   = useState(false)
  const [treasuryDraft, setTreasuryDraft]     = useState<TreasureItem>(emptyTreasureDraft)
  const [distributingIdx, setDistributingIdx] = useState<number | null>(null)

  // Lieux
  const emptyLocationDraft = (): Location => ({ name: '', type: 'autre', status: 'inconnu', reputation: 'neutre', notes: '' })
  const [addingLocation, setAddingLocation]   = useState(false)
  const [locationDraft, setLocationDraft]     = useState<Location>(emptyLocationDraft())
  const [expandedLocation, setExpandedLocation] = useState<number | null>(null)

  // Préparation de session
  const emptySessionPrep = (): SessionPrep => ({ title: '', date: '', notes: '', npc_names: [], location_names: [], encounter_names: [] })
  const [sessionPrepDraft, setSessionPrepDraft] = useState<SessionPrep>(emptySessionPrep())
  const [editingSessionPrep, setEditingSessionPrep] = useState(false)
  const [hasSessionPrep, setHasSessionPrep] = useState(false)
  const [savingSessionPrep, setSavingSessionPrep] = useState(false)

  // Load campaign
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getCampaign(Number(id))
      .then(c => {
        setCampaign(c)
        setCharacters(c.characters)
        setDmNotesDraft(c.dm_notes ?? '')
        setCalendarDraft(c.game_calendar ?? {})
        if (c.session_prep) {
          setSessionPrepDraft(c.session_prep)
          setHasSessionPrep(true)
        }
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
    if (!token || characters.length === 0 || !REVERB_CONFIGURED) return
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

  async function openAddModal() {
    const all = await listCharacters()
    const inCampaign = new Set(characters.map(c => c.id))
    setAllChars(all.filter(c => !inCampaign.has(c.id)))
    setShowAddModal(true)
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

  async function handleRemove(characterId: number) {
    if (!campaign) return
    setSaving(true)
    try {
      const updated = await removeCharacterFromCampaign(campaign.id, characterId)
      setCampaign(updated)
      setCharacters(updated.characters)
      setConfirmRemove(null)
    } finally { setSaving(false) }
  }

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
      })
      setSessions(prev => [s, ...prev])
      setAddingSession(false)
      setSessionDraft({ title: '', session_date: '', notes: '' })
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
      })
      setSessions(prev => prev.map(s => s.id === sessionId ? updated : s))
      setEditingSession(null)
    } finally { setSaving(false) }
  }

  async function handleDeleteSession(sessionId: number) {
    if (!campaign) return
    await deleteSession(campaign.id, sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (editingSession === sessionId) setEditingSession(null)
    if (expandedSession === sessionId) setExpandedSession(null)
  }

  async function handleSaveDmNotes() {
    if (!campaign) return
    setSavingNotes(true)
    try {
      const updated = await updateCampaign(campaign.id, { dm_notes: dmNotesDraft })
      setCampaign(updated)
    } finally { setSavingNotes(false) }
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

  async function handleAddNpc() {
    if (!campaign || !npcDraft.name.trim()) return
    const next: Npc[] = [...(campaign.npcs ?? []), { ...npcDraft, name: npcDraft.name.trim() }]
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
    setNpcDraft({ name: '', role: '', status: 'inconnu', location: '', notes: '' })
    setAddingNpc(false)
  }

  async function handleDeleteNpc(index: number) {
    if (!campaign) return
    const next = (campaign.npcs ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
    if (expandedNpc === index) setExpandedNpc(null)
  }

  async function handleUpdateNpcStatus(index: number, status: Npc['status']) {
    if (!campaign) return
    const next = (campaign.npcs ?? []).map((n, i) => i === index ? { ...n, status } : n)
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
  }

  async function handleAddLocation() {
    if (!campaign || !locationDraft.name.trim()) return
    const next: Location[] = [...(campaign.locations ?? []), { ...locationDraft, name: locationDraft.name.trim() }]
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
    setLocationDraft(emptyLocationDraft())
    setAddingLocation(false)
  }

  async function handleDeleteLocation(index: number) {
    if (!campaign) return
    const next = (campaign.locations ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
    if (expandedLocation === index) setExpandedLocation(null)
  }

  async function handleUpdateLocationStatus(index: number, status: Location['status']) {
    if (!campaign) return
    const next = (campaign.locations ?? []).map((l, i) => i === index ? { ...l, status } : l)
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
  }

  async function handleUpdateLocationReputation(index: number, reputation: Location['reputation']) {
    if (!campaign) return
    const next = (campaign.locations ?? []).map((l, i) => i === index ? { ...l, reputation } : l)
    const updated = await updateCampaign(campaign.id, { locations: next })
    setCampaign(updated)
  }

  async function handleSaveSessionPrep() {
    if (!campaign) return
    setSavingSessionPrep(true)
    try {
      const updated = await updateCampaign(campaign.id, { session_prep: sessionPrepDraft })
      setCampaign(updated)
      setHasSessionPrep(true)
      setEditingSessionPrep(false)
    } finally { setSavingSessionPrep(false) }
  }

  async function handleClearSessionPrep() {
    if (!campaign) return
    const updated = await updateCampaign(campaign.id, { session_prep: null })
    setCampaign(updated)
    setSessionPrepDraft(emptySessionPrep())
    setHasSessionPrep(false)
    setEditingSessionPrep(false)
  }

  async function handleGroupLongRest() {
    if (restingAll || characters.length === 0) return
    setRestingAll(true)
    try {
      const updated = await Promise.all(characters.map(c => longRest(c.id)))
      setCharacters(updated)
      setRestDone('long')
      setTimeout(() => setRestDone(null), 4000)
    } finally {
      setRestingAll(false)
    }
  }

  async function handleAddTreasureItem() {
    if (!campaign || !treasuryDraft.name.trim()) return
    const next = [...(campaign.party_treasury ?? []), { ...treasuryDraft, name: treasuryDraft.name.trim() }]
    const updated = await updateCampaign(campaign.id, { party_treasury: next })
    setCampaign(updated)
    setTreasuryDraft(emptyTreasureDraft())
    setAddingTreasury(false)
  }

  async function handleRemoveTreasureItem(index: number) {
    if (!campaign) return
    const next = (campaign.party_treasury ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { party_treasury: next })
    setCampaign(updated)
    if (distributingIdx === index) setDistributingIdx(null)
  }

  async function handleDistributeItem(index: number, character: Character) {
    if (!campaign) return
    const item = campaign.party_treasury[index]
    const existingItems = character.inventory?.items ?? []
    const existing = existingItems.findIndex(i => i.name === item.name && i.value === item.value)
    let nextItems
    if (existing >= 0) {
      nextItems = existingItems.map((i, idx) =>
        idx === existing ? { ...i, quantity: i.quantity + item.quantity } : i
      )
    } else {
      nextItems = [...existingItems, { name: item.name, quantity: item.quantity, weight: 0, value: item.value, notes: item.notes, equipped: false }]
    }
    await updateInventory(character.id, nextItems)
    const next = (campaign.party_treasury ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { party_treasury: next })
    setCampaign(updated)
    setDistributingIdx(null)
  }

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!campaign) return null

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/campaigns" className="text-stone-400 hover:text-stone-200 text-sm shrink-0 transition-colors">
              ← Campagnes
            </Link>
            <span className="text-stone-700">|</span>
            <span className="text-amber-400 font-bold truncate">{campaign.name}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {saving && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
            <span className="text-stone-400 text-sm hidden sm:block">{user?.name}</span>
            <button onClick={handleLogout} className="text-stone-400 hover:text-stone-200 text-sm transition-colors">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

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
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to={`/combat?campaign=${campaign.id}`}
                  className="bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
                >
                  ⚔ Combat
                </Link>
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

        {/* Characters */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Personnages ({characters.length})
            </h2>
            <div className="flex items-center gap-3">
              {characters.length > 0 && (
                <>
                  <button
                    onClick={() => setShowDmScreen(v => !v)}
                    className={`text-xs font-medium transition-colors ${
                      showDmScreen
                        ? 'text-violet-400 hover:text-violet-300'
                        : 'text-stone-500 hover:text-violet-400'
                    }`}
                    title="Vue MJ — toutes les infos en tableau"
                  >
                    {showDmScreen ? '⊞ Cartes' : '☰ Vue MJ'}
                  </button>
                  <button
                    onClick={handleGroupLongRest}
                    disabled={restingAll}
                    className="text-stone-500 hover:text-amber-400 text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
                    title="Appliquer un repos long à tous les personnages"
                  >
                    {restingAll ? '…' : restDone === 'long' ? '✓ Repos terminé' : '🌙 Repos long'}
                  </button>
                </>
              )}
              <button
                onClick={openAddModal}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {characters.length === 0 ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-10 text-center">
              <p className="text-stone-500 text-sm">
                Aucun personnage dans cette campagne.{' '}
                <button onClick={openAddModal} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Ajouter un personnage
                </button>
              </p>
            </div>
          ) : showDmScreen ? (
            /* ── Vue MJ ── */
            <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-stone-800">
                {characters.map(c => {
                  const hpPct = Math.max(0, Math.min(100, (c.combat.current_hp / c.combat.max_hp) * 100))
                  const isDying = c.combat.current_hp <= 0
                  const levelUp = canLevelUp(c.level, c.experience_points)
                  return (
                    <div key={c.id} className="px-4 py-3 hover:bg-stone-800/40 transition-colors relative group">
                      <Link to={`/characters/${c.id}`} className="absolute inset-0" />
                      <div className="flex items-center gap-4 min-w-0">

                        {/* Name + class */}
                        <div className="w-44 shrink-0 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`font-semibold text-sm truncate ${isDying ? 'text-red-400' : 'text-white'}`}>
                              {c.name}
                            </span>
                            {levelUp && (
                              <span className="shrink-0 text-xs bg-amber-900/50 border border-amber-600/50 text-amber-400 rounded px-1 py-0.5 font-semibold">
                                ⬆ Niv
                              </span>
                            )}
                            {c.combat.inspiration && (
                              <span className="shrink-0 text-amber-400 text-xs" title="Inspiration">✦</span>
                            )}
                          </div>
                          <p className="text-stone-500 text-xs truncate mt-0.5">
                            {c.character_class} Niv.{c.level} · CA {c.combat.armor_class}
                          </p>
                        </div>

                        {/* HP */}
                        <div className="w-40 shrink-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
                              {c.combat.current_hp}
                            </span>
                            <span className="text-stone-500 text-xs">/ {c.combat.max_hp}</span>
                            {c.combat.temporary_hp > 0 && (
                              <span className="text-sky-400 text-xs">+{c.combat.temporary_hp}</span>
                            )}
                          </div>
                          <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${hpColor(c.combat.current_hp, c.combat.max_hp)}`}
                              style={{ width: `${hpPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Death saves */}
                        {isDying && (
                          <div className="flex items-center gap-1 shrink-0">
                            {[1,2,3].map(n => (
                              <div key={n} className={`w-3 h-3 rounded-full border ${n <= c.state.death_saves_successes ? 'bg-emerald-500 border-emerald-400' : 'border-stone-600'}`} />
                            ))}
                            <span className="text-stone-600 text-xs mx-0.5">/</span>
                            {[1,2,3].map(n => (
                              <div key={n} className={`w-3 h-3 rounded-full border ${n <= c.state.death_saves_failures ? 'bg-red-500 border-red-400' : 'border-stone-600'}`} />
                            ))}
                          </div>
                        )}

                        {/* Conditions */}
                        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                          {c.state.conditions.length === 0 && !isDying ? (
                            <span className="text-stone-700 text-xs">—</span>
                          ) : (
                            c.state.conditions.map(cond => (
                              <span key={cond} className="text-xs bg-purple-900/50 border border-purple-700 text-purple-300 rounded px-1.5 py-0.5">
                                {CONDITIONS_FR[cond] ?? cond}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Spell slots + exhaustion + concentration */}
                        <div className="hidden xl:flex flex-col gap-1 shrink-0 min-w-[120px]">
                          {c.state.concentrating_on && (
                            <span className="text-xs bg-violet-900/50 border border-violet-700/50 text-violet-300 rounded px-1.5 py-0.5 truncate max-w-[140px]" title={`◈ ${c.state.concentrating_on}`}>
                              ◈ {c.state.concentrating_on}
                            </span>
                          )}
                          {c.state.exhaustion_level > 0 && (
                            <span className={`text-xs rounded px-1.5 py-0.5 border ${
                              c.state.exhaustion_level <= 2 ? 'bg-amber-900/40 border-amber-700/50 text-amber-400' :
                              c.state.exhaustion_level <= 4 ? 'bg-orange-900/40 border-orange-700/50 text-orange-400' :
                              'bg-red-900/40 border-red-700/50 text-red-400'
                            }`}>
                              Épuisement {c.state.exhaustion_level}
                            </span>
                          )}
                          {c.spellcasting.ability && Object.entries(c.spellcasting.slots)
                            .filter(([, s]) => s.max > 0)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .slice(0, 4)
                            .map(([lvl, slot]) => {
                              const available = slot.max - slot.used
                              return (
                                <div key={lvl} className="flex items-center gap-1">
                                  <span className="text-stone-600 text-xs w-3">{lvl}</span>
                                  <div className="flex gap-0.5">
                                    {Array.from({ length: slot.max }, (_, i) => (
                                      <span
                                        key={i}
                                        className={`w-2.5 h-2.5 rounded-full border ${
                                          i < available ? 'bg-violet-500 border-violet-400' : 'bg-transparent border-stone-600'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )
                            })
                          }
                          {c.resources.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {c.resources.map((r, i) => (
                                <span key={i} className={`text-xs rounded px-1.5 py-0.5 border ${
                                  r.current === 0
                                    ? 'bg-stone-800 border-stone-700 text-stone-600'
                                    : 'bg-stone-800 border-stone-600 text-stone-300'
                                }`}>
                                  {r.name} {r.current}/{r.max}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Link arrow */}
                        <span className="text-stone-700 group-hover:text-stone-500 text-sm transition-colors shrink-0 relative z-10">↗</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map(c => {
                const hpPct = Math.max(0, Math.min(100, (c.combat.current_hp / c.combat.max_hp) * 100))
                const isDying = c.combat.current_hp <= 0

                return (
                  <div
                    key={c.id}
                    className="bg-stone-900 border border-stone-800 rounded-xl p-4 hover:border-stone-700 transition-colors group relative"
                  >
                    <Link to={`/characters/${c.id}`} className="absolute inset-0 rounded-xl" />

                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {c.portrait_url && (
                          <img
                            src={c.portrait_url}
                            alt={c.name}
                            className="w-10 h-10 rounded-full object-cover shrink-0 border border-stone-700"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                        <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-semibold text-sm ${isDying ? 'text-red-400' : 'text-white'}`}>
                            {c.name}
                          </h3>
                          {canLevelUp(c.level, c.experience_points) && (
                            <span className="text-xs bg-amber-900/50 border border-amber-600/50 text-amber-400 rounded px-1 py-0.5 font-semibold">
                              ⬆ Niv
                            </span>
                          )}
                        </div>
                        <p className="text-stone-500 text-xs mt-0.5">
                          {c.race} · {c.character_class} · Niv. {c.level}
                        </p>
                        </div>
                      </div>
                      {/* Remove button */}
                      <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                        {confirmRemove === c.id ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setConfirmRemove(null)}
                              className="text-stone-500 text-xs hover:text-stone-300 transition-colors"
                            >
                              ✕
                            </button>
                            <button
                              onClick={() => handleRemove(c.id)}
                              className="text-red-400 text-xs hover:text-red-300 transition-colors"
                            >
                              Retirer
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(c.id)}
                            className="text-stone-700 hover:text-red-400 text-xs transition-colors"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-3 text-center mb-3">
                      <div className="flex-1 bg-stone-800 rounded-lg py-1.5">
                        <p className="text-stone-500 text-xs">CA</p>
                        <p className="text-white font-bold text-sm">{c.combat.armor_class}</p>
                      </div>
                      <div className="flex-1 bg-stone-800 rounded-lg py-1.5">
                        <p className="text-stone-500 text-xs">Init.</p>
                        <p className="text-white font-bold text-sm">{sign(c.combat.initiative)}</p>
                      </div>
                      <div className="flex-1 bg-stone-800 rounded-lg py-1.5">
                        <p className="text-stone-500 text-xs">Maît.</p>
                        <p className="text-white font-bold text-sm">+{c.proficiency_bonus}</p>
                      </div>
                    </div>

                    {/* HP bar */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={isDying ? 'text-red-400 font-semibold' : 'text-stone-400'}>PV</span>
                        <span className="text-stone-400">
                          {c.combat.current_hp} / {c.combat.max_hp}
                          {c.combat.temporary_hp > 0 && (
                            <span className="text-sky-400 ml-1">+{c.combat.temporary_hp}</span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${hpColor(c.combat.current_hp, c.combat.max_hp)}`}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Conditions */}
                    {c.state.conditions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.state.conditions.map(cond => (
                          <span
                            key={cond}
                            className="text-xs bg-purple-900/50 border border-purple-700 text-purple-300 rounded px-1.5 py-0.5"
                          >
                            {CONDITIONS_FR[cond] ?? cond}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

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

        {/* Notes privées MJ */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-stone-300 text-sm font-semibold">Notes privées MJ</h2>
              <p className="text-stone-500 text-xs mt-0.5">Visibles uniquement par vous — non partagées</p>
            </div>
            {savingNotes && <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />}
          </div>
          <textarea
            value={dmNotesDraft}
            onChange={e => setDmNotesDraft(e.target.value)}
            onBlur={handleSaveDmNotes}
            placeholder="Notes de préparation, secrets, PNJ, lieux, intrigues…"
            rows={6}
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
          />
        </div>

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
              <label className="text-stone-500 text-xs block mb-1">Moment de la journée</label>
              <select
                value={calendarDraft.time ?? ''}
                onChange={e => handleSaveCalendar({ time: e.target.value as GameCalendar['time'] })}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
              >
                <option value="">—</option>
                <option value="matin">🌅 Matin</option>
                <option value="après-midi">☀️ Après-midi</option>
                <option value="soir">🌆 Soir</option>
                <option value="nuit">🌙 Nuit</option>
              </select>
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

        {/* Tracker de PNJs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              PNJ rencontrés ({(campaign.npcs ?? []).length})
            </h2>
            <button
              onClick={() => { setAddingNpc(v => !v); setNpcDraft({ name: '', role: '', status: 'inconnu', location: '', notes: '' }) }}
              className="text-violet-400 hover:text-violet-300 text-xs font-semibold transition-colors"
            >
              {addingNpc ? 'Annuler' : '+ Ajouter un PNJ'}
            </button>
          </div>

          {addingNpc && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nom *"
                  value={npcDraft.name}
                  onChange={e => setNpcDraft(d => ({ ...d, name: e.target.value }))}
                  autoFocus
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Rôle / occupation"
                  value={npcDraft.role}
                  onChange={e => setNpcDraft(d => ({ ...d, role: e.target.value }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={npcDraft.status}
                  onChange={e => setNpcDraft(d => ({ ...d, status: e.target.value as Npc['status'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="inconnu">❓ Inconnu</option>
                  <option value="allié">🟢 Allié</option>
                  <option value="neutre">🟡 Neutre</option>
                  <option value="ennemi">🔴 Ennemi</option>
                </select>
                {(campaign?.locations ?? []).length > 0 && (
                  <select
                    value={npcDraft.location ?? ''}
                    onChange={e => setNpcDraft(d => ({ ...d, location: e.target.value }))}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  >
                    <option value="">📍 Lieu</option>
                    {(campaign?.locations ?? []).map((l, i) => (
                      <option key={i} value={l.name}>{l.name}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="Notes (secret, lien…)"
                  value={npcDraft.notes}
                  onChange={e => setNpcDraft(d => ({ ...d, notes: e.target.value }))}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
                <button
                  onClick={handleAddNpc}
                  disabled={!npcDraft.name.trim()}
                  className="bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors shrink-0"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign.npcs ?? []).length === 0 && !addingNpc ? (
            <p className="text-stone-600 text-sm text-center py-6">Aucun PNJ enregistré. Ajoutez les personnages importants rencontrés par le groupe.</p>
          ) : (
            <div className="space-y-2">
              {(campaign.npcs ?? []).map((npc, i) => {
                const statusColor = npc.status === 'allié' ? 'text-emerald-400' : npc.status === 'ennemi' ? 'text-red-400' : npc.status === 'neutre' ? 'text-amber-400' : 'text-stone-400'
                const statusIcon = npc.status === 'allié' ? '🟢' : npc.status === 'ennemi' ? '🔴' : npc.status === 'neutre' ? '🟡' : '❓'
                return (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 p-3">
                      <span className="text-base shrink-0">{statusIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-stone-200 text-sm font-medium truncate">{npc.name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {npc.role && <p className="text-stone-500 text-xs truncate">{npc.role}</p>}
                          {npc.location && <span className="text-xs text-sky-400/70">📍 {npc.location}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={npc.status}
                          onChange={e => handleUpdateNpcStatus(i, e.target.value as Npc['status'])}
                          className={`bg-transparent text-xs border-none outline-none cursor-pointer ${statusColor}`}
                        >
                          <option value="inconnu">Inconnu</option>
                          <option value="allié">Allié</option>
                          <option value="neutre">Neutre</option>
                          <option value="ennemi">Ennemi</option>
                        </select>
                        {npc.notes && (
                          <button
                            onClick={() => setExpandedNpc(expandedNpc === i ? null : i)}
                            className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                          >
                            {expandedNpc === i ? '▲' : '▼'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteNpc(i)}
                          className="text-stone-700 hover:text-red-400 text-xs transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {expandedNpc === i && npc.notes && (
                      <div className="px-4 pb-3 pt-0">
                        <p className="text-stone-400 text-xs leading-relaxed">{npc.notes}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Trésor partagé */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Trésor du groupe ({(campaign?.party_treasury ?? []).length})
            </h2>
            <button
              onClick={() => { setAddingTreasury(v => !v); setTreasuryDraft(emptyTreasureDraft()) }}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
            >
              {addingTreasury ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {addingTreasury && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Nom de l'objet *"
                  value={treasuryDraft.name}
                  onChange={e => setTreasuryDraft(d => ({ ...d, name: e.target.value }))}
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Qté"
                  value={treasuryDraft.quantity}
                  onChange={e => setTreasuryDraft(d => ({ ...d, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                  className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Valeur (ex: 50 po)"
                  value={treasuryDraft.value}
                  onChange={e => setTreasuryDraft(d => ({ ...d, value: e.target.value }))}
                  className="w-36 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <input
                type="text"
                placeholder="Notes (optionnel)"
                value={treasuryDraft.notes}
                onChange={e => setTreasuryDraft(d => ({ ...d, notes: e.target.value }))}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddTreasureItem}
                  disabled={!treasuryDraft.name.trim()}
                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign?.party_treasury ?? []).length === 0 && !addingTreasury ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
              <p className="text-stone-500 text-sm">
                Aucun objet dans le trésor.{' '}
                <button onClick={() => setAddingTreasury(true)} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Ajouter le premier
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(campaign?.party_treasury ?? []).map((item, i) => (
                <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-stone-100 text-sm font-semibold">{item.name}</span>
                        {item.quantity > 1 && (
                          <span className="text-xs bg-stone-800 border border-stone-700 text-stone-400 rounded px-1.5 py-0.5">
                            ×{item.quantity}
                          </span>
                        )}
                        {item.value && (
                          <span className="text-xs text-amber-400 font-medium">{item.value}</span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-stone-500 text-xs mt-1">{item.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setDistributingIdx(distributingIdx === i ? null : i)}
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-medium"
                      >
                        Distribuer
                      </button>
                      <button
                        onClick={() => handleRemoveTreasureItem(i)}
                        className="text-xs text-stone-600 hover:text-red-400 transition-colors"
                        title="Retirer du trésor"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {distributingIdx === i && characters.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-stone-800">
                      <p className="text-stone-500 text-xs mb-2">Donner à :</p>
                      <div className="flex flex-wrap gap-2">
                        {characters.map(c => (
                          <button
                            key={c.id}
                            onClick={() => handleDistributeItem(i, c)}
                            className="text-xs bg-stone-800 hover:bg-sky-900/40 border border-stone-700 hover:border-sky-700/50 text-stone-300 hover:text-sky-200 rounded-lg px-3 py-1.5 transition-colors"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lieux */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Lieux ({(campaign?.locations ?? []).length})
            </h2>
            <button
              onClick={() => { setAddingLocation(v => !v); setLocationDraft(emptyLocationDraft()) }}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
            >
              {addingLocation ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {addingLocation && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Nom du lieu *"
                  value={locationDraft.name}
                  onChange={e => setLocationDraft(d => ({ ...d, name: e.target.value }))}
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <select
                  value={locationDraft.type}
                  onChange={e => setLocationDraft(d => ({ ...d, type: e.target.value as Location['type'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="ville">Ville</option>
                  <option value="donjon">Donjon</option>
                  <option value="forêt">Forêt</option>
                  <option value="taverne">Taverne</option>
                  <option value="temple">Temple</option>
                  <option value="château">Château</option>
                  <option value="autre">Autre</option>
                </select>
                <select
                  value={locationDraft.status}
                  onChange={e => setLocationDraft(d => ({ ...d, status: e.target.value as Location['status'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="inconnu">❓ Inconnu</option>
                  <option value="connu">◎ Connu</option>
                  <option value="exploré">✓ Exploré</option>
                </select>
                <select
                  value={locationDraft.reputation}
                  onChange={e => setLocationDraft(d => ({ ...d, reputation: e.target.value as Location['reputation'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="héros">★ Héros</option>
                  <option value="respecté">◆ Respecté</option>
                  <option value="neutre">— Neutre</option>
                  <option value="suspect">◇ Suspect</option>
                  <option value="recherché">✕ Recherché</option>
                </select>
              </div>
              <textarea
                placeholder="Notes (description, PNJ associés, indices…)"
                value={locationDraft.notes}
                onChange={e => setLocationDraft(d => ({ ...d, notes: e.target.value }))}
                rows={3}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddLocation}
                  disabled={!locationDraft.name.trim()}
                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign?.locations ?? []).length === 0 && !addingLocation ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
              <p className="text-stone-500 text-sm">
                Aucun lieu enregistré.{' '}
                <button onClick={() => setAddingLocation(true)} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Ajouter le premier
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(campaign?.locations ?? []).map((loc, i) => {
                const typeIcon = loc.type === 'ville' ? '🏙' : loc.type === 'donjon' ? '⛏' : loc.type === 'forêt' ? '🌲' : loc.type === 'taverne' ? '🍺' : loc.type === 'temple' ? '⛪' : loc.type === 'château' ? '🏰' : '📍'
                const statusColor = loc.status === 'exploré' ? 'text-emerald-400' : loc.status === 'connu' ? 'text-amber-400' : 'text-stone-500'
                const rep = loc.reputation ?? 'neutre'
                const repColor = rep === 'héros' ? 'text-amber-400' : rep === 'respecté' ? 'text-emerald-400' : rep === 'suspect' ? 'text-orange-400' : rep === 'recherché' ? 'text-red-400' : 'text-stone-500'
                const repBg   = rep === 'héros' ? 'bg-amber-900/30 border-amber-700/40' : rep === 'respecté' ? 'bg-emerald-900/30 border-emerald-700/40' : rep === 'suspect' ? 'bg-orange-900/30 border-orange-700/40' : rep === 'recherché' ? 'bg-red-900/30 border-red-700/40' : 'bg-stone-800/60 border-stone-700/40'
                const locNpcs = (campaign.npcs ?? []).filter(n => n.location === loc.name)
                return (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">{typeIcon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-stone-100 text-sm font-semibold">{loc.name}</span>
                          <span className="text-stone-600 text-xs capitalize">{loc.type}</span>
                          <select
                            value={loc.status}
                            onChange={e => handleUpdateLocationStatus(i, e.target.value as Location['status'])}
                            className={`text-xs bg-transparent border-none focus:outline-none cursor-pointer font-medium ${statusColor}`}
                          >
                            <option value="inconnu">❓ Inconnu</option>
                            <option value="connu">◎ Connu</option>
                            <option value="exploré">✓ Exploré</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <select
                            value={rep}
                            onChange={e => handleUpdateLocationReputation(i, e.target.value as Location['reputation'])}
                            className={`text-xs font-medium rounded border px-1.5 py-0.5 focus:outline-none cursor-pointer transition-colors ${repColor} ${repBg}`}
                            style={{ background: 'transparent' }}
                          >
                            <option value="héros">★ Héros</option>
                            <option value="respecté">◆ Respecté</option>
                            <option value="neutre">— Neutre</option>
                            <option value="suspect">◇ Suspect</option>
                            <option value="recherché">✕ Recherché</option>
                          </select>
                          {locNpcs.length > 0 && locNpcs.map((n, ni) => (
                            <span key={ni} className="text-xs text-violet-400/70 bg-violet-900/20 border border-violet-800/30 rounded px-1.5 py-0.5">{n.name}</span>
                          ))}
                          {loc.notes && (
                            <button
                              onClick={() => setExpandedLocation(expandedLocation === i ? null : i)}
                              className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                            >
                              {expandedLocation === i ? '▲ Masquer' : '▼ Notes'}
                            </button>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteLocation(i)}
                        title="Supprimer ce lieu"
                        className="text-stone-700 hover:text-red-400 text-sm transition-colors shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                    {expandedLocation === i && loc.notes && (
                      <div className="mt-3 pt-3 border-t border-stone-800 ml-8">
                        <p className="text-stone-400 text-xs leading-relaxed whitespace-pre-wrap">{loc.notes}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Prochaine session */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-stone-300 text-sm font-semibold">Prochaine session</h2>
              <p className="text-stone-500 text-xs mt-0.5">Planifiez la prochaine séance</p>
            </div>
            <div className="flex items-center gap-3">
              {savingSessionPrep && <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />}
              {hasSessionPrep && !editingSessionPrep && (
                <button onClick={() => setEditingSessionPrep(true)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Modifier</button>
              )}
              {hasSessionPrep && (
                <button onClick={handleClearSessionPrep} className="text-red-500 hover:text-red-400 text-xs transition-colors">Effacer</button>
              )}
              {!hasSessionPrep && !editingSessionPrep && (
                <button onClick={() => setEditingSessionPrep(true)} className="text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors">+ Planifier</button>
              )}
            </div>
          </div>

          {(editingSessionPrep || hasSessionPrep) ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Titre</label>
                  <input
                    type="text"
                    placeholder="ex. L'attaque du manoir…"
                    value={sessionPrepDraft.title}
                    onChange={e => setSessionPrepDraft(d => ({ ...d, title: e.target.value }))}
                    disabled={!editingSessionPrep}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Date prévue</label>
                  <input
                    type="date"
                    value={sessionPrepDraft.date}
                    onChange={e => setSessionPrepDraft(d => ({ ...d, date: e.target.value }))}
                    disabled={!editingSessionPrep}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              {/* NPCs à mettre en avant */}
              {(campaign.npcs ?? []).length > 0 && (
                <div>
                  <label className="text-stone-500 text-xs block mb-2">PNJ impliqués</label>
                  <div className="flex flex-wrap gap-2">
                    {(campaign.npcs ?? []).map((npc, i) => {
                      const selected = sessionPrepDraft.npc_names.includes(npc.name)
                      return (
                        <button
                          key={i}
                          disabled={!editingSessionPrep}
                          onClick={() => setSessionPrepDraft(d => ({
                            ...d,
                            npc_names: selected ? d.npc_names.filter(n => n !== npc.name) : [...d.npc_names, npc.name],
                          }))}
                          className={`text-xs rounded-lg px-2.5 py-1 border transition-colors ${selected ? 'bg-violet-900/40 border-violet-600/50 text-violet-200' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-violet-700/50 hover:text-stone-300'} disabled:cursor-default`}
                        >
                          {npc.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Lieux à visiter */}
              {(campaign.locations ?? []).length > 0 && (
                <div>
                  <label className="text-stone-500 text-xs block mb-2">Lieux à visiter</label>
                  <div className="flex flex-wrap gap-2">
                    {(campaign.locations ?? []).map((loc, i) => {
                      const selected = sessionPrepDraft.location_names.includes(loc.name)
                      return (
                        <button
                          key={i}
                          disabled={!editingSessionPrep}
                          onClick={() => setSessionPrepDraft(d => ({
                            ...d,
                            location_names: selected ? d.location_names.filter(n => n !== loc.name) : [...d.location_names, loc.name],
                          }))}
                          className={`text-xs rounded-lg px-2.5 py-1 border transition-colors ${selected ? 'bg-amber-900/40 border-amber-600/50 text-amber-200' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/50 hover:text-stone-300'} disabled:cursor-default`}
                        >
                          {loc.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Rencontres planifiées */}
              {(campaign.saved_encounters ?? []).length > 0 && (
                <div>
                  <label className="text-stone-500 text-xs block mb-2">Rencontres planifiées</label>
                  <div className="flex flex-wrap gap-2">
                    {(campaign.saved_encounters ?? []).map((enc, i) => {
                      const selected = sessionPrepDraft.encounter_names.includes(enc.name)
                      const partyLevels = characters.map(c => c.level)
                      const diff = computeEncounterDifficulty(enc.entries, partyLevels)
                      return (
                        <button
                          key={i}
                          disabled={!editingSessionPrep}
                          onClick={() => setSessionPrepDraft(d => ({
                            ...d,
                            encounter_names: selected ? d.encounter_names.filter(n => n !== enc.name) : [...d.encounter_names, enc.name],
                          }))}
                          className={`text-xs rounded-lg px-2.5 py-1 border transition-colors flex items-center gap-1.5 ${selected ? 'bg-red-900/40 border-red-600/50 text-red-200' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-red-700/50 hover:text-stone-300'} disabled:cursor-default`}
                        >
                          {enc.name}
                          {diff && <span className={`font-semibold text-xs ${selected ? '' : difficultyColor(diff)}`}>{diff}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Notes de préparation */}
              <div>
                <label className="text-stone-500 text-xs block mb-1">Notes de préparation</label>
                <textarea
                  placeholder={"Objectifs de la session, secrets à révéler, rebondissements…"}
                  value={sessionPrepDraft.notes}
                  onChange={e => setSessionPrepDraft(d => ({ ...d, notes: e.target.value }))}
                  disabled={!editingSessionPrep}
                  rows={4}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors resize-y disabled:opacity-60"
                />
              </div>

              {editingSessionPrep && (
                <div className="flex items-center justify-end gap-3">
                  {hasSessionPrep && (
                    <button onClick={() => setEditingSessionPrep(false)} className="text-stone-500 hover:text-stone-300 text-sm transition-colors">Annuler</button>
                  )}
                  <button
                    onClick={handleSaveSessionPrep}
                    disabled={savingSessionPrep}
                    className="text-sky-400 hover:text-sky-300 text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    Enregistrer
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-stone-600 text-sm text-center py-4">Aucune session planifiée. Cliquez sur "+ Planifier" pour préparer la prochaine séance.</p>
          )}
        </div>

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
            <button
              onClick={() => { setAddingSession(v => !v); setSessionDraft({ title: '', session_date: '', notes: '' }) }}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
            >
              {addingSession ? 'Annuler' : '+ Nouvelle session'}
            </button>
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
              <textarea
                placeholder={"Notes de la session…\n\nSyntaxe : ## Titre  **gras**  *italique*  - liste  ---"}
                value={sessionDraft.notes}
                onChange={e => setSessionDraft(d => ({ ...d, notes: e.target.value }))}
                rows={5}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono"
              />
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

          {sessions.length === 0 && !addingSession ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-8 text-center">
              <p className="text-stone-500 text-sm">
                Aucune session enregistrée.{' '}
                <button onClick={() => setAddingSession(true)} className="text-amber-400 hover:text-amber-300 transition-colors">
                  Créer la première
                </button>
              </p>
            </div>
          ) : sessionView === 'timeline' ? (
            <div className="space-y-0">
              {sessions.map((s, i) => (
                <div key={s.id} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0 w-5">
                    <div className={`w-3 h-3 rounded-full mt-3 border-2 border-stone-950 shrink-0 transition-colors ${expandedSession === s.id ? 'bg-amber-500' : 'bg-stone-600'}`} />
                    {i < sessions.length - 1 && <div className="flex-1 w-0.5 bg-stone-800 my-1 min-h-3" />}
                  </div>
                  <div className="flex-1 pb-2">
                    {editingSession === s.id ? (
                      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-3">
                        <div className="flex gap-3">
                          <input type="text" value={editSessionDraft.title}
                            onChange={e => setEditSessionDraft(d => ({ ...d, title: e.target.value }))}
                            className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                          <input type="date" value={editSessionDraft.session_date}
                            onChange={e => setEditSessionDraft(d => ({ ...d, session_date: e.target.value }))}
                            className="w-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                        </div>
                        <textarea value={editSessionDraft.notes}
                          onChange={e => setEditSessionDraft(d => ({ ...d, notes: e.target.value }))}
                          rows={5} placeholder={"## Titre  **gras**  *italique*  - liste"}
                          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-700 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono" />
                        <div className="flex items-center justify-between">
                          <button onClick={() => setEditingSession(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                          <div className="flex gap-4">
                            <button onClick={() => handleDeleteSession(s.id)} className="text-red-500 hover:text-red-400 text-xs transition-colors">Supprimer</button>
                            <button onClick={() => handleUpdateSession(s.id)} disabled={saving || !editSessionDraft.title.trim()}
                              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40">Enregistrer</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-800/50 transition-colors text-left group"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-stone-600 text-xs font-mono shrink-0">#{i + 1}</span>
                              <span className="text-white text-sm font-medium truncate">{s.title}</span>
                            </div>
                            {s.session_date && (
                              <p className="text-stone-500 text-xs mt-0.5">
                                {new Date(s.session_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setEditSessionDraft({ title: s.title, session_date: s.session_date ?? '', notes: s.notes ?? '' }); setEditingSession(s.id); setExpandedSession(null) }}
                            className="shrink-0 text-stone-600 hover:text-stone-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                          >Modifier</button>
                        </button>
                        {expandedSession === s.id && s.notes && (
                          <div className="px-4 pb-4 border-t border-stone-800 pt-3">
                            <MarkdownText>{s.notes}</MarkdownText>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
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
                            setEditSessionDraft({ title: s.title, session_date: s.session_date ?? '', notes: s.notes ?? '' })
                            setEditingSession(s.id)
                            setExpandedSession(null)
                          }}
                          className="shrink-0 text-stone-600 hover:text-stone-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Modifier
                        </button>
                      </button>
                      {expandedSession === s.id && s.notes && (
                        <div className="px-5 pb-5 border-t border-stone-800 pt-4">
                          <MarkdownText>{s.notes}</MarkdownText>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
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
