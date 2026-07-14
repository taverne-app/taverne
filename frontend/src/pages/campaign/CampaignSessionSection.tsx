import { useState, useMemo, useEffect } from 'react'
import { setCampaignTimeOfDay } from '../../api/campaigns'
import { TIME_OF_DAY, TIME_OF_DAY_CONFIG, type TimeOfDay } from '../../lib/timeOfDay'
import { MarkdownText } from '../../components/MarkdownText'
import { MicButton } from '../../components/MicButton'
import {
  updateCampaign,
  type SessionPrep,
  type PrepScene,
  type SceneKind,
  type RandomTable,
  type RandomTableEntry,
} from '../../api/campaigns'
import { useToast } from '../../contexts/ToastContext'
import type { SectionProps } from './shared'
import { uuid } from './shared'
import { createCombatant } from '../../api/combatants'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCampaigns } from '../../contexts/CampaignContext'
import { computeEncounterDifficulty, difficultyColor } from '../../data/encounter_difficulty'
import {
  createSession, updateSession, deleteSession, reorderSessions,
  type CampaignSession,
} from '../../api/sessions'
import CampaignJournalSection from './CampaignJournalSection'

/**
 * Section « Session » : la file des séances à venir (réordonnable), la préparation
 * de la séance sélectionnée (scènes typées), le journal des séances jouées, puis
 * calendrier, trésor de groupe, tables aléatoires, ambiance, Vue MJ et XP.
 *
 * Une séance a un cycle de vie : on la prépare, on la joue, elle passe au journal.
 * L'ordre n'est jamais un impératif — les joueurs dévient, on remonte une séance.
 */
