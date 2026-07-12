import { useEffect, useState, lazy, Suspense } from 'react'

// Chargé paresseusement : la section Monde (1 400 lignes) n'est téléchargée que si
// on l'ouvre, au lieu de peser sur chaque visite de la campagne.
const CampaignWorldSection = lazy(() => import('./campaign/CampaignWorldSection'))
const CampaignSessionSection = lazy(() => import('./campaign/CampaignSessionSection'))
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
  type PrepScene,
  type CustomMonster,
  type Faction,
  type RandomTable,
  type CampaignMap,
  type Milestone,
  type Quest,
  type MonsterAttack,
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
import { createCombatant } from '../api/combatants'
import { useAuth } from '../contexts/AuthContext'
import { createEcho, REALTIME_CONFIGURED } from '../lib/echo'
import { archiveFilename, buildCampaignZip, parseCampaignArchive, ArchiveError } from '../lib/campaignArchive'
import { ZipError } from '../lib/zip'
import { MarkdownText } from '../components/MarkdownText'
import { MicButton } from '../components/MicButton'
import { useToast } from '../contexts/ToastContext'
import { computeEncounterDifficulty, difficultyColor } from '../data/encounter_difficulty'
import { CR_XP } from '../data/monsters'

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
  const emptyQuestDraft = (): Omit<Quest, 'id'> => ({ title: '', description: '', status: 'active', giver: '', notes: '' })
  const [questDraft, setQuestDraft] = useState<Omit<Quest, 'id'>>(emptyQuestDraft())
  const [addingQuest, setAddingQuest] = useState(false)
  const [expandedQuest, setExpandedQuest] = useState<string | null>(null)
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null)
  const [editQuestDraft, setEditQuestDraft] = useState<Omit<Quest, 'id'>>(emptyQuestDraft())
  const [questStatusFilter, setQuestStatusFilter] = useState<'all' | Quest['status']>('all')
  const [questSearch, setQuestSearch] = useState('')
  const [questSort, setQuestSort] = useState<'default' | 'title' | 'giver'>('default')

  // Trésor partagé

  // Lieux

  // Préparation de session
  const emptySessionPrep = (): SessionPrep => ({ title: '', date: '', notes: '', npc_names: [], location_names: [], encounter_names: [], scenes: [] })
  const [sessionPrepDraft, setSessionPrepDraft] = useState<SessionPrep>(emptySessionPrep())
  const [editingSessionPrep, setEditingSessionPrep] = useState(false)
  const [hasSessionPrep, setHasSessionPrep] = useState(false)
  const [savingSessionPrep, setSavingSessionPrep] = useState(false)

  // Bestiaire personnalisé
  const emptyMonsterDraft = (): CustomMonster => ({ name: '', cr: '1', ac: 12, hp_avg: 10, initiative_mod: 0, xp: 200, speed: undefined, attacks: [] })
  const emptyAttackDraft = (): MonsterAttack => ({ name: '', bonus: '', damage: '' })
  const [monsterDraft, setMonsterDraft] = useState<CustomMonster>(emptyMonsterDraft())
  const [addingMonster, setAddingMonster] = useState(false)
  const [attackDraft, setAttackDraft] = useState<MonsterAttack>(emptyAttackDraft())
  const [editingMonsterIdx, setEditingMonsterIdx] = useState<number | null>(null)
  const [editMonsterDraft, setEditMonsterDraft] = useState<CustomMonster>(emptyMonsterDraft())
  const [editAttackDraft, setEditAttackDraft] = useState<MonsterAttack>(emptyAttackDraft())
  const [combatMonsterIdx, setCombatMonsterIdx] = useState<number | null>(null)
  const [combatMonsterCount, setCombatMonsterCount] = useState(1)
  const [monsterSearch, setMonsterSearch] = useState('')
  const [monsterCrFilter, setMonsterCrFilter] = useState<'all' | 'low' | 'mid' | 'high'>('all')
  const [monsterSort, setMonsterSort] = useState<'name' | 'cr' | 'xp' | 'hp'>('name')

  // Factions

  // Générateur de PNJ

  // XP

  // Tables aléatoires

  // Scènes de préparation
  const emptyScene = (): PrepScene => ({
    id: uuid(),
    title: '', location_name: '', npc_names: [], encounter_name: '',
    treasure: '', hook: '', notes: '', done: false,
  })
  const [sceneDraft, setSceneDraft] = useState<PrepScene>(emptyScene())
  const [addingScene, setAddingScene] = useState(false)
  const [expandedScene, setExpandedScene] = useState<string | null>(null)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneSearch, setSceneSearch] = useState('')
  const [sceneStatusFilter, setSceneStatusFilter] = useState<'all' | 'todo' | 'done'>('all')
  const [editSceneDraft, setEditSceneDraft] = useState<PrepScene>(emptyScene())

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

  async function handleAddQuest() {
    if (!campaign || !questDraft.title.trim()) return
    const quest: Quest = { id: uuid(), ...questDraft, title: questDraft.title.trim() }
    const next = [...(campaign.quests ?? []), quest]
    const updated = await updateCampaign(campaign.id, { quests: next })
    setCampaign(updated)
    setQuestDraft(emptyQuestDraft())
    setAddingQuest(false)
    setExpandedQuest(quest.id)
  }

  async function handleUpdateQuest(questId: string) {
    if (!campaign) return
    const next = (campaign.quests ?? []).map(q =>
      q.id === questId ? { ...q, ...editQuestDraft, title: editQuestDraft.title.trim() } : q
    )
    const updated = await updateCampaign(campaign.id, { quests: next })
    setCampaign(updated)
    setEditingQuestId(null)
  }

  async function handleDeleteQuest(questId: string) {
    if (!campaign) return
    const next = (campaign.quests ?? []).filter(q => q.id !== questId)
    const updated = await updateCampaign(campaign.id, { quests: next })
    setCampaign(updated)
    if (expandedQuest === questId) setExpandedQuest(null)
  }

  async function handleToggleQuestStatus(questId: string, status: Quest['status']) {
    if (!campaign) return
    const next = (campaign.quests ?? []).map(q => q.id === questId ? { ...q, status } : q)
    const updated = await updateCampaign(campaign.id, { quests: next })
    setCampaign(updated)
  }

  async function handleDuplicateQuest(questId: string) {
    if (!campaign) return
    const src = (campaign.quests ?? []).find(q => q.id === questId)
    if (!src) return
    const copy: Quest = { ...src, id: uuid(), title: `${src.title} (copie)` }
    const next = [...(campaign.quests ?? []), copy]
    const updated = await updateCampaign(campaign.id, { quests: next })
    setCampaign(updated)
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

  function handleExportSessionPrepMarkdown() {
    if (!campaign?.session_prep) return
    const prep = campaign.session_prep
    const lines: string[] = []
    lines.push(`# Préparation — ${prep.title || 'Session sans titre'}`)
    if (prep.date) lines.push(`**Date prévue :** ${prep.date}`)
    lines.push('')
    if (prep.npc_names.length > 0) {
      lines.push('## PNJ impliqués')
      prep.npc_names.forEach(n => lines.push(`- ${n}`))
      lines.push('')
    }
    if (prep.location_names.length > 0) {
      lines.push('## Lieux à visiter')
      prep.location_names.forEach(l => lines.push(`- ${l}`))
      lines.push('')
    }
    if (prep.encounter_names.length > 0) {
      lines.push('## Rencontres planifiées')
      prep.encounter_names.forEach(e => lines.push(`- ${e}`))
      lines.push('')
    }
    if ((prep.scenes ?? []).length > 0) {
      lines.push('## Scènes')
      prep.scenes.forEach((s, idx) => {
        lines.push(`### ${idx + 1}. ${s.title}${s.done ? ' ✓' : ''}`)
        if (s.location_name) lines.push(`**Lieu :** ${s.location_name}`)
        if (s.encounter_name) lines.push(`**Rencontre :** ${s.encounter_name}`)
        if (s.hook) lines.push(`**Accroche :** ${s.hook}`)
        if (s.treasure) lines.push(`**Trésor :** ${s.treasure}`)
        if (s.notes) { lines.push(''); lines.push(s.notes) }
        lines.push('')
      })
    }
    if (prep.notes) {
      lines.push('## Notes de préparation')
      lines.push(prep.notes)
      lines.push('')
    }
    const md = lines.join('\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filename = (prep.title || 'session').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '')
    a.download = `prep_${filename || 'session'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleClearSessionPrep() {
    if (!campaign) return
    const updated = await updateCampaign(campaign.id, { session_prep: null })
    setCampaign(updated)
    setSessionPrepDraft(emptySessionPrep())
    setHasSessionPrep(false)
    setEditingSessionPrep(false)
  }




















  async function handleAddScene() {
    if (!campaign || !sceneDraft.title.trim()) return
    const prep = campaign.session_prep ?? emptySessionPrep()
    const next: SessionPrep = {
      ...prep,
      scenes: [...(prep.scenes ?? []), { ...sceneDraft, id: uuid(), title: sceneDraft.title.trim() }],
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

  async function handleMoveScene(sceneId: string, dir: -1 | 1) {
    if (!campaign?.session_prep) return
    const scenes = [...campaign.session_prep.scenes]
    const idx = scenes.findIndex(s => s.id === sceneId)
    if (idx < 0) return
    const target = idx + dir
    if (target < 0 || target >= scenes.length) return
    ;[scenes[idx], scenes[target]] = [scenes[target], scenes[idx]]
    const next: SessionPrep = { ...campaign.session_prep, scenes }
    const updated = await updateCampaign(campaign.id, { session_prep: next })
    setCampaign(updated)
    if (updated.session_prep) setSessionPrepDraft(updated.session_prep)
  }

  async function handleDuplicateScene(sceneId: string) {
    if (!campaign?.session_prep) return
    const src = campaign.session_prep.scenes.find(s => s.id === sceneId)
    if (!src) return
    const copy = { ...src, id: uuid(), title: `${src.title} (copie)`, done: false }
    const next: SessionPrep = { ...campaign.session_prep, scenes: [...campaign.session_prep.scenes, copy] }
    const updated = await updateCampaign(campaign.id, { session_prep: next })
    setCampaign(updated)
    if (updated.session_prep) setSessionPrepDraft(updated.session_prep)
  }

  async function handleUpdateScene(sceneId: string) {
    if (!campaign?.session_prep || !editSceneDraft.title.trim()) return
    const next: SessionPrep = {
      ...campaign.session_prep,
      scenes: (campaign.session_prep.scenes ?? []).map(s =>
        s.id === sceneId ? { ...editSceneDraft, id: sceneId, title: editSceneDraft.title.trim() } : s
      ),
    }
    const updated = await updateCampaign(campaign.id, { session_prep: next })
    setCampaign(updated)
    if (updated.session_prep) setSessionPrepDraft(updated.session_prep)
    setEditingSceneId(null)
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
    if (editingMonsterIdx === index) setEditingMonsterIdx(null)
  }

  async function handleAddMonsterToCombat(m: CustomMonster, count: number) {
    if (!campaign) return
    await Promise.all(
      Array.from({ length: count }, (_, idx) =>
        createCombatant(campaign.id, {
          name: count > 1 ? `${m.name} ${idx + 1}` : m.name,
          max_hp: m.hp_avg,
          armor_class: m.ac,
        })
      )
    )
    setCombatMonsterIdx(null)
  }

  async function handleDuplicateMonster(index: number) {
    if (!campaign) return
    const src = (campaign.custom_monsters ?? [])[index]
    if (!src) return
    const copy = { ...src, name: `${src.name} (copie)`, attacks: [...(src.attacks ?? [])] }
    const next = [...(campaign.custom_monsters ?? []), copy]
    const updated = await updateCampaign(campaign.id, { custom_monsters: next })
    setCampaign(updated)
  }


  async function handleUpdateCustomMonster(index: number) {
    if (!campaign || !editMonsterDraft.name.trim()) return
    const xp = CR_XP[editMonsterDraft.cr] ?? 0
    const next = (campaign.custom_monsters ?? []).map((m, i) => i === index ? { ...editMonsterDraft, name: editMonsterDraft.name.trim(), xp } : m)
    const updated = await updateCampaign(campaign.id, { custom_monsters: next })
    setCampaign(updated)
    setEditingMonsterIdx(null)
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




        {activeTab === 'aventure' && <>
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
              {hasSessionPrep && !editingSessionPrep && (
                <button onClick={handleExportSessionPrepMarkdown} className="text-stone-500 hover:text-stone-300 text-xs transition-colors" title="Exporter en Markdown">↓ MD</button>
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
                {editingSessionPrep ? (
                  <textarea
                    placeholder="Objectifs de la session, secrets à révéler, rebondissements…"
                    value={sessionPrepDraft.notes}
                    onChange={e => setSessionPrepDraft(d => ({ ...d, notes: e.target.value }))}
                    rows={4}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors resize-y"
                  />
                ) : sessionPrepDraft.notes ? (
                  <div className="bg-stone-800/50 border border-stone-700/50 rounded-lg px-3 py-2">
                    <MarkdownText className="text-stone-300 text-sm">{sessionPrepDraft.notes}</MarkdownText>
                  </div>
                ) : (
                  <p className="text-stone-600 text-xs italic">Aucune note.</p>
                )}
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

                  {(campaign.session_prep?.scenes ?? []).length > 2 && (
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={sceneSearch}
                        onChange={e => setSceneSearch(e.target.value)}
                        placeholder="Rechercher une scène…"
                        className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-600 transition-colors"
                      />
                      <div className="flex gap-1">
                        {(['all', 'todo', 'done'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => setSceneStatusFilter(f)}
                            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${sceneStatusFilter === f ? 'bg-sky-900/60 border-sky-700 text-sky-300' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}
                          >
                            {f === 'all' ? 'Toutes' : f === 'todo' ? 'À faire' : '✓ Faites'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(campaign.session_prep?.scenes ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(campaign.session_prep!.scenes).filter(s =>
                        (sceneStatusFilter === 'all' || (sceneStatusFilter === 'done' ? s.done : !s.done)) &&
                        (!sceneSearch || s.title.toLowerCase().includes(sceneSearch.toLowerCase()) || (s.location_name ?? '').toLowerCase().includes(sceneSearch.toLowerCase()) || (s.notes ?? '').toLowerCase().includes(sceneSearch.toLowerCase()))
                      ).map((scene, sceneIdx) => (
                        <div key={scene.id} className={`border rounded-lg overflow-hidden transition-colors ${scene.done ? 'border-stone-800 opacity-60' : 'border-sky-800/40'}`}>
                          {editingSceneId === scene.id ? (
                            <div className="px-3 py-3 space-y-2">
                              <input
                                type="text"
                                value={editSceneDraft.title}
                                onChange={e => setEditSceneDraft(d => ({ ...d, title: e.target.value }))}
                                autoFocus
                                placeholder="Titre *"
                                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input type="text" value={editSceneDraft.location_name} onChange={e => setEditSceneDraft(d => ({ ...d, location_name: e.target.value }))} placeholder="Lieu" className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                                <input type="text" value={editSceneDraft.encounter_name} onChange={e => setEditSceneDraft(d => ({ ...d, encounter_name: e.target.value }))} placeholder="Rencontre liée" className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                                <input type="text" value={editSceneDraft.hook} onChange={e => setEditSceneDraft(d => ({ ...d, hook: e.target.value }))} placeholder="Accroche / déclencheur" className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                                <input type="text" value={editSceneDraft.treasure} onChange={e => setEditSceneDraft(d => ({ ...d, treasure: e.target.value }))} placeholder="Trésor / récompense" className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                              </div>
                              <textarea value={editSceneDraft.notes} onChange={e => setEditSceneDraft(d => ({ ...d, notes: e.target.value }))} placeholder="Notes…" rows={2} className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors resize-none" />
                              <div className="flex justify-between items-center">
                                <button onClick={() => setEditingSceneId(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                                <button onClick={() => handleUpdateScene(scene.id)} disabled={!editSceneDraft.title.trim()} className="text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors disabled:opacity-40">Enregistrer</button>
                              </div>
                            </div>
                          ) : (
                            <>
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
                                {!sceneSearch && sceneStatusFilter === 'all' && sceneIdx > 0 && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleMoveScene(scene.id, -1) }}
                                    className="text-stone-700 hover:text-stone-400 text-xs leading-none shrink-0 transition-colors"
                                    title="Monter"
                                  >↑</button>
                                )}
                                {!sceneSearch && sceneStatusFilter === 'all' && sceneIdx < (campaign.session_prep!.scenes.length - 1) && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleMoveScene(scene.id, 1) }}
                                    className="text-stone-700 hover:text-stone-400 text-xs leading-none shrink-0 transition-colors"
                                    title="Descendre"
                                  >↓</button>
                                )}
                                <button
                                  onClick={e => { e.stopPropagation(); handleDuplicateScene(scene.id) }}
                                  className="text-stone-600 hover:text-sky-400 text-xs leading-none shrink-0 transition-colors"
                                  title="Dupliquer"
                                >⎘</button>
                                <button
                                  onClick={e => { e.stopPropagation(); setEditingSceneId(scene.id); setEditSceneDraft({ ...scene }); setExpandedScene(null) }}
                                  className="text-stone-600 hover:text-sky-400 text-sm leading-none shrink-0 transition-colors"
                                  title="Modifier"
                                >✎</button>
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
                                  {scene.notes && <MarkdownText className="text-stone-300 mt-1">{scene.notes}</MarkdownText>}
                                </div>
                              )}
                            </>
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

        </>}


        {activeTab === 'aventure' && <>
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
                <div>
                  <label className="text-stone-500 text-xs block mb-1">Vitesse (m)</label>
                  <input
                    type="number"
                    value={monsterDraft.speed ?? ''}
                    onChange={e => setMonsterDraft(d => ({ ...d, speed: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="9"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-stone-500 text-xs block mb-1">Notes</label>
                  <input
                    type="text"
                    value={monsterDraft.notes ?? ''}
                    onChange={e => setMonsterDraft(d => ({ ...d, notes: e.target.value }))}
                    placeholder="Résistances, traits…"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
              {/* Attaques */}
              <div>
                <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-2">Attaques</p>
                {(monsterDraft.attacks ?? []).map((atk, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5 bg-stone-800/60 rounded-lg px-3 py-1.5">
                    <span className="text-stone-200 text-sm flex-1 truncate">{atk.name}</span>
                    <span className="text-amber-300 text-xs font-mono">{atk.bonus}</span>
                    <span className="text-stone-500 text-xs">→</span>
                    <span className="text-red-300 text-xs font-mono">{atk.damage}</span>
                    <button onClick={() => setMonsterDraft(d => ({ ...d, attacks: (d.attacks ?? []).filter((_, j) => j !== i) }))} className="text-stone-600 hover:text-red-400 text-sm transition-colors">×</button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <input type="text" placeholder="Nom (ex. Épée)" value={attackDraft.name} onChange={e => setAttackDraft(d => ({ ...d, name: e.target.value }))}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                  <input type="text" placeholder="+5 au toucher" value={attackDraft.bonus} onChange={e => setAttackDraft(d => ({ ...d, bonus: e.target.value }))}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                  <input type="text" placeholder="1d6+3 tranchant" value={attackDraft.damage} onChange={e => setAttackDraft(d => ({ ...d, damage: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && attackDraft.name.trim() && attackDraft.damage.trim()) {
                        setMonsterDraft(d => ({ ...d, attacks: [...(d.attacks ?? []), { ...attackDraft }] }))
                        setAttackDraft(emptyAttackDraft())
                      }
                    }}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
                {attackDraft.name.trim() && attackDraft.damage.trim() && (
                  <button
                    onClick={() => { setMonsterDraft(d => ({ ...d, attacks: [...(d.attacks ?? []), { ...attackDraft }] })); setAttackDraft(emptyAttackDraft()) }}
                    className="text-amber-400 hover:text-amber-300 text-xs transition-colors mt-1"
                  >+ Ajouter attaque</button>
                )}
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

          {(campaign.custom_monsters ?? []).length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={monsterSearch}
                  onChange={e => setMonsterSearch(e.target.value)}
                  placeholder="Rechercher un monstre…"
                  className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
                <select
                  value={monsterSort}
                  onChange={e => setMonsterSort(e.target.value as typeof monsterSort)}
                  className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-stone-600 transition-colors"
                >
                  <option value="name">Nom A→Z</option>
                  <option value="cr">CR ↑</option>
                  <option value="xp">XP ↑</option>
                  <option value="hp">PV ↑</option>
                </select>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'low', 'mid', 'high'] as const).map(f => {
                  const labels = { all: 'Tous', low: 'CR 0–4', mid: 'CR 5–10', high: 'CR 11+' }
                  return (
                    <button key={f} onClick={() => setMonsterCrFilter(f)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${monsterCrFilter === f ? 'bg-rose-900/60 border-rose-700 text-rose-300' : 'bg-stone-900 border-stone-700 text-stone-500 hover:text-stone-300'}`}>
                      {labels[f]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {(campaign.custom_monsters ?? []).length > 0 ? (() => {
            const crNum = (cr: string) => cr === '1/8' ? 0.125 : cr === '1/4' ? 0.25 : cr === '1/2' ? 0.5 : parseFloat(cr) || 0
            const filtered = (campaign.custom_monsters ?? [])
              .map((m, i) => ({ m, i }))
              .filter(({ m }) => {
                if (monsterSearch && !m.name.toLowerCase().includes(monsterSearch.toLowerCase())) return false
                if (monsterCrFilter === 'low' && crNum(m.cr) > 4) return false
                if (monsterCrFilter === 'mid' && (crNum(m.cr) < 5 || crNum(m.cr) > 10)) return false
                if (monsterCrFilter === 'high' && crNum(m.cr) < 11) return false
                return true
              })
              .sort((a, b) => {
                if (monsterSort === 'cr') return crNum(a.m.cr) - crNum(b.m.cr)
                if (monsterSort === 'xp') return (a.m.xp ?? 0) - (b.m.xp ?? 0)
                if (monsterSort === 'hp') return (a.m.hp_avg ?? 0) - (b.m.hp_avg ?? 0)
                return a.m.name.localeCompare(b.m.name, 'fr')
              })
            if (filtered.length === 0) return (
              <p className="text-stone-600 text-sm text-center py-6">Aucun monstre ne correspond aux filtres.</p>
            )
            return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(({ m, i }) => (
                <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                  {editingMonsterIdx === i ? (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input autoFocus type="text" placeholder="Nom *" value={editMonsterDraft.name} onChange={e => setEditMonsterDraft(d => ({ ...d, name: e.target.value }))}
                          className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                        <select value={editMonsterDraft.cr} onChange={e => setEditMonsterDraft(d => ({ ...d, cr: e.target.value }))}
                          className="bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-rose-500">
                          {['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20'].map(cr => <option key={cr} value={cr}>CR {cr}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div><label className="text-stone-600 text-[10px] block mb-0.5">CA</label><input type="number" value={editMonsterDraft.ac} onChange={e => setEditMonsterDraft(d => ({ ...d, ac: +e.target.value }))} className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                        <div><label className="text-stone-600 text-[10px] block mb-0.5">PV moy.</label><input type="number" value={editMonsterDraft.hp_avg} onChange={e => setEditMonsterDraft(d => ({ ...d, hp_avg: +e.target.value }))} className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                        <div><label className="text-stone-600 text-[10px] block mb-0.5">Init. mod</label><input type="number" value={editMonsterDraft.initiative_mod} onChange={e => setEditMonsterDraft(d => ({ ...d, initiative_mod: +e.target.value }))} className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                        <div><label className="text-stone-600 text-[10px] block mb-0.5">Vitesse</label><input type="number" value={editMonsterDraft.speed ?? ''} onChange={e => setEditMonsterDraft(d => ({ ...d, speed: e.target.value ? +e.target.value : undefined }))} placeholder="—" className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                      </div>
                      <input type="text" placeholder="Notes (immunités, capacités…)" value={editMonsterDraft.notes ?? ''} onChange={e => setEditMonsterDraft(d => ({ ...d, notes: e.target.value }))}
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                      <div>
                        <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-2">Attaques</p>
                        {(editMonsterDraft.attacks ?? []).map((atk, ai) => (
                          <div key={ai} className="flex items-center gap-2 mb-1.5 bg-stone-800/60 rounded-lg px-3 py-1.5">
                            <span className="text-stone-200 text-sm flex-1 truncate">{atk.name}</span>
                            <span className="text-amber-300 text-xs font-mono">{atk.bonus}</span>
                            <span className="text-stone-500 text-xs">→</span>
                            <span className="text-red-300 text-xs font-mono">{atk.damage}</span>
                            <button onClick={() => setEditMonsterDraft(d => ({ ...d, attacks: (d.attacks ?? []).filter((_, j) => j !== ai) }))} className="text-stone-600 hover:text-red-400 text-sm transition-colors">×</button>
                          </div>
                        ))}
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          <input type="text" placeholder="Nom" value={editAttackDraft.name} onChange={e => setEditAttackDraft(d => ({ ...d, name: e.target.value }))} className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                          <input type="text" placeholder="+5 au toucher" value={editAttackDraft.bonus} onChange={e => setEditAttackDraft(d => ({ ...d, bonus: e.target.value }))} className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                          <input type="text" placeholder="1d6+3" value={editAttackDraft.damage} onChange={e => setEditAttackDraft(d => ({ ...d, damage: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter' && editAttackDraft.name.trim() && editAttackDraft.damage.trim()) { setEditMonsterDraft(d => ({ ...d, attacks: [...(d.attacks ?? []), { ...editAttackDraft }] })); setEditAttackDraft(emptyAttackDraft()) } }}
                            className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-rose-500" />
                        </div>
                        {editAttackDraft.name.trim() && editAttackDraft.damage.trim() && (
                          <button onClick={() => { setEditMonsterDraft(d => ({ ...d, attacks: [...(d.attacks ?? []), { ...editAttackDraft }] })); setEditAttackDraft(emptyAttackDraft()) }} className="text-rose-400 hover:text-rose-300 text-xs mt-1 transition-colors">+ Ajouter l'attaque</button>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingMonsterIdx(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                        <button onClick={() => handleUpdateCustomMonster(i)} disabled={!editMonsterDraft.name.trim()} className="bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors">Sauvegarder</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium">{m.name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          <span className="text-stone-500 text-xs">CR {m.cr}</span>
                          <span className="text-stone-500 text-xs">CA {m.ac}</span>
                          <span className="text-stone-500 text-xs">{m.hp_avg} PV</span>
                          <span className="text-stone-500 text-xs">Init {m.initiative_mod >= 0 ? '+' : ''}{m.initiative_mod}</span>
                          <span className="text-amber-600/80 text-xs">{m.xp} XP</span>
                        </div>
                        {m.speed != null && <span className="text-stone-500 text-xs">Vit. {m.speed} m</span>}
                        {m.notes && <p className="text-stone-500 text-xs mt-1 italic">{m.notes}</p>}
                        {(m.attacks ?? []).length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {(m.attacks ?? []).map((atk, ai) => (
                              <p key={ai} className="text-xs text-stone-400">
                                <span className="font-medium">{atk.name}</span>
                                {' '}<span className="text-amber-500/80">{atk.bonus}</span>
                                {' → '}<span className="text-red-400/80">{atk.damage}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {combatMonsterIdx === i ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={combatMonsterCount}
                              onChange={e => setCombatMonsterCount(Math.max(1, Math.min(9, parseInt(e.target.value) || 1)))}
                              min={1} max={9}
                              className="w-10 bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-white text-xs text-center focus:outline-none focus:border-amber-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleAddMonsterToCombat(m, combatMonsterCount)}
                              className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
                            >⚔</button>
                            <button onClick={() => setCombatMonsterIdx(null)} className="text-stone-600 hover:text-stone-400 text-xs transition-colors">✕</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setCombatMonsterIdx(i); setCombatMonsterCount(1) }}
                            className="text-stone-600 hover:text-amber-400 text-xs transition-colors"
                            title="Ajouter au combat"
                          >⚔</button>
                        )}
                        <button onClick={() => handleDuplicateMonster(i)} className="text-stone-600 hover:text-sky-400 text-xs transition-colors" title="Dupliquer">⎘</button>
                        <button onClick={() => { setEditMonsterDraft({ ...m, attacks: [...(m.attacks ?? [])] }); setEditAttackDraft(emptyAttackDraft()); setEditingMonsterIdx(i) }} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Modifier">✎</button>
                        <button onClick={() => handleDeleteCustomMonster(i)} className="text-stone-600 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )
          })() : (
            !addingMonster && (
              <p className="text-stone-600 text-sm text-center py-4">Aucun monstre personnalisé. Créez-en pour les utiliser dans les rencontres.</p>
            )
          )}
        </div>

        </>}


        {activeTab === 'aventure' && <>
        {/* Quêtes */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Quêtes ({(campaign.quests ?? []).length})
            </h2>
            <div className="flex items-center gap-3">
              {(campaign.quests ?? []).length > 0 && (
                <button onClick={() => exportSection('quetes', campaign.quests ?? [])} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Exporter les quêtes">⬇ Export</button>
              )}
              <label className="text-stone-600 hover:text-stone-400 text-xs transition-colors cursor-pointer" title="Importer des quêtes">
                ⬆ Import<input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importSectionData(f, 'quests'); e.target.value = '' }} />
              </label>
              <button
                onClick={() => { setAddingQuest(v => !v); setQuestDraft(emptyQuestDraft()) }}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors"
              >
                {addingQuest ? 'Annuler' : '+ Quête'}
              </button>
            </div>
          </div>

          {addingQuest && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 mb-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Titre de la quête *"
                  value={questDraft.title}
                  onChange={e => setQuestDraft(d => ({ ...d, title: e.target.value }))}
                  autoFocus
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <select
                  value={questDraft.status}
                  onChange={e => setQuestDraft(d => ({ ...d, status: e.target.value as Quest['status'] }))}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="active">🟡 Active</option>
                  <option value="dormant">⚪ En attente</option>
                  <option value="completed">🟢 Terminée</option>
                  <option value="failed">🔴 Échouée</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Donneur de quête (PNJ, faction…)"
                value={questDraft.giver}
                onChange={e => setQuestDraft(d => ({ ...d, giver: e.target.value }))}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-stone-600 text-xs">Description</span>
                  <MicButton onTranscript={text => setQuestDraft(d => ({ ...d, description: d.description ? d.description + '\n' + text : text }))} />
                </div>
                <textarea
                  placeholder="Description de la quête…"
                  value={questDraft.description}
                  onChange={e => setQuestDraft(d => ({ ...d, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleAddQuest}
                  disabled={!questDraft.title.trim()}
                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {(campaign.quests ?? []).length > 1 && (
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={questSearch}
                onChange={e => setQuestSearch(e.target.value)}
                placeholder="Rechercher une quête…"
                className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
              />
              <select
                value={questSort}
                onChange={e => setQuestSort(e.target.value as typeof questSort)}
                className="bg-stone-900 border border-stone-800 rounded-lg px-2 py-1.5 text-stone-300 text-sm focus:outline-none focus:border-stone-600 transition-colors"
              >
                <option value="default">Défaut</option>
                <option value="title">Titre A→Z</option>
                <option value="giver">Donneur</option>
              </select>
            </div>
          )}

          {(campaign.quests ?? []).length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(['all', 'active', 'dormant', 'completed', 'failed'] as const).map(s => {
                const count = s === 'all'
                  ? (campaign.quests ?? []).length
                  : (campaign.quests ?? []).filter(q => q.status === s).length
                if (s !== 'all' && count === 0) return null
                const icons: Record<string, string> = { all: '', active: '🟡', dormant: '⚪', completed: '🟢', failed: '🔴' }
                const labels: Record<string, string> = { all: 'Toutes', active: 'Actives', dormant: 'En attente', completed: 'Terminées', failed: 'Échouées' }
                return (
                  <button
                    key={s}
                    onClick={() => setQuestStatusFilter(s)}
                    className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                      questStatusFilter === s
                        ? 'bg-amber-900/60 border-amber-600/60 text-amber-300'
                        : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                    }`}
                  >
                    {icons[s] ? `${icons[s]} ` : ''}{labels[s]} ({count})
                  </button>
                )
              })}
            </div>
          )}

          {(campaign.quests ?? []).length > 0 ? (
            <div className="space-y-2">
              {(['active', 'dormant', 'completed', 'failed'] as Quest['status'][]).map(status => {
                if (questStatusFilter !== 'all' && questStatusFilter !== status) return null
                const quests = (campaign.quests ?? [])
                  .filter(q => q.status === status && (!questSearch || q.title.toLowerCase().includes(questSearch.toLowerCase()) || (q.giver ?? '').toLowerCase().includes(questSearch.toLowerCase())))
                  .sort((a, b) => questSort === 'title' ? a.title.localeCompare(b.title, 'fr') : questSort === 'giver' ? (a.giver ?? '').localeCompare(b.giver ?? '', 'fr') : 0)
                if (quests.length === 0) return null
                const statusLabel: Record<Quest['status'], string> = { active: '🟡 Actives', dormant: '⚪ En attente', completed: '🟢 Terminées', failed: '🔴 Échouées' }
                return (
                  <div key={status}>
                    <p className="text-stone-600 text-xs font-medium mb-1.5 mt-3 first:mt-0">{statusLabel[status]}</p>
                    <div className="space-y-1.5">
                      {quests.map(quest => (
                        <div key={quest.id} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                          {editingQuestId === quest.id ? (
                            <div className="p-4 space-y-3">
                              <div className="flex gap-3">
                                <input
                                  type="text"
                                  value={editQuestDraft.title}
                                  onChange={e => setEditQuestDraft(d => ({ ...d, title: e.target.value }))}
                                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                                />
                                <select
                                  value={editQuestDraft.status}
                                  onChange={e => setEditQuestDraft(d => ({ ...d, status: e.target.value as Quest['status'] }))}
                                  className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                                >
                                  <option value="active">🟡 Active</option>
                                  <option value="dormant">⚪ En attente</option>
                                  <option value="completed">🟢 Terminée</option>
                                  <option value="failed">🔴 Échouée</option>
                                </select>
                              </div>
                              <input
                                type="text"
                                placeholder="Donneur de quête"
                                value={editQuestDraft.giver}
                                onChange={e => setEditQuestDraft(d => ({ ...d, giver: e.target.value }))}
                                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                              />
                              <textarea
                                placeholder="Description…"
                                value={editQuestDraft.description}
                                onChange={e => setEditQuestDraft(d => ({ ...d, description: e.target.value }))}
                                rows={3}
                                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
                              />
                              <textarea
                                placeholder="Notes privées MJ…"
                                value={editQuestDraft.notes}
                                onChange={e => setEditQuestDraft(d => ({ ...d, notes: e.target.value }))}
                                rows={2}
                                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
                              />
                              <div className="flex items-center justify-between">
                                <button onClick={() => setEditingQuestId(null)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Annuler</button>
                                <div className="flex gap-4">
                                  <button onClick={() => handleDeleteQuest(quest.id)} className="text-red-500 hover:text-red-400 text-xs transition-colors">Supprimer</button>
                                  <button onClick={() => handleUpdateQuest(quest.id)} disabled={!editQuestDraft.title.trim()} className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40">Enregistrer</button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <button
                                onClick={() => setExpandedQuest(expandedQuest === quest.id ? null : quest.id)}
                                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-800/50 transition-colors text-left group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-stone-500 text-xs" style={{ transform: expandedQuest === quest.id ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
                                    <span className="text-white text-sm font-medium truncate">{quest.title}</span>
                                    {quest.giver && (
                                      <span className="text-stone-500 text-xs shrink-0">— {quest.giver}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <select
                                    value={quest.status}
                                    onChange={e => { e.stopPropagation(); handleToggleQuestStatus(quest.id, e.target.value as Quest['status']) }}
                                    onClick={e => e.stopPropagation()}
                                    className="bg-stone-800 border border-stone-700 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                                  >
                                    <option value="active">🟡 Active</option>
                                    <option value="dormant">⚪ En attente</option>
                                    <option value="completed">🟢 Terminée</option>
                                    <option value="failed">🔴 Échouée</option>
                                  </select>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDuplicateQuest(quest.id) }}
                                    className="text-stone-600 hover:text-sky-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                                    title="Dupliquer cette quête"
                                  >⎘</button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setEditQuestDraft({ title: quest.title, description: quest.description, status: quest.status, giver: quest.giver, notes: quest.notes }); setEditingQuestId(quest.id); setExpandedQuest(null) }}
                                    className="text-stone-600 hover:text-stone-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                                  >Modifier</button>
                                </div>
                              </button>
                              {expandedQuest === quest.id && (
                                <div className="px-4 pb-4 border-t border-stone-800 pt-3 space-y-2">
                                  {(quest.description || quest.notes) && (
                                    <div className="flex justify-end">
                                      <button onClick={() => copyToClipboard(`quest-${quest.id}`, [quest.description, quest.notes].filter(Boolean).join('\n\n'))} className="text-stone-600 hover:text-stone-400 text-xs transition-colors" title="Copier">
                                        {copiedKey === `quest-${quest.id}` ? '✓ Copié' : '📋'}
                                      </button>
                                    </div>
                                  )}
                                  {quest.description && (
                                    <MarkdownText className="text-stone-300 text-sm">{quest.description}</MarkdownText>
                                  )}
                                  {quest.notes && (
                                    <MarkdownText className="text-stone-500 text-xs">{quest.notes}</MarkdownText>
                                  )}
                                  {!quest.description && !quest.notes && (
                                    <p className="text-stone-600 text-sm">Aucune description.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            !addingQuest && (
              <p className="text-stone-600 text-sm text-center py-4">Aucune quête. Ajoutez des objectifs pour suivre la progression des PJs.</p>
            )
          )}
        </div>

        </>}


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
