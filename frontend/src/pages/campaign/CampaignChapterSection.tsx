import { useState, useMemo, useEffect } from 'react'
import { MarkdownText } from '../../components/MarkdownText'
import { MicButton } from '../../components/MicButton'
import type { PrepScene, SceneKind } from '../../api/campaigns'
import { useToast } from '../../contexts/ToastContext'
import type { SectionProps } from './shared'
import { uuid } from './shared'
import { createCombatant } from '../../api/combatants'
import { updateIdentity } from '../../api/characters'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCampaigns } from '../../contexts/CampaignContext'
import { computeEncounterDifficulty, difficultyColor } from '../../data/encounter_difficulty'
import {
  createChapter, updateChapter, deleteChapter, reorderChapters,
  type Chapter, type ChapterPrep,
} from '../../api/chapters'

/**
 * Section « Chapitres » : la colonne vertébrale du scénario.
 *
 * Un chapitre n'est pas une soirée de jeu — c'est une section du récit. Il n'a donc
 * pas de date : il a un rang, et la chronologie, c'est l'ordre de la liste. Une coche
 * le marque terminé ; il tombe alors en fin de liste sans perdre sa place face aux
 * autres terminés. L'ordre n'est jamais un impératif : les joueurs dévient, on remonte
 * un chapitre.
 */
