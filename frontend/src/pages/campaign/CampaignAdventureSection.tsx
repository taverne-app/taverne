import { useState } from 'react'
import {
  updateCampaign,
  type Quest,
  type CustomMonster,
  type MonsterAttack,
  type SessionPrep,
  type PrepScene,
} from '../../api/campaigns'
import { createCombatant } from '../../api/combatants'
import { computeEncounterDifficulty, difficultyColor } from '../../data/encounter_difficulty'
import { CR_XP } from '../../data/monsters'
import { MarkdownText } from '../../components/MarkdownText'
import { MicButton } from '../../components/MicButton'
import type { SectionProps } from './shared'
import { uuid } from './shared'

/**
 * Section « Aventure » : quêtes, préparation de scènes, rencontres sauvegardées
 * et bestiaire personnalisé.
 *
 * Extraite de CampaignPage. Le brouillon de préparation de séance était initialisé
 * par l'effet de chargement de la coquille ; il s'initialise désormais ici, depuis
 * la campagne — la section qui le possède.
 */
export default function CampaignAdventureSection({
  campaign, setCampaign, characters, saving,
  copiedKey, copyToClipboard, exportSection, importSectionData,
}: SectionProps) {

  const emptyQuestDraft = (): Omit<Quest, 'id'> => ({ title: '', description: '', status: 'active', giver: '', notes: '' })
  const [questDraft, setQuestDraft] = useState<Omit<Quest, 'id'>>(emptyQuestDraft())
  const [addingQuest, setAddingQuest] = useState(false)
  const [expandedQuest, setExpandedQuest] = useState<string | null>(null)
  const [editingQuestId, setEditingQuestId] = useState<string | null>(null)
  const [editQuestDraft, setEditQuestDraft] = useState<Omit<Quest, 'id'>>(emptyQuestDraft())
  const [questStatusFilter, setQuestStatusFilter] = useState<'all' | Quest['status']>('all')
  const [questSearch, setQuestSearch] = useState('')
  const [questSort, setQuestSort] = useState<'default' | 'title' | 'giver'>('default')
  const emptySessionPrep = (): SessionPrep => ({ title: '', date: '', notes: '', npc_names: [], location_names: [], encounter_names: [], scenes: [] })
  const [sessionPrepDraft, setSessionPrepDraft] = useState<SessionPrep>(campaign.session_prep ?? emptySessionPrep())
  const [editingSessionPrep, setEditingSessionPrep] = useState(false)
  const [hasSessionPrep, setHasSessionPrep] = useState(!!campaign.session_prep)
  const [savingSessionPrep, setSavingSessionPrep] = useState(false)
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

  return (
    <>
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

    </>
  )
}
