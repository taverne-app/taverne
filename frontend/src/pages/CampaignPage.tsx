import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getCampaign,
  createCampaign,
  updateCampaign,
  addCharacterToCampaign,
  removeCharacterFromCampaign,
  type Campaign,
  type Npc,
  type GameCalendar,
  type TreasureItem,
  type Location,
  type SessionPrep,
  type PrepScene,
  type CustomMonster,
  type Faction,
  type RandomTable,
  type RandomTableEntry,
  type MapPin,
  type CampaignMap,
} from '../api/campaigns'
import { generateShareToken, revokeShareToken } from '../api/share'
import { listCharacters, longRest, updateInventory, updateIdentity, updateHp, type Character } from '../api/characters'
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
import { canLevelUp, xpForNextLevel } from '../data/xp'
import { MarkdownText } from '../components/MarkdownText'
import { computeEncounterDifficulty, difficultyColor } from '../data/encounter_difficulty'
import { CR_XP } from '../data/monsters'
import { generateNpc, generateNpcName, NPC_RACES, type GeneratedNpc } from '../data/npc_generator'

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
  const emptySessionPrep = (): SessionPrep => ({ title: '', date: '', notes: '', npc_names: [], location_names: [], encounter_names: [], scenes: [] })
  const [sessionPrepDraft, setSessionPrepDraft] = useState<SessionPrep>(emptySessionPrep())
  const [editingSessionPrep, setEditingSessionPrep] = useState(false)
  const [hasSessionPrep, setHasSessionPrep] = useState(false)
  const [savingSessionPrep, setSavingSessionPrep] = useState(false)

  // Bestiaire personnalisé
  const emptyMonsterDraft = (): CustomMonster => ({ name: '', cr: '1', ac: 12, hp_avg: 10, initiative_mod: 0, xp: 200 })
  const [monsterDraft, setMonsterDraft] = useState<CustomMonster>(emptyMonsterDraft())
  const [addingMonster, setAddingMonster] = useState(false)

  // Factions
  const emptyFactionDraft = (): Faction => ({ name: '', description: '', reputation: 0, notes: '' })
  const [factionDraft, setFactionDraft] = useState<Faction>(emptyFactionDraft())
  const [addingFaction, setAddingFaction] = useState(false)
  const [expandedFaction, setExpandedFaction] = useState<number | null>(null)

  // Générateur de PNJ
  const [generatedNpc, setGeneratedNpc] = useState<GeneratedNpc | null>(null)
  const [showNpcGenerator, setShowNpcGenerator] = useState(false)

  // XP
  const [xpInput, setXpInput] = useState('')
  const [showXpPanel, setShowXpPanel] = useState(false)
  const [savingXp, setSavingXp] = useState(false)

  // Tables aléatoires
  const emptyTableDraft = (): RandomTable => ({ name: '', entries: [] })
  const [tableDraft, setTableDraft] = useState<RandomTable>(emptyTableDraft())
  const [addingTable, setAddingTable] = useState(false)
  const [tableResults, setTableResults] = useState<Record<number, string>>({})
  const [editingTableIdx, setEditingTableIdx] = useState<number | null>(null)
  const [entryDraft, setEntryDraft] = useState<RandomTableEntry>({ weight: 1, text: '' })

  // Scènes de préparation
  const emptyScene = (): PrepScene => ({
    id: crypto.randomUUID(),
    title: '', location_name: '', npc_names: [], encounter_name: '',
    treasure: '', hook: '', notes: '', done: false,
  })
  const [sceneDraft, setSceneDraft] = useState<PrepScene>(emptyScene())
  const [addingScene, setAddingScene] = useState(false)
  const [expandedScene, setExpandedScene] = useState<string | null>(null)

  // Carte de campagne
  const [mapUrlDraft, setMapUrlDraft] = useState('')
  const [editingMapUrl, setEditingMapUrl] = useState(false)
  const [mapAddingPin, setMapAddingPin] = useState(false)
  const [pinLabelDraft, setPinLabelDraft] = useState('')
  const [pinColorDraft, setPinColorDraft] = useState<MapPin['color']>('amber')

  // Tableau de bord
  const [showDashboard, setShowDashboard] = useState(true)

  // Export / Import
  const [importing, setImporting] = useState(false)

  // Recherche globale
  const [searchQuery, setSearchQuery] = useState('')

  // HP rapide (tableau de bord santé du groupe)
  const [hpEditCharId, setHpEditCharId] = useState<number | null>(null)
  const [hpDeltaValue, setHpDeltaValue] = useState(5)

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

  async function handleQuickHp(charId: number, amount: number, type: 'damage' | 'heal') {
    if (amount <= 0) return
    const updated = await updateHp(charId, amount, type)
    setCharacters(prev => prev.map(c => c.id === charId ? updated : c))
    setHpEditCharId(null)
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

  function handleGenerateNpc() {
    setGeneratedNpc(generateNpc())
    setShowNpcGenerator(true)
  }

  async function handleSaveGeneratedNpc() {
    if (!campaign || !generatedNpc) return
    const npc: Npc = {
      name: generatedNpc.name,
      role: generatedNpc.profession,
      status: 'inconnu',
      location: '',
      notes: `${generatedNpc.race} · ${generatedNpc.gender}\n\n**Apparence :** ${generatedNpc.appearance}\n**Personnalité :** ${generatedNpc.personality}\n**Lien :** ${generatedNpc.bond}\n**Défaut :** ${generatedNpc.flaw}\n**Voix :** ${generatedNpc.voice}`,
    }
    const next = [...(campaign.npcs ?? []), npc]
    const updated = await updateCampaign(campaign.id, { npcs: next })
    setCampaign(updated)
    setShowNpcGenerator(false)
    setGeneratedNpc(null)
  }

  async function handleAwardXp() {
    if (!campaign || !xpInput.trim() || characters.length === 0) return
    const amount = parseInt(xpInput)
    if (isNaN(amount) || amount <= 0) return
    setSavingXp(true)
    try {
      const updated = await Promise.all(
        characters.map(c => updateIdentity(c.id, { experience_points: c.experience_points + amount }))
      )
      setCharacters(updated)
      setXpInput('')
      setShowXpPanel(false)
    } finally { setSavingXp(false) }
  }

  async function handleAddTable() {
    if (!campaign || !tableDraft.name.trim()) return
    const next = [...(campaign.random_tables ?? []), { ...tableDraft, name: tableDraft.name.trim() }]
    const updated = await updateCampaign(campaign.id, { random_tables: next })
    setCampaign(updated)
    setTableDraft(emptyTableDraft())
    setAddingTable(false)
  }

  async function handleDeleteTable(idx: number) {
    if (!campaign) return
    const next = (campaign.random_tables ?? []).filter((_, i) => i !== idx)
    const updated = await updateCampaign(campaign.id, { random_tables: next })
    setCampaign(updated)
    setTableResults(prev => { const n = { ...prev }; delete n[idx]; return n })
  }

  async function handleAddTableEntry(tableIdx: number) {
    if (!campaign || !entryDraft.text.trim()) return
    const tables = campaign.random_tables ?? []
    const next = tables.map((t, i) =>
      i === tableIdx ? { ...t, entries: [...t.entries, { ...entryDraft, text: entryDraft.text.trim() }] } : t
    )
    const updated = await updateCampaign(campaign.id, { random_tables: next })
    setCampaign(updated)
    setEntryDraft({ weight: 1, text: '' })
  }

  async function handleDeleteTableEntry(tableIdx: number, entryIdx: number) {
    if (!campaign) return
    const tables = campaign.random_tables ?? []
    const next = tables.map((t, i) =>
      i === tableIdx ? { ...t, entries: t.entries.filter((_, j) => j !== entryIdx) } : t
    )
    const updated = await updateCampaign(campaign.id, { random_tables: next })
    setCampaign(updated)
  }

  function handleRollTable(tableIdx: number, table: RandomTable) {
    if (table.entries.length === 0) return
    const total = table.entries.reduce((s, e) => s + (e.weight || 1), 0)
    let roll = Math.random() * total
    for (const entry of table.entries) {
      roll -= entry.weight || 1
      if (roll <= 0) {
        setTableResults(prev => ({ ...prev, [tableIdx]: entry.text }))
        return
      }
    }
    setTableResults(prev => ({ ...prev, [tableIdx]: table.entries[table.entries.length - 1].text }))
  }

  async function handleAddScene() {
    if (!campaign || !sceneDraft.title.trim()) return
    const prep = campaign.session_prep ?? emptySessionPrep()
    const next: SessionPrep = {
      ...prep,
      scenes: [...(prep.scenes ?? []), { ...sceneDraft, id: crypto.randomUUID(), title: sceneDraft.title.trim() }],
    }
    const updated = await updateCampaign(campaign.id, { session_prep: next })
    setCampaign(updated)
    if (updated.session_prep) setSessionPrepDraft(updated.session_prep)
    setHasSessionPrep(true)
    setSceneDraft(emptyScene())
    setAddingScene(false)
  }

  async function handleToggleSceneDone(sceneId: string) {
    if (!campaign?.session_prep) return
    const next: SessionPrep = {
      ...campaign.session_prep,
      scenes: (campaign.session_prep.scenes ?? []).map(s =>
        s.id === sceneId ? { ...s, done: !s.done } : s
      ),
    }
    const updated = await updateCampaign(campaign.id, { session_prep: next })
    setCampaign(updated)
    if (updated.session_prep) setSessionPrepDraft(updated.session_prep)
  }

  async function handleDeleteScene(sceneId: string) {
    if (!campaign?.session_prep) return
    const next: SessionPrep = {
      ...campaign.session_prep,
      scenes: (campaign.session_prep.scenes ?? []).filter(s => s.id !== sceneId),
    }
    const updated = await updateCampaign(campaign.id, { session_prep: next })
    setCampaign(updated)
    if (updated.session_prep) setSessionPrepDraft(updated.session_prep)
    if (expandedScene === sceneId) setExpandedScene(null)
  }

  async function handleSetMapUrl() {
    if (!campaign) return
    const next: CampaignMap = { image_url: mapUrlDraft.trim(), pins: campaign.campaign_map?.pins ?? [] }
    const updated = await updateCampaign(campaign.id, { campaign_map: next })
    setCampaign(updated)
    setEditingMapUrl(false)
  }

  async function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!mapAddingPin || !campaign) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    const pin: MapPin = {
      id: crypto.randomUUID(),
      label: pinLabelDraft.trim() || 'Lieu',
      x, y,
      color: pinColorDraft,
    }
    const currentMap = campaign.campaign_map ?? { image_url: '', pins: [] }
    const next: CampaignMap = { ...currentMap, pins: [...currentMap.pins, pin] }
    const updated = await updateCampaign(campaign.id, { campaign_map: next })
    setCampaign(updated)
    setMapAddingPin(false)
    setPinLabelDraft('')
  }

  async function handleDeletePin(pinId: string) {
    if (!campaign?.campaign_map) return
    const next: CampaignMap = {
      ...campaign.campaign_map,
      pins: campaign.campaign_map.pins.filter(p => p.id !== pinId),
    }
    const updated = await updateCampaign(campaign.id, { campaign_map: next })
    setCampaign(updated)
  }

  async function handleAddFaction() {
    if (!campaign || !factionDraft.name.trim()) return
    const next = [...(campaign.factions ?? []), { ...factionDraft, name: factionDraft.name.trim() }]
    const updated = await updateCampaign(campaign.id, { factions: next })
    setCampaign(updated)
    setFactionDraft(emptyFactionDraft())
    setAddingFaction(false)
  }

  async function handleUpdateFactionReputation(index: number, delta: number) {
    if (!campaign) return
    const next = (campaign.factions ?? []).map((f, i) =>
      i === index ? { ...f, reputation: Math.max(-5, Math.min(5, f.reputation + delta)) } : f
    )
    const updated = await updateCampaign(campaign.id, { factions: next })
    setCampaign(updated)
  }

  async function handleDeleteFaction(index: number) {
    if (!campaign) return
    const next = (campaign.factions ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { factions: next })
    setCampaign(updated)
    if (expandedFaction === index) setExpandedFaction(null)
  }

  async function handleAddCustomMonster() {
    if (!campaign || !monsterDraft.name.trim()) return
    const xp = CR_XP[monsterDraft.cr] ?? 0
    const next = [...(campaign.custom_monsters ?? []), { ...monsterDraft, name: monsterDraft.name.trim(), xp }]
    const updated = await updateCampaign(campaign.id, { custom_monsters: next })
    setCampaign(updated)
    setMonsterDraft(emptyMonsterDraft())
    setAddingMonster(false)
  }

  async function handleDeleteCustomMonster(index: number) {
    if (!campaign) return
    const next = (campaign.custom_monsters ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaign.id, { custom_monsters: next })
    setCampaign(updated)
  }

  function handleExportCampaign() {
    if (!campaign) return
    const data = {
      _version: 1,
      name: campaign.name,
      description: campaign.description,
      dm_notes: campaign.dm_notes,
      npcs: campaign.npcs,
      locations: campaign.locations,
      party_treasury: campaign.party_treasury,
      saved_encounters: campaign.saved_encounters,
      custom_monsters: campaign.custom_monsters,
      factions: campaign.factions,
      random_tables: campaign.random_tables,
      game_calendar: campaign.game_calendar,
      session_prep: campaign.session_prep,
      sessions: sessions,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaign.name.replace(/[^a-z0-9]/gi, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportCampaign(file: File) {
    setImporting(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const newCampaign = await createCampaign(data.name ?? 'Campagne importée', data.description ?? null)
      await updateCampaign(newCampaign.id, {
        dm_notes: data.dm_notes ?? null,
        npcs: data.npcs ?? [],
        locations: data.locations ?? [],
        party_treasury: data.party_treasury ?? [],
        saved_encounters: data.saved_encounters ?? [],
        custom_monsters: data.custom_monsters ?? [],
        factions: data.factions ?? [],
        random_tables: data.random_tables ?? [],
        game_calendar: data.game_calendar ?? {},
        session_prep: data.session_prep ?? null,
      })
      if (Array.isArray(data.sessions)) {
        for (const s of data.sessions) {
          await createSession(newCampaign.id, { title: s.title, session_date: s.session_date, notes: s.notes })
        }
      }
      navigate(`/campaigns/${newCampaign.id}`)
    } catch {
      alert('Fichier invalide ou corrompu.')
    } finally {
      setImporting(false)
    }
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
          const total = npcs.length + locs.length + monsters.length + sess.length
          return (
            <>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher dans la campagne — PNJ, lieux, monstres, sessions…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
                {active ? (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-lg leading-none transition-colors">×</button>
                ) : (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-600 text-sm">🔍</span>
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
                    </>
                  )}
                </div>
              )}
            </>
          )
        })()}

        {/* Tableau de bord MJ */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowDashboard(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-stone-800/50 transition-colors"
          >
            <span className="text-stone-300 text-sm font-semibold">Tableau de bord</span>
            <span className="text-stone-500 text-xs">{showDashboard ? '▲' : '▼'}</span>
          </button>
          {showDashboard && (
            <div className="px-5 pb-5 space-y-4 border-t border-stone-800">
              {/* HP du groupe */}
              {characters.length > 0 && (
                <div>
                  <p className="text-stone-500 text-xs uppercase tracking-widest mb-2 mt-3">Santé du groupe</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {characters.map(c => {
                      const maxHp = c.combat.max_hp
                      const curHp = c.combat.current_hp
                      const pct = maxHp > 0 ? Math.min(1, curHp / maxHp) : 0
                      const bar = pct > 0.5 ? 'bg-emerald-500' : pct > 0.25 ? 'bg-amber-500' : 'bg-red-500'
                      const conditions = (c.state.conditions ?? []).filter(Boolean)
                      const editing = hpEditCharId === c.id
                      return (
                        <div key={c.id} className="bg-stone-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-stone-200 text-xs font-medium truncate max-w-[60%]">{c.name}</span>
                            <button
                              onClick={() => { setHpEditCharId(editing ? null : c.id); setHpDeltaValue(5) }}
                              className={`text-xs tabular-nums transition-colors ${curHp <= 0 ? 'text-red-400' : editing ? 'text-amber-400' : 'text-stone-400 hover:text-white'}`}
                              title="Cliquer pour modifier les PV"
                            >
                              {curHp}/{maxHp}
                              {c.combat.temporary_hp > 0 && <span className="text-sky-400 ml-0.5">+{c.combat.temporary_hp}</span>}
                            </button>
                          </div>
                          <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                            <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct * 100}%` }} />
                          </div>
                          {conditions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {conditions.map((cond: string, i: number) => (
                                <span key={i} className="text-[10px] bg-amber-900/40 border border-amber-700/30 text-amber-300 rounded px-1.5 py-0.5">
                                  {CONDITIONS_FR[cond] ?? cond}
                                </span>
                              ))}
                            </div>
                          )}
                          {editing && (
                            <div className="mt-2 flex items-center gap-1">
                              <input
                                type="number"
                                value={hpDeltaValue}
                                onChange={e => setHpDeltaValue(Math.max(1, parseInt(e.target.value) || 1))}
                                min={1}
                                className="w-14 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-white text-xs text-center focus:outline-none"
                              />
                              <button
                                onClick={() => handleQuickHp(c.id, hpDeltaValue, 'heal')}
                                className="flex-1 bg-emerald-900/60 hover:bg-emerald-900/80 border border-emerald-800/50 text-emerald-400 text-xs font-semibold rounded py-1 transition-colors"
                              >
                                + Soin
                              </button>
                              <button
                                onClick={() => handleQuickHp(c.id, hpDeltaValue, 'damage')}
                                className="flex-1 bg-red-900/60 hover:bg-red-900/80 border border-red-800/50 text-red-400 text-xs font-semibold rounded py-1 transition-colors"
                              >
                                − Dégât
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Calendrier */}
                {(campaign.game_calendar?.date || campaign.game_calendar?.weather) && (
                  <div>
                    <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Calendrier</p>
                    <div className="bg-stone-800 rounded-lg p-3 space-y-1">
                      {campaign.game_calendar.date && (
                        <p className="text-stone-200 text-sm">📅 {campaign.game_calendar.date}</p>
                      )}
                      {campaign.game_calendar.time && (
                        <p className="text-stone-400 text-xs capitalize">{campaign.game_calendar.time}</p>
                      )}
                      {campaign.game_calendar.weather && (
                        <p className="text-stone-300 text-sm">🌤 {campaign.game_calendar.weather}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Prochaine session */}
                {campaign.session_prep && (
                  <div>
                    <p className="text-stone-500 text-xs uppercase tracking-widest mb-2">Prochaine session</p>
                    <div className="bg-sky-950/40 border border-sky-800/30 rounded-lg p-3 space-y-1">
                      <p className="text-sky-200 text-sm font-medium">{campaign.session_prep.title || 'Sans titre'}</p>
                      {campaign.session_prep.date && (
                        <p className="text-sky-400 text-xs">📅 {campaign.session_prep.date}</p>
                      )}
                      {campaign.session_prep.npc_names.length > 0 && (
                        <p className="text-stone-400 text-xs">{campaign.session_prep.npc_names.length} PNJ · {campaign.session_prep.encounter_names.length} rencontres</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Progression XP */}
              {characters.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-stone-500 text-xs uppercase tracking-widest">Progression XP</p>
                    <button
                      onClick={() => setShowXpPanel(v => !v)}
                      className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
                    >
                      {showXpPanel ? 'Annuler' : '+ Attribuer XP'}
                    </button>
                  </div>
                  {showXpPanel && (
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number"
                        value={xpInput}
                        onChange={e => setXpInput(e.target.value)}
                        placeholder="XP à distribuer à tous…"
                        autoFocus
                        className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                      <button
                        onClick={handleAwardXp}
                        disabled={savingXp || !xpInput.trim()}
                        className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg px-3 py-2 transition-colors disabled:opacity-40"
                      >
                        Distribuer
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {characters.map(c => {
                      const nextXp = xpForNextLevel(c.level)
                      const prevXp = xpForNextLevel(c.level - 1) ?? 0
                      const pct = nextXp ? Math.min(1, Math.max(0, (c.experience_points - prevXp) / (nextXp - prevXp))) : 1
                      const levelUp = canLevelUp(c.level, c.experience_points)
                      return (
                        <div key={c.id} className="bg-stone-800 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-stone-200 text-xs font-medium truncate">{c.name}</span>
                              {levelUp && (
                                <span className="text-xs bg-amber-500 text-black font-bold rounded px-1.5 py-0.5 shrink-0">↑ NIV</span>
                              )}
                            </div>
                            <span className="text-stone-500 text-xs shrink-0 ml-2">Niv.{c.level} · {c.experience_points.toLocaleString()} XP</span>
                          </div>
                          <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct * 100}%` }} />
                          </div>
                          {nextXp && (
                            <p className="text-stone-600 text-[10px] mt-0.5 text-right">
                              {nextXp.toLocaleString()} XP pour niv.{c.level + 1}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {characters.length === 0 && !campaign.game_calendar?.date && !campaign.session_prep && (
                <p className="text-stone-600 text-sm text-center py-2">Ajoutez des personnages et configurez le calendrier pour voir le résumé ici.</p>
              )}
            </div>
          )}
        </div>

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
                <Link
                  to={`/combat?campaign=${campaign.id}`}
                  className="bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 text-sm font-medium rounded-lg px-3 py-1.5 transition-colors"
                >
                  ⚔ Combat
                </Link>
                <button
                  onClick={handleExportCampaign}
                  title="Exporter la campagne en JSON"
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                >
                  ↓ Export
                </button>
                <label
                  title="Importer une campagne depuis un JSON"
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors cursor-pointer"
                >
                  {importing ? '…' : '↑ Import'}
                  <input
                    type="file"
                    accept=".json"
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
            <div className="flex items-center gap-3">
              <button
                onClick={handleGenerateNpc}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                ⚡ Générer
              </button>
              <button
                onClick={() => { setAddingNpc(v => !v); setNpcDraft({ name: '', role: '', status: 'inconnu', location: '', notes: '' }) }}
                className="text-violet-400 hover:text-violet-300 text-xs font-semibold transition-colors"
              >
                {addingNpc ? 'Annuler' : '+ Ajouter'}
              </button>
            </div>
          </div>

          {/* Générateur de PNJ */}
          {showNpcGenerator && generatedNpc && (
            <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-4 mb-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-bold text-base">{generatedNpc.name}</p>
                  <p className="text-amber-400 text-xs">{generatedNpc.race} · {generatedNpc.gender} · {generatedNpc.profession}</p>
                </div>
                <button onClick={() => setShowNpcGenerator(false)} className="text-stone-600 hover:text-stone-400 text-lg leading-none">×</button>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Apparence</span> {generatedNpc.appearance}</p>
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Personnalité</span> {generatedNpc.personality}</p>
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Lien</span> {generatedNpc.bond}</p>
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Défaut</span> {generatedNpc.flaw}</p>
                <p className="text-stone-300"><span className="text-stone-500 text-xs">Voix</span> {generatedNpc.voice}</p>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => setGeneratedNpc(generateNpc())}
                  className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
                >
                  ↻ Régénérer
                </button>
                <button
                  onClick={handleSaveGeneratedNpc}
                  className="bg-violet-700 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                >
                  + Ajouter à la campagne
                </button>
              </div>
            </div>
          )}

          {addingNpc && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Nom *"
                    value={npcDraft.name}
                    onChange={e => setNpcDraft(d => ({ ...d, name: e.target.value }))}
                    autoFocus
                    className="flex-1 min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                  <select
                    onChange={e => setNpcDraft(d => ({ ...d, name: generateNpcName(e.target.value || undefined) }))}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-1.5 py-2 text-stone-300 text-xs focus:outline-none focus:border-violet-500 transition-colors"
                    title="Générer un nom par race"
                    defaultValue=""
                  >
                    <option value="">🎲</option>
                    {NPC_RACES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
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

              {/* Scènes de préparation */}
              {hasSessionPrep && (
                <div className="pt-2 border-t border-stone-800">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-stone-500 text-xs uppercase tracking-widest">
                      Scènes ({(campaign.session_prep?.scenes ?? []).length})
                    </p>
                    <button
                      onClick={() => { setAddingScene(v => !v); setSceneDraft(emptyScene()) }}
                      className="text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors"
                    >
                      {addingScene ? 'Annuler' : '+ Scène'}
                    </button>
                  </div>

                  {addingScene && (
                    <div className="bg-stone-800/60 border border-stone-700 rounded-lg p-3 mb-3 space-y-2">
                      <input
                        type="text"
                        value={sceneDraft.title}
                        onChange={e => setSceneDraft(d => ({ ...d, title: e.target.value }))}
                        autoFocus
                        placeholder="Titre de la scène *"
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={sceneDraft.location_name}
                          onChange={e => setSceneDraft(d => ({ ...d, location_name: e.target.value }))}
                          placeholder="Lieu"
                          className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
                        />
                        <input
                          type="text"
                          value={sceneDraft.encounter_name}
                          onChange={e => setSceneDraft(d => ({ ...d, encounter_name: e.target.value }))}
                          placeholder="Rencontre liée"
                          className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
                        />
                        <input
                          type="text"
                          value={sceneDraft.hook}
                          onChange={e => setSceneDraft(d => ({ ...d, hook: e.target.value }))}
                          placeholder="Accroche / déclencheur"
                          className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
                        />
                        <input
                          type="text"
                          value={sceneDraft.treasure}
                          onChange={e => setSceneDraft(d => ({ ...d, treasure: e.target.value }))}
                          placeholder="Trésor / récompense"
                          className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
                        />
                      </div>
                      <textarea
                        value={sceneDraft.notes}
                        onChange={e => setSceneDraft(d => ({ ...d, notes: e.target.value }))}
                        placeholder="Notes de la scène…"
                        rows={2}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={handleAddScene}
                          disabled={!sceneDraft.title.trim()}
                          className="bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40"
                        >
                          Ajouter la scène
                        </button>
                      </div>
                    </div>
                  )}

                  {(campaign.session_prep?.scenes ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(campaign.session_prep!.scenes).map(scene => (
                        <div key={scene.id} className={`border rounded-lg overflow-hidden transition-colors ${scene.done ? 'border-stone-800 opacity-60' : 'border-sky-800/40'}`}>
                          <div
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-stone-800/40 transition-colors"
                            onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                          >
                            <button
                              onClick={e => { e.stopPropagation(); handleToggleSceneDone(scene.id) }}
                              className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${scene.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-600 hover:border-sky-500'}`}
                            >
                              {scene.done && <span className="text-[10px] font-bold">✓</span>}
                            </button>
                            <p className={`text-sm font-medium flex-1 truncate ${scene.done ? 'line-through text-stone-500' : 'text-white'}`}>{scene.title}</p>
                            {scene.location_name && <span className="text-stone-600 text-xs shrink-0">📍 {scene.location_name}</span>}
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteScene(scene.id) }}
                              className="text-stone-700 hover:text-red-400 text-base leading-none shrink-0 transition-colors ml-1"
                            >×</button>
                          </div>
                          {expandedScene === scene.id && (
                            <div className="px-3 pb-3 pt-0 text-xs space-y-1 border-t border-stone-800">
                              {scene.hook && <p className="text-stone-400">⚡ <span className="text-stone-300">{scene.hook}</span></p>}
                              {scene.encounter_name && <p className="text-stone-400">⚔ <span className="text-stone-300">{scene.encounter_name}</span></p>}
                              {scene.treasure && <p className="text-stone-400">💰 <span className="text-stone-300">{scene.treasure}</span></p>}
                              {scene.notes && <p className="text-stone-300 mt-1">{scene.notes}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !addingScene && (
                      <p className="text-stone-700 text-xs text-center py-2">Aucune scène. Structurez votre session en actes.</p>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-stone-600 text-sm text-center py-4">Aucune session planifiée. Cliquez sur "+ Planifier" pour préparer la prochaine séance.</p>
          )}
        </div>

        {/* Carte de campagne */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Carte de campagne</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingMapUrl(v => !v); setMapUrlDraft(campaign.campaign_map?.image_url ?? '') }}
                className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
              >
                {campaign.campaign_map?.image_url ? '✎ URL' : '+ URL'}
              </button>
              {campaign.campaign_map?.image_url && (
                <button
                  onClick={() => { setMapAddingPin(v => !v); setPinLabelDraft('') }}
                  className={`text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${
                    mapAddingPin
                      ? 'bg-sky-700/40 border-sky-500 text-sky-300'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'
                  }`}
                >
                  {mapAddingPin ? 'Annuler' : '📍 Épingle'}
                </button>
              )}
            </div>
          </div>

          {editingMapUrl && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="text-stone-500 text-xs block mb-1">URL de l'image</label>
                <input
                  type="url"
                  value={mapUrlDraft}
                  onChange={e => setMapUrlDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSetMapUrl()}
                  placeholder="https://..."
                  autoFocus
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingMapUrl(false)} className="text-stone-500 text-xs hover:text-stone-300 transition-colors">Annuler</button>
                <button
                  onClick={handleSetMapUrl}
                  disabled={!mapUrlDraft.trim()}
                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                >
                  Définir
                </button>
              </div>
            </div>
          )}

          {mapAddingPin && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-sky-400 text-xs">Saisissez le nom puis cliquez sur la carte pour placer l'épingle.</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pinLabelDraft}
                  onChange={e => setPinLabelDraft(e.target.value)}
                  placeholder="Nom du lieu…"
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                />
                <div className="flex gap-1 shrink-0">
                  {(['amber', 'red', 'blue', 'green', 'purple', 'sky'] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => setPinColorDraft(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        pinColorDraft === c ? 'border-white scale-125' : 'border-transparent opacity-60 hover:opacity-100'
                      } ${
                        c === 'amber' ? 'bg-amber-500' : c === 'red' ? 'bg-red-500' :
                        c === 'blue' ? 'bg-blue-500' : c === 'green' ? 'bg-emerald-500' :
                        c === 'purple' ? 'bg-purple-500' : 'bg-sky-500'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {campaign.campaign_map?.image_url ? (
            <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <div
                className={`relative select-none ${mapAddingPin ? 'cursor-crosshair' : ''}`}
                onClick={handleMapClick}
              >
                <img
                  src={campaign.campaign_map.image_url}
                  alt="Carte de campagne"
                  className="w-full object-contain max-h-[500px] pointer-events-none"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
                {(campaign.campaign_map.pins ?? []).map(pin => (
                  <div
                    key={pin.id}
                    className="absolute group"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className={`relative flex items-center gap-1 text-white text-xs font-semibold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap ${
                      pin.color === 'amber' ? 'bg-amber-600' : pin.color === 'red' ? 'bg-red-600' :
                      pin.color === 'blue' ? 'bg-blue-600' : pin.color === 'green' ? 'bg-emerald-600' :
                      pin.color === 'purple' ? 'bg-purple-600' : 'bg-sky-600'
                    }`}>
                      📍 {pin.label}
                      <button
                        onClick={() => handleDeletePin(pin.id)}
                        className="ml-1 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                      >
                        ×
                      </button>
                    </div>
                    <div className={`absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-2 ${
                      pin.color === 'amber' ? 'bg-amber-500' : pin.color === 'red' ? 'bg-red-500' :
                      pin.color === 'blue' ? 'bg-blue-500' : pin.color === 'green' ? 'bg-emerald-500' :
                      pin.color === 'purple' ? 'bg-purple-500' : 'bg-sky-500'
                    }`} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border border-stone-800 border-dashed rounded-xl py-10 text-center">
              <p className="text-stone-600 text-sm">Aucune carte. Ajoutez une URL d'image pour visualiser votre monde.</p>
            </div>
          )}
        </div>

        {/* Bestiaire personnalisé */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Bestiaire ({(campaign.custom_monsters ?? []).length})
            </h2>
            <button
              onClick={() => { setAddingMonster(v => !v); setMonsterDraft(emptyMonsterDraft()) }}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
            >
              {addingMonster ? 'Annuler' : '+ Monstre'}
            </button>
          </div>

          {addingMonster && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label className="text-stone-500 text-xs block mb-1">Nom *</label>
                  <input
                    type="text"
                    value={monsterDraft.name}
                    onChange={e => setMonsterDraft(d => ({ ...d, name: e.target.value }))}
                    autoFocus
                    placeholder="ex. Gobelin des ombres"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">CR</label>
                  <select
                    value={monsterDraft.cr}
                    onChange={e => setMonsterDraft(d => ({ ...d, cr: e.target.value, xp: CR_XP[e.target.value] ?? 0 }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    {['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30'].map(cr => (
                      <option key={cr} value={cr}>CR {cr} — {CR_XP[cr] ?? 0} XP</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">CA</label>
                  <input
                    type="number"
                    value={monsterDraft.ac}
                    onChange={e => setMonsterDraft(d => ({ ...d, ac: Number(e.target.value) }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">PV moyens</label>
                  <input
                    type="number"
                    value={monsterDraft.hp_avg}
                    onChange={e => setMonsterDraft(d => ({ ...d, hp_avg: Number(e.target.value) }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Mod. Initiative</label>
                  <input
                    type="number"
                    value={monsterDraft.initiative_mod}
                    onChange={e => setMonsterDraft(d => ({ ...d, initiative_mod: Number(e.target.value) }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-stone-500 text-xs block mb-1">Notes</label>
                  <input
                    type="text"
                    value={monsterDraft.notes ?? ''}
                    onChange={e => setMonsterDraft(d => ({ ...d, notes: e.target.value }))}
                    placeholder="Résistances, attaques…"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddCustomMonster}
                  disabled={saving || !monsterDraft.name.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign.custom_monsters ?? []).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(campaign.custom_monsters ?? []).map((m, i) => (
                <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium">{m.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      <span className="text-stone-500 text-xs">CR {m.cr}</span>
                      <span className="text-stone-500 text-xs">CA {m.ac}</span>
                      <span className="text-stone-500 text-xs">{m.hp_avg} PV</span>
                      <span className="text-stone-500 text-xs">Init {m.initiative_mod >= 0 ? '+' : ''}{m.initiative_mod}</span>
                      <span className="text-amber-600/80 text-xs">{m.xp} XP</span>
                    </div>
                    {m.notes && <p className="text-stone-500 text-xs mt-1 italic">{m.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteCustomMonster(i)}
                    className="text-stone-600 hover:text-red-400 text-lg leading-none shrink-0 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            !addingMonster && (
              <p className="text-stone-600 text-sm text-center py-4">Aucun monstre personnalisé. Créez-en pour les utiliser dans les rencontres.</p>
            )
          )}
        </div>

        {/* Factions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Factions ({(campaign.factions ?? []).length})
            </h2>
            <button
              onClick={() => { setAddingFaction(v => !v); setFactionDraft(emptyFactionDraft()) }}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
            >
              {addingFaction ? 'Annuler' : '+ Faction'}
            </button>
          </div>

          {addingFaction && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Nom *</label>
                  <input
                    type="text"
                    value={factionDraft.name}
                    onChange={e => setFactionDraft(d => ({ ...d, name: e.target.value }))}
                    autoFocus
                    placeholder="ex. La Guilde des Marchands"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Description courte</label>
                  <input
                    type="text"
                    value={factionDraft.description}
                    onChange={e => setFactionDraft(d => ({ ...d, description: e.target.value }))}
                    placeholder="ex. Marchands influents de la capitale"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-stone-500 text-xs block mb-1">Notes</label>
                <textarea
                  value={factionDraft.notes}
                  onChange={e => setFactionDraft(d => ({ ...d, notes: e.target.value }))}
                  placeholder="Alliés, ennemis, objectifs…"
                  rows={2}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddFaction}
                  disabled={saving || !factionDraft.name.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign.factions ?? []).length > 0 ? (
            <div className="space-y-2">
              {(campaign.factions ?? []).map((faction, i) => {
                const rep = faction.reputation
                const repLabel = rep >= 4 ? 'Vénéré' : rep >= 2 ? 'Allié' : rep >= 0 ? 'Neutre' : rep >= -2 ? 'Suspect' : 'Ennemi'
                const repColor = rep >= 2 ? 'text-emerald-400' : rep >= 0 ? 'text-stone-400' : rep >= -2 ? 'text-amber-400' : 'text-red-400'
                const repDotColor = rep >= 2 ? 'bg-emerald-500' : rep >= 0 ? 'bg-stone-500' : rep >= -2 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-stone-800/50 transition-colors"
                      onClick={() => setExpandedFaction(expandedFaction === i ? null : i)}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${repDotColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{faction.name}</p>
                        {faction.description && <p className="text-stone-500 text-xs truncate">{faction.description}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-medium ${repColor}`}>{repLabel}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); handleUpdateFactionReputation(i, -1) }}
                            disabled={rep <= -5}
                            className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white text-sm font-bold transition-colors disabled:opacity-30 flex items-center justify-center"
                          >−</button>
                          <span className="text-stone-300 text-xs w-5 text-center font-mono">{rep > 0 ? `+${rep}` : rep}</span>
                          <button
                            onClick={e => { e.stopPropagation(); handleUpdateFactionReputation(i, +1) }}
                            disabled={rep >= 5}
                            className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white text-sm font-bold transition-colors disabled:opacity-30 flex items-center justify-center"
                          >+</button>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteFaction(i) }}
                          className="text-stone-600 hover:text-red-400 text-lg leading-none transition-colors ml-1"
                        >×</button>
                      </div>
                    </div>
                    {/* Reputation bar */}
                    <div className="px-4 pb-1">
                      <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${repDotColor}`}
                          style={{ width: `${((rep + 5) / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                    {expandedFaction === i && faction.notes && (
                      <div className="px-4 pb-4 pt-1">
                        <p className="text-stone-400 text-sm">{faction.notes}</p>
                      </div>
                    )}
                    {expandedFaction === i && !faction.notes && (
                      <div className="px-4 pb-3 pt-1">
                        <p className="text-stone-600 text-xs italic">Aucune note.</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            !addingFaction && (
              <p className="text-stone-600 text-sm text-center py-4">Aucune faction. Ajoutez des organisations pour suivre la réputation des PJs.</p>
            )
          )}
        </div>

        {/* Tables aléatoires */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Tables aléatoires ({(campaign.random_tables ?? []).length})
            </h2>
            <button
              onClick={() => { setAddingTable(v => !v); setTableDraft(emptyTableDraft()) }}
              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
            >
              {addingTable ? 'Annuler' : '+ Table'}
            </button>
          </div>

          {addingTable && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div>
                <label className="text-stone-500 text-xs block mb-1">Nom de la table *</label>
                <input
                  type="text"
                  value={tableDraft.name}
                  onChange={e => setTableDraft(d => ({ ...d, name: e.target.value }))}
                  autoFocus
                  placeholder="ex. Événements de voyage, Météo, PNJ de rue…"
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <p className="text-stone-600 text-xs">Vous pourrez ajouter des entrées après la création.</p>
              <div className="flex justify-end">
                <button
                  onClick={handleAddTable}
                  disabled={!tableDraft.name.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  Créer
                </button>
              </div>
            </div>
          )}

          {(campaign.random_tables ?? []).length > 0 ? (
            <div className="space-y-3">
              {(campaign.random_tables ?? []).map((table, tIdx) => (
                <div key={tIdx} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-white text-sm font-medium truncate">{table.name}</span>
                      <span className="text-stone-600 text-xs shrink-0">{table.entries.length} entrée{table.entries.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tableResults[tIdx] && (
                        <span className="text-amber-300 text-xs max-w-[180px] truncate italic">→ {tableResults[tIdx]}</span>
                      )}
                      <button
                        onClick={() => handleRollTable(tIdx, table)}
                        disabled={table.entries.length === 0}
                        className="bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold rounded-lg px-3 py-1.5 transition-colors disabled:opacity-30"
                      >
                        🎲 Lancer
                      </button>
                      <button
                        onClick={() => setEditingTableIdx(editingTableIdx === tIdx ? null : tIdx)}
                        className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                      >
                        {editingTableIdx === tIdx ? 'Fermer' : 'Éditer'}
                      </button>
                      <button
                        onClick={() => handleDeleteTable(tIdx)}
                        className="text-stone-600 hover:text-red-400 text-lg leading-none transition-colors"
                      >×</button>
                    </div>
                  </div>
                  {editingTableIdx === tIdx && (
                    <div className="border-t border-stone-800 px-4 pb-4 pt-3 space-y-2">
                      {table.entries.map((entry, eIdx) => (
                        <div key={eIdx} className="flex items-center gap-2 text-sm">
                          <span className="text-stone-600 text-xs w-6 text-right shrink-0">{entry.weight}</span>
                          <span className="text-stone-300 flex-1">{entry.text}</span>
                          <button
                            onClick={() => handleDeleteTableEntry(tIdx, eIdx)}
                            className="text-stone-600 hover:text-red-400 text-sm transition-colors shrink-0"
                          >×</button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          value={entryDraft.weight}
                          onChange={e => setEntryDraft(d => ({ ...d, weight: Math.max(1, Number(e.target.value)) }))}
                          min={1}
                          title="Poids (fréquence relative)"
                          className="w-14 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-200 text-sm text-center focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <input
                          type="text"
                          value={entryDraft.text}
                          onChange={e => setEntryDraft(d => ({ ...d, text: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter' && entryDraft.text.trim()) handleAddTableEntry(tIdx) }}
                          placeholder="Nouvelle entrée…"
                          className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <button
                          onClick={() => handleAddTableEntry(tIdx)}
                          disabled={!entryDraft.text.trim()}
                          className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
                        >
                          + Ajouter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !addingTable && (
              <p className="text-stone-600 text-sm text-center py-4">Aucune table. Créez des tables de météo, d'événements ou de noms pour improviser.</p>
            )
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