export default function CampaignChapterSection(props: SectionProps) {
  const {
    campaign, characters, setCharacters, saving, setSaving,
    chapters, setChapters,
  } = props
  const toast = useToast()
  const navigate = useNavigate()

  const [savingChapter, setSavingChapter] = useState(false)
  const [editing, setEditing] = useState(false)

  /** Les chapitres en cours d'abord, les terminés en fin de liste — chacun à son rang. */
  const ordered = useMemo(
    () => [...chapters].sort((a, b) =>
      Number(a.done) - Number(b.done) || a.position - b.position || a.id - b.id,
    ),
    [chapters],
  )
  const todo = useMemo(() => ordered.filter(c => !c.done), [ordered])

  const [activeId, setActiveId] = useState<number | null>(null)
  const active = ordered.find(c => c.id === activeId) ?? todo[0] ?? ordered[0] ?? null

  // La navigation de gauche ouvre un chapitre précis : /campaigns/12/chapitres?chapitre=34.
  const [searchParams] = useSearchParams()
  const chapterParam = Number(searchParams.get('chapitre')) || null
  useEffect(() => {
    if (chapterParam) setActiveId(chapterParam)
  }, [chapterParam])

  // Toute écriture doit se voir dans la navigation, qui tient sa propre liste.
  const { reloadChapters } = useCampaigns()
  useEffect(() => { reloadChapters() }, [chapters, reloadChapters])

  const prepOf = (c: Chapter): ChapterPrep =>
    c.prep ?? { scenes: [], npc_names: [], location_names: [], encounter_names: [] }

  type Draft = {
    title: string; notes: string
    npc_names: string[]; location_names: string[]; encounter_names: string[]
    xp_awarded: string; loot_notes: string
  }
  const draftOf = (c: Chapter): Draft => ({
    title: c.title,
    notes: c.notes ?? '',
    npc_names: prepOf(c).npc_names,
    location_names: prepOf(c).location_names,
    encounter_names: prepOf(c).encounter_names,
    xp_awarded: c.xp_awarded != null ? String(c.xp_awarded) : '',
    loot_notes: c.loot_notes ?? '',
  })
  const emptyDraft = (): Draft => ({ title: '', notes: '', npc_names: [], location_names: [], encounter_names: [], xp_awarded: '', loot_notes: '' })
  const [draft, setDraft] = useState<Draft>(emptyDraft())

  // Changer de chapitre recharge le brouillon d'édition.
  useEffect(() => {
    if (active) setDraft(draftOf(active))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  /** Point de passage unique de toute écriture sur le chapitre actif. */
  async function patchActive(data: Parameters<typeof updateChapter>[2]): Promise<Chapter | null> {
    if (!active) return null
    const updated = await updateChapter(campaign.id, active.id, data)
    setChapters(prev => prev.map(c => (c.id === updated.id ? updated : c)))
    return updated
  }

  /** Écrit les scènes du chapitre actif, en préservant le reste de sa préparation. */
  async function saveScenes(scenes: PrepScene[]) {
    if (!active) return
    await patchActive({ prep: { ...prepOf(active), scenes } })
  }

  async function handleSaveDraft() {
    if (!active) return
    setSavingChapter(true)
    try {
      const updated = await patchActive({
        title: draft.title.trim() || active.title,
        notes: draft.notes || null,
        xp_awarded: draft.xp_awarded ? parseInt(draft.xp_awarded, 10) || null : null,
        loot_notes: draft.loot_notes.trim() || null,
        prep: {
          scenes: prepOf(active).scenes,
          npc_names: draft.npc_names,
          location_names: draft.location_names,
          encounter_names: draft.encounter_names,
        },
      })
      if (updated) setDraft(draftOf(updated))
      setEditing(false)
    } catch {
      toast.error("Le chapitre n'a pas pu être enregistré.")
    } finally { setSavingChapter(false) }
  }

  async function handleAddChapter() {
    setSavingChapter(true)
    try {
      const created = await createChapter(campaign.id, {
        title: `Chapitre ${chapters.length + 1}`,
        prep: { scenes: [], npc_names: [], location_names: [], encounter_names: [] },
      })
      setChapters(prev => [...prev, created])
      setActiveId(created.id)
      setEditing(true)
    } catch {
      toast.error("Le chapitre n'a pas pu être créé.")
    } finally { setSavingChapter(false) }
  }

  /** La coche : le chapitre est joué. Il garde son rang, il passe simplement en fin de liste. */
  async function handleToggleDone(c: Chapter) {
    const snapshot = chapters
    setChapters(prev => prev.map(x => (x.id === c.id ? { ...x, done: !x.done } : x)))
    try {
      const updated = await updateChapter(campaign.id, c.id, { done: !c.done })
      setChapters(prev => prev.map(x => (x.id === updated.id ? updated : x)))
    } catch {
      setChapters(snapshot)
      toast.error("Le chapitre n'a pas pu être coché.")
    }
  }

  /**
   * Remonte ou descend un chapitre parmi ceux en cours. Optimiste : l'ordre bouge tout
   * de suite, et revient en arrière si le serveur refuse — sinon l'affichage mentirait.
   *
   * On renvoie TOUTE la liste au serveur, terminés compris : il renumérote de 1 à n, et
   * les rangs restent cohérents entre les deux groupes.
   */
  async function handleMove(id: number, dir: -1 | 1) {
    const idx = todo.findIndex(c => c.id === id)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= todo.length) return

    const moved = [...todo]
    ;[moved[idx], moved[target]] = [moved[target], moved[idx]]
    const full = [...moved, ...ordered.filter(c => c.done)]

    const snapshot = chapters
    setChapters(prev => prev.map(c => {
      const i = full.findIndex(f => f.id === c.id)
      return i >= 0 ? { ...c, position: i + 1 } : c
    }))
    try {
      setChapters(await reorderChapters(campaign.id, full.map(c => c.id)))
    } catch {
      setChapters(snapshot)
      toast.error("L'ordre des chapitres n'a pas pu être enregistré.")
    }
  }

  async function handleDeleteChapter() {
    if (!active) return
    if (!confirm(`Supprimer le chapitre « ${active.title} » et toutes ses scènes ?`)) return
    const id = active.id
    try {
      await deleteChapter(campaign.id, id)
      setChapters(prev => prev.filter(c => c.id !== id))
      setActiveId(null)
      setEditing(false)
    } catch {
      toast.error("Le chapitre n'a pas pu être supprimé.")
    }
  }

  /** Répartit l'XP du chapitre entre les personnages, une seule fois. */
  async function handleDistributeXp() {
    if (!active || active.xp_awarded == null || characters.length === 0) return
    setSaving(true)
    try {
      const perChar = Math.floor(active.xp_awarded / characters.length)
      setCharacters(await Promise.all(
        characters.map(c => updateIdentity(c.id, { experience_points: c.experience_points + perChar })),
      ))
      await patchActive({ xp_distributed: true })
      toast.success(`${perChar.toLocaleString('fr-FR')} XP par personnage.`)
    } catch {
      toast.error("L'XP n'a pas pu être distribuée.")
    } finally { setSaving(false) }
  }

  // ── Scènes ────────────────────────────────────────────────────────────────

  const emptyScene = (): PrepScene => ({
    id: uuid(),
    kind: 'event',
    title: '', location_name: '', npc_names: [], encounter_name: '',
    treasure: '', hook: '', notes: '', done: false,
  })

  /** Une scène sans type vient d'avant leur introduction : elle est traitée comme un événement. */
  const SCENE_KINDS: Record<SceneKind, { icon: string; label: string; color: string }> = {
    combat:      { icon: '⚔',  label: 'Combat',        color: 'text-red-400 border-red-700/50 bg-red-950/30' },
    event:       { icon: '🎭', label: 'Événement',     color: 'text-amber-400 border-amber-700/50 bg-amber-950/30' },
    npc:         { icon: '🗣', label: 'Rencontre PNJ', color: 'text-sky-400 border-sky-700/50 bg-sky-950/30' },
    exploration: { icon: '🧭', label: 'Exploration',   color: 'text-emerald-400 border-emerald-700/50 bg-emerald-950/30' },
  }
  const sceneKind = (sc: PrepScene): SceneKind => sc.kind ?? 'event'

  const [sceneDraft, setSceneDraft] = useState<PrepScene>(emptyScene())
  const [addingScene, setAddingScene] = useState(false)
  const [expandedScene, setExpandedScene] = useState<string | null>(null)
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editSceneDraft, setEditSceneDraft] = useState<PrepScene>(emptyScene())
  const [sceneSearch, setSceneSearch] = useState('')
  const [sceneStatusFilter, setSceneStatusFilter] = useState<'all' | 'todo' | 'done'>('all')

  const scenes = active ? prepOf(active).scenes : []

  /**
   * Monte le combat d'une scène : crée les combattants de la rencontre référencée
   * (avec leur FP, sans quoi l'XP de fin de combat serait perdue) et bascule sur la
   * page Combat. C'est le geste qui fait gagner du temps à la table.
   */
  async function handleLaunchSceneCombat(sc: PrepScene) {
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

  async function handleAddScene() {
    if (!active || !sceneDraft.title.trim()) return
    await saveScenes([...scenes, { ...sceneDraft, id: uuid(), title: sceneDraft.title.trim() }])
    setSceneDraft(emptyScene())
    setAddingScene(false)
  }
  async function handleToggleSceneDone(sceneId: string) {
    await saveScenes(scenes.map(s => (s.id === sceneId ? { ...s, done: !s.done } : s)))
  }
  async function handleDeleteScene(sceneId: string) {
    await saveScenes(scenes.filter(s => s.id !== sceneId))
    if (expandedScene === sceneId) setExpandedScene(null)
  }
  async function handleMoveScene(sceneId: string, dir: -1 | 1) {
    const next = [...scenes]
    const idx = next.findIndex(s => s.id === sceneId)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    await saveScenes(next)
  }
  async function handleDuplicateScene(sceneId: string) {
    const src = scenes.find(s => s.id === sceneId)
    if (!src) return
    await saveScenes([...scenes, { ...src, id: uuid(), title: `${src.title} (copie)`, done: false }])
  }
  async function handleUpdateScene(sceneId: string) {
    if (!editSceneDraft.title.trim()) return
    await saveScenes(scenes.map(s =>
      s.id === sceneId ? { ...editSceneDraft, id: sceneId, title: editSceneDraft.title.trim() } : s
    ))
    setEditingSceneId(null)
  }

  function handleExportMarkdown() {
    if (!active) return
    const lines: string[] = [`# ${active.title}`, '']
    const prep = prepOf(active)
    if (prep.npc_names.length > 0) { lines.push('## PNJ impliqués'); prep.npc_names.forEach(n => lines.push(`- ${n}`)); lines.push('') }
    if (prep.location_names.length > 0) { lines.push('## Lieux à visiter'); prep.location_names.forEach(l => lines.push(`- ${l}`)); lines.push('') }
    if (prep.encounter_names.length > 0) { lines.push('## Rencontres planifiées'); prep.encounter_names.forEach(e => lines.push(`- ${e}`)); lines.push('') }
    if (prep.scenes.length > 0) {
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
    if (active.notes) { lines.push('## Notes'); lines.push(active.notes); lines.push('') }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const filename = active.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    a.download = `chapitre_${filename || 'sans_titre'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleScenes = scenes.filter(s =>
    (sceneStatusFilter === 'all' || (sceneStatusFilter === 'done' ? s.done : !s.done)) &&
    (!sceneSearch
      || s.title.toLowerCase().includes(sceneSearch.toLowerCase())
      || (s.location_name ?? '').toLowerCase().includes(sceneSearch.toLowerCase())
      || (s.notes ?? '').toLowerCase().includes(sceneSearch.toLowerCase()))
  )
  const unfiltered = !sceneSearch && sceneStatusFilter === 'all'

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      {/* Sommaire des chapitres : la liste EST la navigation. Elle reste visible pendant
          qu'on travaille le détail à droite, et défile pour elle-même si les chapitres
          débordent la hauteur de l'écran. L'ordre du récit s'y remanie toujours. */}
      <nav className="bg-stone-900 border border-stone-800 rounded-xl p-3 self-start md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-stone-300 text-sm font-semibold">Chapitres</h2>
          <button
            onClick={handleAddChapter}
            disabled={savingChapter}
            className="text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors disabled:opacity-50 shrink-0"
          >
            + Chapitre
          </button>
        </div>

        {ordered.length === 0 ? (
          <p className="text-stone-600 text-xs text-center py-6">
            Aucun chapitre. Ajoutez-en un, puis garnissez-le de combats, d'événements et de rencontres.
          </p>
        ) : (
          <div className="space-y-2">
            {ordered.map(ch => {
              const isActive = active?.id === ch.id
              const chScenes = prepOf(ch).scenes
              const doneCount = chScenes.filter(sc => sc.done).length
              const todoIdx = todo.findIndex(c => c.id === ch.id)
              return (
                <div
                  key={ch.id}
                  className={`border rounded-lg px-3 py-2 transition-colors ${
                    ch.done
                      ? 'border-stone-800 bg-stone-950/60 opacity-60'
                      : isActive
                        ? 'border-sky-700/60 bg-sky-950/20'
                        : 'border-stone-800 bg-stone-950/40 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleDone(ch)}
                      title={ch.done ? 'Rouvrir le chapitre' : 'Marquer le chapitre comme terminé'}
                      className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                        ch.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-600 hover:border-emerald-500'
                      }`}
                    >
                      {ch.done && <span className="text-[10px] font-bold">✓</span>}
                    </button>

                    {/* Un chapitre terminé ne se réordonne pas : il est déjà derrière nous. */}
                    {ch.done ? (
                      <div className="w-3 shrink-0" />
                    ) : (
                      <div className="flex flex-col shrink-0">
                        <button
                          onClick={() => handleMove(ch.id, -1)}
                          disabled={todoIdx === 0}
                          className="text-stone-600 hover:text-stone-300 text-[10px] leading-none disabled:opacity-20 disabled:hover:text-stone-600"
                          title="Monter"
                        >▲</button>
                        <button
                          onClick={() => handleMove(ch.id, 1)}
                          disabled={todoIdx === todo.length - 1}
                          className="text-stone-600 hover:text-stone-300 text-[10px] leading-none disabled:opacity-20 disabled:hover:text-stone-600"
                          title="Descendre"
                        >▼</button>
                      </div>
                    )}

                    <button
                      onClick={() => { setActiveId(ch.id); setEditing(false) }}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className={`text-sm truncate ${
                        ch.done ? 'text-stone-500 line-through' : isActive ? 'text-sky-200 font-medium' : 'text-stone-300'
                      }`}>
                        {ch.title || 'Chapitre sans titre'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {chScenes.length === 0 ? (
                          <span className="text-stone-600 text-[11px]">aucune scène</span>
                        ) : (
                          <>
                            {(['combat', 'event', 'npc', 'exploration'] as SceneKind[]).map(k => {
                              const n = chScenes.filter(sc => sceneKind(sc) === k).length
                              if (n === 0) return null
                              return (
                                <span key={k} className="text-[11px] text-stone-400" title={SCENE_KINDS[k].label}>
                                  {SCENE_KINDS[k].icon} {n}
                                </span>
                              )
                            })}
                            <span className="text-stone-600 text-[11px]">· {doneCount}/{chScenes.length} jouées</span>
                          </>
                        )}
                        {ch.xp_awarded != null && (
                          <span className="text-amber-500/80 text-[11px]">+{ch.xp_awarded.toLocaleString('fr-FR')} XP</span>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </nav>

      {/* Le chapitre sélectionné : sa préparation, ses scènes, son ambiance. */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="min-w-0">
            <h2 className="text-stone-300 text-sm font-semibold truncate">
              {active ? active.title || 'Chapitre sans titre' : 'Chapitre'}
            </h2>
            <p className="text-stone-500 text-xs mt-0.5">
              {active ? 'Combats, événements, rencontres PNJ, exploration' : 'Sélectionnez un chapitre ci-dessus'}
            </p>
          </div>
          {active && (
            <div className="flex items-center gap-3 shrink-0">
              {savingChapter && <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />}
              {!editing && (
                <button onClick={() => setEditing(true)} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Modifier</button>
              )}
              {!editing && (
                <button onClick={handleExportMarkdown} className="text-stone-500 hover:text-stone-300 text-xs transition-colors" title="Exporter en Markdown">↓ MD</button>
              )}
              <button onClick={handleDeleteChapter} className="text-red-500 hover:text-red-400 text-xs transition-colors">Supprimer</button>
            </div>
          )}
        </div>

        {!active ? (
          <p className="text-stone-600 text-sm text-center py-4">Sélectionnez un chapitre, ou ajoutez-en un avec « + Chapitre ».</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-stone-500 text-xs block mb-1">Titre</label>
              <input
                type="text"
                placeholder="ex. L'attaque du manoir…"
                value={draft.title}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                disabled={!editing}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-60"
              />
            </div>

            {/* PNJ impliqués */}
            {(campaign.npcs ?? []).length > 0 && (
              <div>
                <label className="text-stone-500 text-xs block mb-2">PNJ impliqués</label>
                <div className="flex flex-wrap gap-2">
                  {(campaign.npcs ?? []).map((npc, i) => {
                    const selected = draft.npc_names.includes(npc.name)
                    return (
                      <button
                        key={i}
                        disabled={!editing}
                        onClick={() => setDraft(d => ({
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
                    const selected = draft.location_names.includes(loc.name)
                    return (
                      <button
                        key={i}
                        disabled={!editing}
                        onClick={() => setDraft(d => ({
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
                    const selected = draft.encounter_names.includes(enc.name)
                    const diff = computeEncounterDifficulty(enc.entries, characters.map(c => c.level))
                    return (
                      <button
                        key={i}
                        disabled={!editing}
                        onClick={() => setDraft(d => ({
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

            {/* Récompenses : ce que le chapitre rapporte, une fois joué. */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <label className="text-stone-500 text-xs shrink-0">XP</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={draft.xp_awarded}
                  onChange={e => setDraft(d => ({ ...d, xp_awarded: e.target.value }))}
                  disabled={!editing}
                  className="w-24 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-60"
                />
              </div>
              <input
                type="text"
                placeholder="Butins & récompenses"
                value={draft.loot_notes}
                onChange={e => setDraft(d => ({ ...d, loot_notes: e.target.value }))}
                disabled={!editing}
                className="flex-1 min-w-0 basis-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-60"
              />
              {!editing && active.xp_awarded != null && characters.length > 0 && (
                active.xp_distributed ? (
                  <span className="text-xs text-stone-600 self-center">✓ XP distribuée</span>
                ) : (
                  <button
                    onClick={handleDistributeXp}
                    disabled={saving}
                    title={`Distribuer ${Math.floor(active.xp_awarded / characters.length)} XP à chaque personnage`}
                    className="text-xs bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/60 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                  >
                    ↗ Distribuer l'XP
                  </button>
                )
              )}
            </div>

            {/* Notes du chapitre — du matériau de MJ, jamais publié aux joueurs. */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-stone-500 text-xs">Notes</label>
                {editing && (
                  <MicButton onTranscript={text => setDraft(d => ({ ...d, notes: d.notes ? d.notes + '\n' + text : text }))} />
                )}
              </div>
              {editing ? (
                <textarea
                  placeholder="Objectifs du chapitre, secrets à révéler, rebondissements…"
                  value={draft.notes}
                  onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                  rows={4}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors resize-y"
                />
              ) : draft.notes ? (
                <div className="bg-stone-800/50 border border-stone-700/50 rounded-lg px-3 py-2">
                  <MarkdownText className="text-stone-300 text-sm">{draft.notes}</MarkdownText>
                </div>
              ) : (
                <p className="text-stone-600 text-xs italic">Aucune note.</p>
              )}
            </div>

            {editing && (
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => { setDraft(draftOf(active)); setEditing(false) }} className="text-stone-500 hover:text-stone-300 text-sm transition-colors">Annuler</button>
                <button
                  onClick={handleSaveDraft}
                  disabled={savingChapter}
                  className="text-sky-400 hover:text-sky-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Enregistrer
                </button>
              </div>
            )}

            {/* Scènes */}
            <div className="pt-2 border-t border-stone-800">
              <div className="flex items-center justify-between mb-3">
                <p className="text-stone-500 text-xs uppercase tracking-widest">Scènes ({scenes.length})</p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input type="text" value={sceneDraft.location_name} onChange={e => setSceneDraft(d => ({ ...d, location_name: e.target.value }))} placeholder="Lieu" className="min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors" />
                    <input type="text" value={sceneDraft.encounter_name} onChange={e => setSceneDraft(d => ({ ...d, encounter_name: e.target.value }))} placeholder="Rencontre liée" className="min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors" />
                    <input type="text" value={sceneDraft.hook} onChange={e => setSceneDraft(d => ({ ...d, hook: e.target.value }))} placeholder="Accroche / déclencheur" className="min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors" />
                    <input type="text" value={sceneDraft.treasure} onChange={e => setSceneDraft(d => ({ ...d, treasure: e.target.value }))} placeholder="Trésor / récompense" className="min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors" />
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

              {scenes.length > 2 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <input
                    type="text"
                    value={sceneSearch}
                    onChange={e => setSceneSearch(e.target.value)}
                    placeholder="Rechercher une scène…"
                    className="flex-1 min-w-0 basis-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-sky-600 transition-colors"
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

              {scenes.length === 0 ? (
                !addingScene && (
                  <p className="text-stone-700 text-xs text-center py-2">Aucune scène. Structurez votre chapitre en actes.</p>
                )
              ) : (
                <div className="space-y-2">
                  {visibleScenes.map((scene, sceneIdx) => (
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input type="text" value={editSceneDraft.location_name} onChange={e => setEditSceneDraft(d => ({ ...d, location_name: e.target.value }))} placeholder="Lieu" className="min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                            <input type="text" value={editSceneDraft.encounter_name} onChange={e => setEditSceneDraft(d => ({ ...d, encounter_name: e.target.value }))} placeholder="Rencontre liée" className="min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                            <input type="text" value={editSceneDraft.hook} onChange={e => setEditSceneDraft(d => ({ ...d, hook: e.target.value }))} placeholder="Accroche / déclencheur" className="min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
                            <input type="text" value={editSceneDraft.treasure} onChange={e => setEditSceneDraft(d => ({ ...d, treasure: e.target.value }))} placeholder="Trésor / récompense" className="min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm focus:outline-none focus:border-sky-500 transition-colors" />
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
                            <p className={`text-sm font-medium flex-1 min-w-0 truncate ${scene.done ? 'line-through text-stone-500' : 'text-white'}`}>{scene.title}</p>
                            {scene.location_name && <span className="hidden sm:inline text-stone-600 text-xs shrink-0">📍 {scene.location_name}</span>}
                            {sceneKind(scene) === 'combat' && scene.encounter_name && (
                              <button
                                onClick={e => { e.stopPropagation(); handleLaunchSceneCombat(scene) }}
                                disabled={saving}
                                title={`Monter « ${scene.encounter_name} » et aller au combat`}
                                className="shrink-0 text-xs font-semibold rounded px-2 py-0.5 border bg-red-700/30 border-red-600/50 text-red-300 hover:bg-red-700/60 disabled:opacity-40 transition-colors"
                              >⚔ Lancer</button>
                            )}
                            {unfiltered && sceneIdx > 0 && (
                              <button
                                onClick={e => { e.stopPropagation(); handleMoveScene(scene.id, -1) }}
                                className="text-stone-700 hover:text-stone-400 text-xs leading-none shrink-0 transition-colors"
                                title="Monter"
                              >↑</button>
                            )}
                            {unfiltered && sceneIdx < scenes.length - 1 && (
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
                              {scene.location_name && <p className="sm:hidden text-stone-400">📍 <span className="text-stone-300">{scene.location_name}</span></p>}
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