export default function CampaignSessionSection(props: SectionProps) {
  const {
    campaign, setCampaign, characters, saving, setSaving,
    sessions, setSessions,
  } = props
  const toast = useToast()
  const navigate = useNavigate()

  const [todSaving, setTodSaving]   = useState(false)
  const [dmNotesDraft, setDmNotesDraft] = useState(campaign.dm_notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [dmNotesPreview, setDmNotesPreview] = useState(false)
  const emptyTableDraft = (): RandomTable => ({ name: '', entries: [] })
  const [tableDraft, setTableDraft] = useState<RandomTable>(emptyTableDraft())
  const [addingTable, setAddingTable] = useState(false)
  const [tableResults, setTableResults] = useState<Record<number, string>>({})
  const [editingTableIdx, setEditingTableIdx] = useState<number | null>(null)
  const [entryDraft, setEntryDraft] = useState<RandomTableEntry>({ weight: 1, text: '' })
  const [renamingTableIdx, setRenamingTableIdx] = useState<number | null>(null)
  const [renamingTableDraft, setRenamingTableDraft] = useState('')
  const [editingEntryKey, setEditingEntryKey] = useState<string | null>(null)
  const [editEntryDraft, setEditEntryDraft] = useState<RandomTableEntry>({ weight: 1, text: '' })
  const [tableSearch, setTableSearch] = useState('')
  async function handleSetTimeOfDay(value: TimeOfDay) {
    if (!campaign || todSaving) return
    setTodSaving(true)
    const tod = value === 'none' ? null : value
    setCampaign(c => c ? { ...c, time_of_day: tod } : null)
    try { await setCampaignTimeOfDay(campaign.id, tod) }
    catch {
      setCampaign(c => c ? { ...c, time_of_day: campaign.time_of_day } : null)
      toast.error("Le moment de la journée n'a pas pu être enregistré.")
    }
    finally { setTodSaving(false) }
  }
  async function handleSaveDmNotes() {
    if (!campaign) return
    setSavingNotes(true)
    try {
      const updated = await updateCampaign(campaign.id, { dm_notes: dmNotesDraft })
      setCampaign(updated)
    } finally { setSavingNotes(false) }
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
  async function handleUpdateTableEntry(tableIdx: number, entryIdx: number, entry: RandomTableEntry) {
    if (!campaign || !entry.text.trim()) { setEditingEntryKey(null); return }
    const tables = campaign.random_tables ?? []
    const next = tables.map((t, i) =>
      i === tableIdx ? { ...t, entries: t.entries.map((e, j) => j === entryIdx ? { ...entry, text: entry.text.trim() } : e) } : t
    )
    const updated = await updateCampaign(campaign.id, { random_tables: next })
    setCampaign(updated)
    setEditingEntryKey(null)
  }
  async function handleRenameTable(tableIdx: number, name: string) {
    if (!campaign || !name.trim()) { setRenamingTableIdx(null); return }
    const tables = campaign.random_tables ?? []
    const next = tables.map((t, i) => i === tableIdx ? { ...t, name: name.trim() } : t)
    const updated = await updateCampaign(campaign.id, { random_tables: next })
    setCampaign(updated)
    setRenamingTableIdx(null)
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
  async function handleDuplicateTable(index: number) {
    if (!campaign) return
    const src = (campaign.random_tables ?? [])[index]
    if (!src) return
    const copy = { ...src, name: `${src.name} (copie)`, entries: [...src.entries] }
    const next = [...(campaign.random_tables ?? []), copy]
    const updated = await updateCampaign(campaign.id, { random_tables: next })
    setCampaign(updated)
  }

  const emptySessionPrep = (): SessionPrep => ({ title: '', date: '', notes: '', npc_names: [], location_names: [], encounter_names: [], scenes: [] })

  /**
   * Une séance se prépare, puis se joue. Les séances à venir forment une file que le MJ
   * réordonne — les joueurs prennent une quête plus tôt, changent de chemin. Les séances
   * jouées tombent dans le journal, plus bas.
   */
  const upcoming = useMemo(
    () => sessions.filter(s => s.status === 'planned').sort((a, b) => a.position - b.position),
    [sessions],
  )
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const activeSession = upcoming.find(s => s.id === activeSessionId) ?? upcoming[0] ?? null

  // La navigation de gauche ouvre une séance précise : /campaigns/12/session?session=34.
  const [searchParams] = useSearchParams()
  const sessionParam = Number(searchParams.get('session')) || null
  useEffect(() => {
    if (sessionParam) setActiveSessionId(sessionParam)
  }, [sessionParam])

  // Toute écriture sur les séances doit se voir dans la navigation, qui tient sa
  // propre liste : elle la relit.
  const { reloadSessions } = useCampaigns()
  useEffect(() => { reloadSessions() }, [sessions, reloadSessions])

  /** La séance stockée, vue sous la forme SessionPrep attendue par l'éditeur de scènes. */
  const sessionToPrep = (s: CampaignSession): SessionPrep => ({
    title: s.title,
    date: s.session_date ?? '',
    notes: s.notes ?? '',
    scenes: s.prep?.scenes ?? [],
    npc_names: s.prep?.npc_names ?? [],
    location_names: s.prep?.location_names ?? [],
    encounter_names: s.prep?.encounter_names ?? [],
  })
  const activePrep: SessionPrep | null = activeSession ? sessionToPrep(activeSession) : null

  const [sessionPrepDraft, setSessionPrepDraft] = useState<SessionPrep>(emptySessionPrep())
  const [editingSessionPrep, setEditingSessionPrep] = useState(false)
  const hasSessionPrep = !!activeSession
  const [savingSessionPrep, setSavingSessionPrep] = useState(false)

  // Changer de séance recharge le brouillon d'édition.
  useEffect(() => {
    if (activeSession) setSessionPrepDraft(sessionToPrep(activeSession))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id])

  /** Écrit la prep de la séance active. Point de passage unique de tous les gestes de scène. */
  async function savePrep(next: SessionPrep) {
    if (!activeSession) return
    const updated = await updateSession(campaign.id, activeSession.id, {
      title: next.title || activeSession.title,
      session_date: next.date || null,
      notes: next.notes || null,
      prep: {
        scenes: next.scenes ?? [],
        npc_names: next.npc_names ?? [],
        location_names: next.location_names ?? [],
        encounter_names: next.encounter_names ?? [],
      },
    })
    setSessions(prev => prev.map(s => (s.id === updated.id ? updated : s)))
    setSessionPrepDraft(sessionToPrep(updated))
  }
  const emptyScene = (): PrepScene => ({
    id: uuid(),
    kind: 'event',
    title: '', location_name: '', npc_names: [], encounter_name: '',
    treasure: '', hook: '', notes: '', done: false,
  })

  /**
   * Palette des scènes. Une scène sans type vient d'avant leur introduction :
   * elle est traitée comme un événement.
   */
  const SCENE_KINDS: Record<SceneKind, { icon: string; label: string; color: string }> = {
    combat:      { icon: '⚔',  label: 'Combat',      color: 'text-red-400 border-red-700/50 bg-red-950/30' },
    event:       { icon: '🎭', label: 'Événement',   color: 'text-amber-400 border-amber-700/50 bg-amber-950/30' },
    npc:         { icon: '🗣', label: 'Rencontre PNJ', color: 'text-sky-400 border-sky-700/50 bg-sky-950/30' },
    exploration: { icon: '🧭', label: 'Exploration', color: 'text-emerald-400 border-emerald-700/50 bg-emerald-950/30' },
  }
  const sceneKind = (sc: PrepScene): SceneKind => sc.kind ?? 'event'

  /**
   * Monte le combat d'une scène : crée les combattants de la rencontre référencée
   * (avec leur FP, sans quoi l'XP de fin de combat serait perdue) et bascule sur la
   * page Combat. C'est le geste qui fait gagner du temps à la table.
   */
  async function handleLaunchSceneCombat(sc: PrepScene) {
    if (!campaign) return
    const enc = (campaign.saved_encounters ?? []).find(e => e.name === sc.encounter_name)
    if (!enc || enc.entries.length === 0) {
      toast.error('Aucune rencontre sauvegardée liée à cette scène.')
      return
    }
    setSaving(true)
    try {
      await Promise.all(enc.entries.flatMap(entry =>
        Array.from({ length: entry.count }, (_, i) =>
          createCombatant(campaign.id, {
            name: entry.count > 1 ? `${entry.monster_name} ${i + 1}` : entry.monster_name,
            cr: entry.cr ?? null,
            max_hp: (campaign.custom_monsters ?? []).find(m => m.name === entry.monster_name)?.hp_avg ?? 10,
            faction: 'ennemi',
          })
        )
      ))
      toast.success(`${enc.name} — combattants ajoutés.`)
      navigate(`/combat?campaign=${campaign.id}`)
    } catch {
      toast.error("Le combat n'a pas pu être monté.")
    } finally {
      setSaving(false)
    }
  }
  const [sceneDraft, setSceneDraft] = useState<PrepScene>(emptyScene())
  const [addingScene, setAddingScene] = useState(false)
  const [expandedScene, setExpandedScene] = useState<string | null>(null)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneSearch, setSceneSearch] = useState('')
  const [sceneStatusFilter, setSceneStatusFilter] = useState<'all' | 'todo' | 'done'>('all')
  const [editSceneDraft, setEditSceneDraft] = useState<PrepScene>(emptyScene())
  async function handleSaveSessionPrep() {
    if (!activeSession) return
    setSavingSessionPrep(true)
    try {
      await savePrep(sessionPrepDraft)
      setEditingSessionPrep(false)
    } catch {
      toast.error("La séance n'a pas pu être enregistrée.")
    } finally { setSavingSessionPrep(false) }
  }

  /** Ajoute une séance en fin de file. */
  async function handleAddUpcomingSession() {
    setSavingSessionPrep(true)
    try {
      const created = await createSession(campaign.id, {
        title: `Séance ${upcoming.length + 1}`,
        status: 'planned',
        prep: { scenes: [], npc_names: [], location_names: [], encounter_names: [] },
      })
      setSessions(prev => [...prev, created])
      setActiveSessionId(created.id)
      setEditingSessionPrep(true)
    } catch {
      toast.error("La séance n'a pas pu être créée.")
    } finally { setSavingSessionPrep(false) }
  }

  /**
   * Remonte ou descend une séance dans la file. Optimiste : l'ordre bouge tout de suite,
   * et on revient en arrière si le serveur refuse — sinon l'affichage mentirait.
   */
  async function handleMoveSession(id: number, dir: -1 | 1) {
    const idx = upcoming.findIndex(s => s.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= upcoming.length) return

    const reordered = [...upcoming]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]

    const snapshot = sessions
    setSessions(prev => prev.map(s => {
      const i = reordered.findIndex(r => r.id === s.id)
      return i >= 0 ? { ...s, position: i + 1 } : s
    }))
    try {
      const fresh = await reorderSessions(campaign.id, reordered.map(s => s.id))
      setSessions(fresh)
    } catch {
      setSessions(snapshot)
      toast.error("L'ordre des séances n'a pas pu être enregistré.")
    }
  }

  /** La séance a été jouée : elle quitte la file et rejoint le journal. */
  async function handleMarkSessionPlayed(id: number) {
    try {
      const updated = await updateSession(campaign.id, id, {
        status: 'played',
        session_date: new Date().toISOString().slice(0, 10),
      })
      setSessions(prev => prev.map(s => (s.id === updated.id ? updated : s)))
      if (activeSessionId === id) setActiveSessionId(null)
      toast.success(`« ${updated.title} » est passée au journal.`)
    } catch {
      toast.error("La séance n'a pas pu être clôturée.")
    }
  }
  function handleExportSessionPrepMarkdown() {
    if (!activePrep) return
    const prep = activePrep
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
    if (!activeSession) return
    if (!confirm(`Supprimer la séance « ${activeSession.title} » et toutes ses scènes ?`)) return
    const id = activeSession.id
    try {
      await deleteSession(campaign.id, id)
      setSessions(prev => prev.filter(s => s.id !== id))
      setActiveSessionId(null)
      setSessionPrepDraft(emptySessionPrep())
      setEditingSessionPrep(false)
    } catch {
      toast.error("La séance n'a pas pu être supprimée.")
    }
  }
  async function handleAddScene() {
    if (!activePrep || !sceneDraft.title.trim()) return
    await savePrep({
      ...activePrep,
      scenes: [...(activePrep.scenes ?? []), { ...sceneDraft, id: uuid(), title: sceneDraft.title.trim() }],
    })
    setSceneDraft(emptyScene())
    setAddingScene(false)
  }
  async function handleToggleSceneDone(sceneId: string) {
    if (!activePrep) return
    await savePrep({
      ...activePrep,
      scenes: (activePrep.scenes ?? []).map(s => (s.id === sceneId ? { ...s, done: !s.done } : s)),
    })
  }
  async function handleDeleteScene(sceneId: string) {
    if (!activePrep) return
    await savePrep({
      ...activePrep,
      scenes: (activePrep.scenes ?? []).filter(s => s.id !== sceneId),
    })
    if (expandedScene === sceneId) setExpandedScene(null)
  }
  async function handleMoveScene(sceneId: string, dir: -1 | 1) {
    if (!activePrep) return
    const scenes = [...(activePrep.scenes ?? [])]
    const idx = scenes.findIndex(s => s.id === sceneId)
    if (idx < 0) return
    const target = idx + dir
    if (target < 0 || target >= scenes.length) return
    ;[scenes[idx], scenes[target]] = [scenes[target], scenes[idx]]
    await savePrep({ ...activePrep, scenes })
  }
  async function handleDuplicateScene(sceneId: string) {
    if (!activePrep) return
    const src = (activePrep.scenes ?? []).find(s => s.id === sceneId)
    if (!src) return
    const copy = { ...src, id: uuid(), title: `${src.title} (copie)`, done: false }
    await savePrep({ ...activePrep, scenes: [...(activePrep.scenes ?? []), copy] })
  }
  async function handleUpdateScene(sceneId: string) {
    if (!activePrep || !editSceneDraft.title.trim()) return
    await savePrep({
      ...activePrep,
      scenes: (activePrep.scenes ?? []).map(s =>
        s.id === sceneId ? { ...editSceneDraft, id: sceneId, title: editSceneDraft.title.trim() } : s
      ),
    })
    setEditingSceneId(null)
  }

  return (
    <>
        {/* File des séances à venir : l'ordre se remanie au gré des joueurs. */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-stone-300 text-sm font-semibold">Séances à venir</h2>
              <p className="text-stone-500 text-xs mt-0.5">
                L'ordre n'est qu'un fil conducteur — remontez une séance si les joueurs vous y emmènent
              </p>
            </div>
            <button
              onClick={handleAddUpcomingSession}
              disabled={savingSessionPrep}
              className="text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              + Séance
            </button>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-stone-600 text-xs text-center py-6">
              Aucune séance planifiée. Ajoutez-en une, puis garnissez-la de combats, d'événements et de rencontres.
            </p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((sess, idx) => {
                const prep = sessionToPrep(sess)
                const isActive = activeSession?.id === sess.id
                const scenes = prep.scenes ?? []
                const doneCount = scenes.filter(sc => sc.done).length
                return (
                  <div
                    key={sess.id}
                    className={`border rounded-lg px-3 py-2 transition-colors ${
                      isActive ? 'border-sky-700/60 bg-sky-950/20' : 'border-stone-800 bg-stone-950/40 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <button
                          onClick={() => handleMoveSession(sess.id, -1)}
                          disabled={idx === 0}
                          className="text-stone-600 hover:text-stone-300 text-[10px] leading-none disabled:opacity-20 disabled:hover:text-stone-600"
                          title="Monter"
                        >▲</button>
                        <button
                          onClick={() => handleMoveSession(sess.id, 1)}
                          disabled={idx === upcoming.length - 1}
                          className="text-stone-600 hover:text-stone-300 text-[10px] leading-none disabled:opacity-20 disabled:hover:text-stone-600"
                          title="Descendre"
                        >▼</button>
                      </div>
                      <span className="text-stone-600 text-xs tabular-nums w-4">{idx + 1}</span>

                      <button
                        onClick={() => { setActiveSessionId(sess.id); setEditingSessionPrep(false) }}
                        className="flex-1 text-left min-w-0"
                      >
                        <p className={`text-sm truncate ${isActive ? 'text-sky-200 font-medium' : 'text-stone-300'}`}>
                          {sess.title || 'Séance sans titre'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {sess.session_date && <span className="text-stone-500 text-[11px]">📅 {sess.session_date}</span>}
                          {scenes.length === 0 ? (
                            <span className="text-stone-600 text-[11px]">aucune scène</span>
                          ) : (
                            <>
                              {(['combat', 'event', 'npc', 'exploration'] as SceneKind[]).map(k => {
                                const n = scenes.filter(sc => sceneKind(sc) === k).length
                                if (n === 0) return null
                                return (
                                  <span key={k} className="text-[11px] text-stone-400" title={SCENE_KINDS[k].label}>
                                    {SCENE_KINDS[k].icon} {n}
                                  </span>
                                )
                              })}
                              <span className="text-stone-600 text-[11px]">· {doneCount}/{scenes.length} jouées</span>
                            </>
                          )}
                        </div>
                      </button>

                      <button
                        onClick={() => handleMarkSessionPlayed(sess.id)}
                        className="text-emerald-500 hover:text-emerald-400 text-[11px] transition-colors shrink-0"
                        title="Marquer comme jouée : la séance passe au journal"
                      >✓ Jouée</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Préparation de la séance sélectionnée */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-stone-300 text-sm font-semibold">
                {activeSession ? `Préparation — ${activeSession.title || 'Séance sans titre'}` : 'Préparation'}
              </h2>
              <p className="text-stone-500 text-xs mt-0.5">
                {activeSession
                  ? 'Combats, événements, rencontres PNJ, exploration'
                  : 'Sélectionnez une séance ci-dessus'}
              </p>
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
                <button onClick={handleClearSessionPrep} className="text-red-500 hover:text-red-400 text-xs transition-colors">Supprimer</button>
              )}
            </div>
          </div>

          {hasSessionPrep ? (
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
                      Scènes ({(activePrep?.scenes ?? []).length})
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
                      {/* Nature de la scène : détermine son icône et, pour un combat, la
                          possibilité de monter la rencontre en un clic. */}
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(SCENE_KINDS) as SceneKind[]).map(k => (
                          <button
                            key={k}
                            onClick={() => setSceneDraft(d => ({ ...d, kind: k }))}
                            className={`text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${
                              (sceneDraft.kind ?? 'event') === k
                                ? SCENE_KINDS[k].color
                                : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                            }`}
                          >{SCENE_KINDS[k].icon} {SCENE_KINDS[k].label}</button>
                        ))}
                      </div>
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

                  {(activePrep?.scenes ?? []).length > 2 && (
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

                  {(activePrep?.scenes ?? []).length > 0 ? (
                    <div className="space-y-2">
                      {(activePrep!.scenes ?? []).filter(s =>
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
                                <span
                                  title={SCENE_KINDS[sceneKind(scene)].label}
                                  className={`shrink-0 text-xs rounded px-1.5 py-0.5 border ${SCENE_KINDS[sceneKind(scene)].color}`}
                                >{SCENE_KINDS[sceneKind(scene)].icon}</span>
                                <p className={`text-sm font-medium flex-1 truncate ${scene.done ? 'line-through text-stone-500' : 'text-white'}`}>{scene.title}</p>
                                {scene.location_name && <span className="text-stone-600 text-xs shrink-0">📍 {scene.location_name}</span>}
                                {sceneKind(scene) === 'combat' && scene.encounter_name && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleLaunchSceneCombat(scene) }}
                                    disabled={saving}
                                    title={`Monter « ${scene.encounter_name} » et aller au combat`}
                                    className="shrink-0 text-xs font-semibold rounded px-2 py-0.5 border bg-red-700/30 border-red-600/50 text-red-300 hover:bg-red-700/60 disabled:opacity-40 transition-colors"
                                  >⚔ Lancer</button>
                                )}
                                {!sceneSearch && sceneStatusFilter === 'all' && sceneIdx > 0 && (
                                  <button
                                    onClick={e => { e.stopPropagation(); handleMoveScene(scene.id, -1) }}
                                    className="text-stone-700 hover:text-stone-400 text-xs leading-none shrink-0 transition-colors"
                                    title="Monter"
                                  >↑</button>
                                )}
                                {!sceneSearch && sceneStatusFilter === 'all' && sceneIdx < ((activePrep!.scenes ?? []).length - 1) && (
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
            <p className="text-stone-600 text-sm text-center py-4">Sélectionnez une séance à venir, ou ajoutez-en une avec « + Séance ».</p>
          )}
        </div>

        {/* Journal — les séances jouées et les jalons de la campagne.
            Il occupait sa propre page ; il appartient au fil de la séance. */}
        <CampaignJournalSection {...props} />

        {/* Moment de la journée */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
          <p className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">Ambiance — moment de la journée</p>
          <div className="grid grid-cols-4 gap-2">
            {TIME_OF_DAY.map(tod => {
              const cfg = TIME_OF_DAY_CONFIG[tod]
              const active = (campaign?.time_of_day ?? 'none') === tod
              return (
                <button
                  key={tod}
                  onClick={() => handleSetTimeOfDay(tod)}
                  disabled={todSaving}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs transition-colors ${
                    active
                      ? 'bg-amber-900/60 border-amber-600 text-amber-300'
                      : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-300'
                  }`}
                >
                  <span className="text-lg leading-none">{cfg.emoji}</span>
                  <span>{cfg.label}</span>
                </button>
              )
            })}
          </div>
          {campaign?.share_token && (
            <p className="text-stone-600 text-xs mt-2">Visible en temps réel sur les fiches joueurs</p>
          )}
        </div>

        {/* Notes privées MJ */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-stone-300 text-sm font-semibold">Notes privées MJ</h2>
              <p className="text-stone-500 text-xs mt-0.5">Visibles uniquement par vous — non partagées</p>
            </div>
            <div className="flex items-center gap-2">
              {!dmNotesPreview && (
                <MicButton
                  onTranscript={text => setDmNotesDraft(prev => prev ? prev + '\n' + text : text)}
                />
              )}
              {dmNotesDraft.trim() && (
                <button
                  onClick={() => setDmNotesPreview(v => !v)}
                  className={`text-xs transition-colors ${dmNotesPreview ? 'text-amber-400' : 'text-stone-500 hover:text-stone-300'}`}
                >
                  {dmNotesPreview ? '✎ Éditer' : '👁 Aperçu'}
                </button>
              )}
              {savingNotes && <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />}
            </div>
          </div>
          {dmNotesPreview ? (
            <div className="min-h-[6rem]">
              <MarkdownText className="text-stone-200 text-sm">{dmNotesDraft}</MarkdownText>
            </div>
          ) : (
            <textarea
              value={dmNotesDraft}
              onChange={e => setDmNotesDraft(e.target.value)}
              onBlur={handleSaveDmNotes}
              placeholder="Notes de préparation, secrets, PNJ, lieux, intrigues…"
              rows={6}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
            />
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
              {(campaign.random_tables ?? []).length > 1 && (
                <input
                  type="text"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  placeholder="Rechercher une table…"
                  className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
              )}
              {(campaign.random_tables ?? []).map((table, tIdx) => ({ table, tIdx })).filter(({ table }) => !tableSearch || table.name.toLowerCase().includes(tableSearch.toLowerCase())).map(({ table, tIdx }) => (
                <div key={tIdx} className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {renamingTableIdx === tIdx ? (
                        <input
                          autoFocus
                          type="text"
                          value={renamingTableDraft}
                          onChange={e => setRenamingTableDraft(e.target.value)}
                          onBlur={() => handleRenameTable(tIdx, renamingTableDraft)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameTable(tIdx, renamingTableDraft); if (e.key === 'Escape') setRenamingTableIdx(null) }}
                          className="bg-stone-800 border border-stone-600 rounded px-2 py-0.5 text-white text-sm focus:outline-none focus:border-amber-500 min-w-0 max-w-xs"
                        />
                      ) : (
                        <span
                          className="text-white text-sm font-medium truncate cursor-pointer hover:text-amber-300 transition-colors"
                          onDoubleClick={() => { setRenamingTableIdx(tIdx); setRenamingTableDraft(table.name) }}
                          title="Double-cliquer pour renommer"
                        >{table.name}</span>
                      )}
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
                        onClick={() => handleDuplicateTable(tIdx)}
                        className="text-stone-600 hover:text-sky-400 text-xs transition-colors"
                        title="Dupliquer"
                      >⎘</button>
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
                      {table.entries.map((entry, eIdx) => {
                        const eKey = `${tIdx}-${eIdx}`
                        if (editingEntryKey === eKey) {
                          return (
                            <div key={eIdx} className="flex items-center gap-2 text-sm">
                              <input
                                type="number"
                                value={editEntryDraft.weight}
                                onChange={e => setEditEntryDraft(d => ({ ...d, weight: Math.max(1, Number(e.target.value)) }))}
                                min={1}
                                className="w-14 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-stone-200 text-sm text-center focus:outline-none focus:border-amber-500"
                              />
                              <input
                                autoFocus
                                type="text"
                                value={editEntryDraft.text}
                                onChange={e => setEditEntryDraft(d => ({ ...d, text: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') handleUpdateTableEntry(tIdx, eIdx, editEntryDraft); if (e.key === 'Escape') setEditingEntryKey(null) }}
                                onBlur={() => handleUpdateTableEntry(tIdx, eIdx, editEntryDraft)}
                                className="flex-1 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500"
                              />
                              <button onClick={() => setEditingEntryKey(null)} className="text-stone-600 hover:text-stone-400 text-xs transition-colors shrink-0">✕</button>
                            </div>
                          )
                        }
                        return (
                          <div key={eIdx} className="flex items-center gap-2 text-sm group">
                            <span className="text-stone-600 text-xs w-6 text-right shrink-0">{entry.weight}</span>
                            <span
                              className="text-stone-300 flex-1 cursor-pointer hover:text-white transition-colors"
                              onClick={() => { setEditingEntryKey(eKey); setEditEntryDraft({ ...entry }) }}
                            >{entry.text}</span>
                            <button
                              onClick={() => handleDeleteTableEntry(tIdx, eIdx)}
                              className="text-stone-600 hover:text-red-400 text-sm transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                            >×</button>
                          </div>
                        )
                      })}
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

    </>
  )
}
