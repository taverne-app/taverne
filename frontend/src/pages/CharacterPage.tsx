import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getCharacter,
  updateHp,
  updateConditions,
  updateDeathSaves,
  updateAbilities,
  updateProficiencies,
  useSpellSlot,
  longRest,
  updateSpells,
  updateSpellSlots,
  rollDice,
  updateInventory,
  updateFeatures,
  updateCurrency,
  updateDamageModifiers,
  updateConcentration,
  updateTempMaxHp,
  updateIdentity,
  updateNotes,
  updateDmNotes,
  updatePersonality,
  updateLanguagesAndTools,
  updateExhaustion,
  shortRest,
  updateAttackMacros,
  updateResources,
  shareCharacter,
  type Character,
  type AbilityName,
  type SkillName,
  type Spell,
  type SpellSlot,
  type DiceRoll,
  type InventoryItem,
  type Feature,
  type IdentityPayload,
  type Currency,
  type AttackMacro,
  type ClassResource,
} from '../api/characters'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { ApiError } from '../api/client'
import { createEcho, REALTIME_CONFIGURED } from '../lib/echo'
import { useTabNotify } from '../hooks/useTabNotify'
import { SRD_SPELLS, SPELL_DAMAGE } from '../data/spells'
import { MAGIC_ITEMS, type MagicItem, type ItemRarity } from '../data/items'
import { SPELL_DETAILS } from '../data/spell_details'
import { computeMulticlassSlots } from '../data/multiclass'
import { SpellCompendiumModal } from '../components/SpellCompendiumModal'
import { MarkdownText } from '../components/MarkdownText'
import { ImagePicker } from '../components/ImagePicker'
import { MicButton } from '../components/MicButton'
import { canLevelUp, xpForNextLevel } from '../data/xp'
import { ConditionTag } from '../components/ConditionTag'
import { CONDITIONS_FR } from '../data/conditions'
import { XpBar } from '../components/XpBar'
import { formatGold, lineGold } from '../lib/gold'

// ── Constantes ────────────────────────────────────────────────────────────────

const ABILITY_LABELS: [AbilityName, string, string][] = [
  ['strength',     'FOR', 'Force'],
  ['dexterity',    'DEX', 'Dextérité'],
  ['constitution', 'CON', 'Constitution'],
  ['intelligence', 'INT', 'Intelligence'],
  ['wisdom',       'SAG', 'Sagesse'],
  ['charisma',     'CHA', 'Charisme'],
]

const ABILITY_ABBR: Record<AbilityName, string> = {
  strength: 'FOR', dexterity: 'DEX', constitution: 'CON',
  intelligence: 'INT', wisdom: 'SAG', charisma: 'CHA',
}

const SKILL_LABELS: [SkillName, string][] = [
  ['acrobatics',      'Acrobaties'],
  ['animal_handling', 'Dressage'],
  ['arcana',          'Arcanes'],
  ['athletics',       'Athlétisme'],
  ['deception',       'Tromperie'],
  ['history',         'Histoire'],
  ['insight',         'Perspicacité'],
  ['intimidation',    'Intimidation'],
  ['investigation',   'Investigation'],
  ['medicine',        'Médecine'],
  ['nature',          'Nature'],
  ['perception',      'Perception'],
  ['performance',     'Représentation'],
  ['persuasion',      'Persuasion'],
  ['religion',        'Religion'],
  ['sleight_of_hand', 'Escamotage'],
  ['stealth',         'Discrétion'],
  ['survival',        'Survie'],
]

const ABILITY_OPTIONS: [AbilityName, string][] = [
  ['strength', 'Force'], ['dexterity', 'Dextérité'], ['constitution', 'Constitution'],
  ['intelligence', 'Intelligence'], ['wisdom', 'Sagesse'], ['charisma', 'Charisme'],
]

const HIT_DICE_BY_CLASS: Record<string, number> = {
  barbarian: 12, barbare: 12,
  fighter: 10, guerrier: 10, combattant: 10,
  paladin: 10,
  ranger: 10, rôdeur: 10, rodeur: 10,
  bard: 8, barde: 8,
  cleric: 8, clerc: 8, prêtre: 8, pretre: 8,
  druid: 8, druide: 8,
  monk: 8, moine: 8,
  rogue: 8, roublard: 8,
  warlock: 8, sorcier: 8,
  sorcerer: 6, ensorceleur: 6,
  wizard: 6, magicien: 6, mage: 6,
}

const DAMAGE_TYPES: [string, string][] = [
  ['acid', 'Acide'], ['bludgeoning', 'Contondant'], ['cold', 'Froid'],
  ['fire', 'Feu'], ['force', 'Force'], ['lightning', 'Foudre'],
  ['necrotic', 'Nécrotique'], ['piercing', 'Perforant'], ['poison', 'Poison'],
  ['psychic', 'Psychique'], ['radiant', 'Radiant'], ['slashing', 'Tranchant'],
  ['thunder', 'Tonnerre'],
]

const SPELL_LEVEL_LABELS: Record<number, string> = {
  0: 'Tours de magie', 1: 'Niveau 1', 2: 'Niveau 2', 3: 'Niveau 3',
  4: 'Niveau 4', 5: 'Niveau 5', 6: 'Niveau 6', 7: 'Niveau 7',
  8: 'Niveau 8', 9: 'Niveau 9',
}

const SAVE_LABELS: [AbilityName, string][] = [
  ['strength',     'Force'],
  ['dexterity',    'Dextérité'],
  ['constitution', 'Constitution'],
  ['intelligence', 'Intelligence'],
  ['wisdom',       'Sagesse'],
  ['charisma',     'Charisme'],
]

const CONDITIONS = CONDITIONS_FR

// ── Helpers ───────────────────────────────────────────────────────────────────

function sign(n: number) {
  return n >= 0 ? `+${n}` : `${n}`
}

function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}

function parseDice(str: string): { count: number; sides: number; bonus: number } | null {
  const m = str.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i)
  if (!m) return null
  return { count: parseInt(m[1]), sides: parseInt(m[2]), bonus: parseInt(m[3] ?? '0') }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-stone-800 rounded-xl py-3 px-4 text-center">
      <p className="text-stone-400 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-white font-bold text-xl mt-0.5">{value}</p>
    </div>
  )
}

function SaveDots({
  label,
  count,
  color,
  onSet,
  disabled,
}: {
  label: string
  count: number
  color: string
  onSet: (n: number) => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-stone-400 text-sm w-20">{label}</span>
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => onSet(i < count ? i : i + 1)}
            className={`w-7 h-7 rounded-full border-2 transition-colors disabled:cursor-not-allowed ${
              i < count
                ? `${color} border-transparent`
                : 'bg-transparent border-stone-600 hover:border-stone-400'
            }`}
          />
        ))}
      </div>
      <span className="text-stone-500 text-sm">{count}/3</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CharacterPage() {
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()

  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const importRef = useRef<HTMLInputElement>(null)

  // Flag set to true while we're the originator of a mutation; suppresses
  // the echo of our own broadcast so we don't overwrite optimistic state.
  const isSelfUpdate = useRef(false)

  const [hpInput, setHpInput]         = useState('')
  const [tempInput, setTempInput]     = useState('')
  const hpRef  = useRef<HTMLInputElement>(null)
  const tempRef = useRef<HTMLInputElement>(null)

  // ── Identity draft ───────────────────────────────────────────────────────────
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [identityDraft, setIdentityDraft] = useState<IdentityPayload>({})

  function startEditIdentity() {
    if (!character) return
    setIdentityDraft({
      name: character.name,
      portrait_url: character.portrait_url ?? '',
      race: character.race,
      character_class: character.character_class,
      subclass: character.subclass ?? '',
      secondary_class: character.secondary_class ?? '',
      secondary_level: character.secondary_level ?? undefined,
      level: character.level,
      background: character.background ?? '',
      alignment: character.alignment ?? '',
      experience_points: character.experience_points,
      speed: character.combat.speed,
      max_hp: character.combat.max_hp,
      armor_class: character.combat.armor_class,
      hit_dice_type: character.combat.hit_dice_type,
    })
    setEditingIdentity(true)
  }

  async function saveIdentity() {
    if (!character) return
    const payload: IdentityPayload = {
      ...identityDraft,
      subclass: identityDraft.subclass?.trim() || null,
      background: identityDraft.background?.trim() || null,
      alignment: identityDraft.alignment?.trim() || null,
      secondary_class: identityDraft.secondary_class?.trim() || null,
      secondary_level: identityDraft.secondary_class?.trim() ? (identityDraft.secondary_level ?? null) : null,
    }
    const updated = await withSave(() => updateIdentity(character.id, payload))
    if (updated) { setCharacter(updated); setEditingIdentity(false) }
  }

  type AbilityDraft = Record<AbilityName, string>
  const ABILITY_KEYS: AbilityName[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
  const emptyDraft = (): AbilityDraft =>
    Object.fromEntries(ABILITY_KEYS.map(k => [k, ''])) as AbilityDraft

  const [editingAbilities, setEditingAbilities] = useState(false)
  const [abilityDraft, setAbilityDraft] = useState<AbilityDraft>(emptyDraft)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getCharacter(Number(id))
      .then(setCharacter)
      .catch(() => navigate('/characters'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (!id || !token || !REALTIME_CONFIGURED) return
    const echo = createEcho(token)
    echo
      .private(`character.${id}`)
      .listen('.character.updated', (e: { character: Character }) => {
        if (isSelfUpdate.current) return
        setCharacter(e.character)
      })
    return () => {
      echo.leave(`character.${id}`)
      echo.disconnect()
    }
  }, [id, token])

  // Sync temp HP input with loaded character
  useEffect(() => {
    if (character) setTempInput(String(character.combat.temporary_hp))
  }, [character?.id])  // only on first load

  const { notify } = useTabNotify()

  interface CombatEntry { id: string; name: string; currentHp: number; maxHp: number; isActive: boolean; faction: string }
  const [combatState, setCombatState] = useState<{ order: CombatEntry[]; round: number } | null>(null)

  // Blink tab title + receive combat order via BroadcastChannel
  useEffect(() => {
    if (!character) return
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel('taverne-combat-turn')
      bc.onmessage = (e: MessageEvent<{ characterId?: number; name: string; combatOrder?: CombatEntry[]; round?: number }>) => {
        if (e.data.characterId === character.id) {
          notify(`🔔 Ton tour, ${character.name} !`)
        }
        if (e.data.combatOrder) {
          setCombatState({ order: e.data.combatOrder, round: e.data.round ?? 1 })
        }
      }
    } catch { /* unsupported */ }
    return () => bc?.close()
  }, [character?.id])

  async function withSave<T>(fn: () => Promise<T>): Promise<T | undefined> {
    isSelfUpdate.current = true
    setSaving(true)
    try {
      return await fn()
    } catch (e) {
      // Un échec de sauvegarde doit se voir : sinon le joueur croit sa modification
      // enregistrée, quitte la page, et la perd.
      toast.error(e instanceof ApiError ? e.message : "La modification n'a pas pu être enregistrée.")
    } finally {
      setSaving(false)
      // Give the broadcast a tick to arrive before we clear the flag
      setTimeout(() => { isSelfUpdate.current = false }, 500)
    }
  }

  function handleExport() {
    if (!character) return
    const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${character.name.replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportMarkdown() {
    if (!character) return
    const lines: string[] = []
    lines.push(`# ${character.name}`)
    const parts = [`**Classe :** ${character.character_class} ${character.level}`]
    if (character.race) parts.push(`**Race :** ${character.race}`)
    if (character.background) parts.push(`**Historique :** ${character.background}`)
    lines.push(parts.join(' · '))
    lines.push('')

    lines.push('## Points de vie')
    lines.push(`PV ${character.combat.current_hp} / ${character.combat.max_hp}${character.combat.temporary_hp ? ` (+${character.combat.temporary_hp} tmp)` : ''}`)
    lines.push('')

    lines.push('## Caractéristiques')
    for (const [key, abbr] of ABILITY_LABELS) {
      const ab = character.abilities[key] ?? 10
      lines.push(`- **${abbr}** ${ab} (${sign(character.modifiers[key])})`)
    }
    lines.push('')

    lines.push('## Jets de sauvegarde')
    for (const [ability, label] of SAVE_LABELS) {
      const save = character.saving_throws[ability]
      lines.push(`- ${save.proficient ? '●' : '○'} **${label}** ${sign(save.modifier)}`)
    }
    lines.push('')

    if (character.inventory.items.length > 0) {
      lines.push('## Inventaire')
      for (const item of character.inventory.items) {
        const tags = [item.equipped && '⬤ équipé', item.magical && '✦ magique', item.attuned && '◈ accordé'].filter(Boolean).join(' ')
        lines.push(`- ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}${tags ? ` — ${tags}` : ''}`)
      }
      lines.push('')
    }

    if (character.spellcasting.spells.length > 0) {
      lines.push('## Sorts')
      const byLevel = new Map<number, typeof character.spellcasting.spells>()
      for (const s of character.spellcasting.spells) {
        if (!byLevel.has(s.level)) byLevel.set(s.level, [])
        byLevel.get(s.level)!.push(s)
      }
      for (const [lvl, spells] of [...byLevel.entries()].sort(([a], [b]) => a - b)) {
        lines.push(`### ${SPELL_LEVEL_LABELS[lvl] ?? `Niveau ${lvl}`}`)
        for (const s of spells) lines.push(`- ${s.prepared ? '✓' : '○'} ${s.name}`)
      }
      lines.push('')
    }

    if (character.features.length > 0) {
      lines.push('## Capacités')
      for (const f of character.features) {
        lines.push(`### ${f.name}${f.source ? ` *(${f.source})*` : ''}`)
        if (f.description) { lines.push(f.description); lines.push('') }
      }
    }

    const md = lines.join('\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${character.name.replace(/\s+/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportFile(file: File) {
    if (!character) return
    setImportStatus('loading')
    try {
      const text = await file.text()
      const data: Character = JSON.parse(text)
      isSelfUpdate.current = true
      await Promise.all([
        updateIdentity(character.id, {
          name: data.name,
          portrait_url: data.portrait_url,
          race: data.race,
          character_class: data.character_class,
          subclass: data.subclass,
          level: data.level,
          background: data.background,
          alignment: data.alignment,
          experience_points: data.experience_points,
          speed: data.combat.speed,
          max_hp: data.combat.max_hp,
          armor_class: data.combat.armor_class,
          hit_dice_type: data.combat.hit_dice_type,
        }),
        updateAbilities(character.id, data.abilities as Record<AbilityName, number>),
        updateProficiencies(
          character.id,
          Object.entries(data.saving_throws).filter(([, v]) => v.proficient).map(([k]) => k),
          Object.entries(data.skills).filter(([, v]) => v.proficient).map(([k]) => k),
          Object.entries(data.skills).filter(([, v]) => v.expert).map(([k]) => k),
        ),
        updateInventory(character.id, data.inventory.items),
        updateSpells(character.id, data.spellcasting.spells, data.spellcasting.ability),
        updateSpellSlots(character.id, data.spellcasting.slots),
        updateAttackMacros(character.id, data.attack_macros),
        updateFeatures(character.id, data.features),
        updateResources(character.id, data.resources),
        updateCurrency(character.id, data.currency),
        updateDamageModifiers(character.id, data.damage_modifiers),
        updateNotes(character.id, data.notes ?? ''),
        updatePersonality(character.id, {
          personality_traits: data.personality_traits,
          ideals: data.ideals,
          bonds: data.bonds,
          flaws: data.flaws,
        }),
        updateLanguagesAndTools(character.id, {
          languages: data.languages,
          tool_proficiencies: data.tool_proficiencies,
        }),
        updateExhaustion(character.id, data.state.exhaustion_level),
      ])
      const refreshed = await getCharacter(character.id)
      setCharacter(refreshed)
      setImportStatus('done')
      setTimeout(() => { setImportStatus('idle'); isSelfUpdate.current = false }, 3000)
    } catch {
      setImportStatus('error')
      setTimeout(() => { setImportStatus('idle'); isSelfUpdate.current = false }, 3000)
    }
  }

  async function handleHp(type: 'damage' | 'heal') {
    const amount = parseInt(hpInput, 10)
    if (!amount || amount <= 0 || !character) return
    const isConcentrating = !!character.state.concentrating_on
    const updated = await withSave(() => updateHp(character.id, amount, type))
    if (updated) {
      setCharacter(updated)
      setHpInput('')
      if (type === 'damage' && isConcentrating) setConcSaveDmg(String(amount))
    }
  }

  async function handleTempHp() {
    const amount = parseInt(tempInput, 10)
    if (isNaN(amount) || amount < 0 || !character) return
    const updated = await withSave(() => updateHp(character.id, amount, 'temporary'))
    if (updated) setCharacter(updated)
  }

  // ── Durées de conditions ─────────────────────────────────────────────────────

  const [conditionDurationDraft, setConditionDurationDraft] = useState<Record<string, string>>({})

  async function toggleCondition(key: string) {
    if (!character) return
    const active = character.state.conditions
    const durations = { ...character.state.condition_durations }
    let next: string[]
    if (active.includes(key)) {
      next = active.filter(c => c !== key)
      delete durations[key]
    } else {
      next = [...active, key]
    }
    const updated = await withSave(() => updateConditions(character.id, next, durations))
    if (updated) setCharacter(updated)
  }

  async function handleSetConditionDuration(key: string) {
    if (!character) return
    const val = parseInt(conditionDurationDraft[key] ?? '', 10)
    if (isNaN(val) || val < 0) return
    const durations = { ...character.state.condition_durations, [key]: val }
    const updated = await withSave(() => updateConditions(character.id, character.state.conditions, durations))
    if (updated) setCharacter(updated)
  }

  async function handleDeathSave(type: 'successes' | 'failures', value: number) {
    if (!character) return
    const s = type === 'successes' ? value : character.state.death_saves_successes
    const f = type === 'failures'  ? value : character.state.death_saves_failures
    const updated = await withSave(() => updateDeathSaves(character.id, s, f))
    if (updated) setCharacter(updated)
  }

  function startEditAbilities() {
    if (!character) return
    setAbilityDraft(
      Object.fromEntries(
        ABILITY_KEYS.map(k => [k, character.abilities[k] != null ? String(character.abilities[k]) : '']),
      ) as AbilityDraft,
    )
    setEditingAbilities(true)
  }

  async function saveAbilities() {
    if (!character) return
    const payload: Partial<Record<AbilityName, number>> = {}
    for (const k of ABILITY_KEYS) {
      const n = parseInt(abilityDraft[k], 10)
      if (!isNaN(n) && n >= 1 && n <= 30) payload[k] = n
    }
    const updated = await withSave(() => updateAbilities(character.id, payload))
    if (updated) {
      setCharacter(updated)
      setEditingAbilities(false)
    }
  }

  async function toggleSaveProficiency(ability: AbilityName) {
    if (!character) return
    const current = Object.entries(character.saving_throws)
      .filter(([, v]) => v.proficient)
      .map(([k]) => k)
    const next = current.includes(ability)
      ? current.filter(a => a !== ability)
      : [...current, ability]
    const skillProfs = Object.entries(character.skills)
      .filter(([, v]) => v.proficient)
      .map(([k]) => k)
    const updated = await withSave(() => updateProficiencies(character.id, next, skillProfs))
    if (updated) setCharacter(updated)
  }

  async function toggleSkillProficiency(skill: SkillName) {
    if (!character) return
    const saveProfs = Object.entries(character.saving_throws)
      .filter(([, v]) => v.proficient)
      .map(([k]) => k)
    const current = Object.entries(character.skills)
      .filter(([, v]) => v.proficient)
      .map(([k]) => k)
    const removing = current.includes(skill)
    const next = removing ? current.filter(s => s !== skill) : [...current, skill]
    const currentExpertise = Object.entries(character.skills)
      .filter(([, v]) => v.expert)
      .map(([k]) => k)
    const nextExpertise = removing ? currentExpertise.filter(s => s !== skill) : currentExpertise
    const updated = await withSave(() => updateProficiencies(character.id, saveProfs, next, nextExpertise))
    if (updated) setCharacter(updated)
  }

  async function toggleSkillExpertise(skill: SkillName) {
    if (!character) return
    if (!character.skills[skill].proficient) return
    const saveProfs = Object.entries(character.saving_throws)
      .filter(([, v]) => v.proficient)
      .map(([k]) => k)
    const skillProfs = Object.entries(character.skills)
      .filter(([, v]) => v.proficient)
      .map(([k]) => k)
    const currentExpertise = Object.entries(character.skills)
      .filter(([, v]) => v.expert)
      .map(([k]) => k)
    const nextExpertise = currentExpertise.includes(skill)
      ? currentExpertise.filter(s => s !== skill)
      : [...currentExpertise, skill]
    const updated = await withSave(() => updateProficiencies(character.id, saveProfs, skillProfs, nextExpertise))
    if (updated) setCharacter(updated)
  }

  // ── Spell slot configuration state ──────────────────────────────────────────

  type SlotDraft = Record<string, { max: string; used: string }>
  const [editingSlots, setEditingSlots] = useState(false)
  const [slotDraft, setSlotDraft] = useState<SlotDraft>({})
  const [abilityDraftSpell, setAbilityDraftSpell] = useState<AbilityName | ''>('')

  function startEditSlots() {
    if (!character) return
    const draft: SlotDraft = {}
    for (let lvl = 1; lvl <= 9; lvl++) {
      const s = character.spellcasting.slots[String(lvl)]
      if (s) draft[String(lvl)] = { max: String(s.max), used: String(s.used) }
    }
    setSlotDraft(draft)
    setAbilityDraftSpell(character.spellcasting.ability ?? '')
    setEditingSlots(true)
  }

  async function saveSlotConfig() {
    if (!character) return
    const slots: Record<string, SpellSlot> = {}
    for (const [lvl, v] of Object.entries(slotDraft)) {
      const max = parseInt(v.max, 10)
      const used = parseInt(v.used, 10)
      if (max > 0) slots[lvl] = { max, used: isNaN(used) ? 0 : Math.min(used, max) }
    }
    const ability = abilityDraftSpell || null
    const updated = await withSave(() =>
      updateSpellSlots(character.id, slots, ability as AbilityName | null),
    )
    if (updated) { setCharacter(updated); setEditingSlots(false) }
  }

  async function handleUseSlot(level: number, action: 'use' | 'restore') {
    if (!character) return
    const updated = await withSave(() => useSpellSlot(character.id, level, action))
    if (updated) setCharacter(updated)
  }

  async function handleLongRest() {
    if (!character) return
    const updated = await withSave(() => longRest(character.id))
    if (updated) setCharacter(updated)
  }

  // ── Spell list state ─────────────────────────────────────────────────────────

  const [addingSpell, setAddingSpell] = useState(false)
  const [spellNameDraft, setSpellNameDraft] = useState('')
  const [spellLevelDraft, setSpellLevelDraft] = useState('1')
  const [spellDamageDraft, setSpellDamageDraft] = useState('')
  const [spellNotesDraft, setSpellNotesDraft] = useState('')
  const [editingSpellNotesIdx, setEditingSpellNotesIdx] = useState<number | null>(null)
  const [spellNotesEdit, setSpellNotesEdit] = useState('')
  const [spellFilter, setSpellFilter] = useState<'all' | 'prepared'>('all')
  const [spellSearch, setSpellSearch] = useState('')
  const [spellSortMode, setSpellSortMode] = useState<'default' | 'name' | 'prepared'>('default')
  const [castFeedback, setCastFeedback] = useState<{ name: string; slotLevel: number } | null>(null)
  const [showSpellBrowser, setShowSpellBrowser] = useState(false)
  const [showCompendium, setShowCompendium] = useState(false)
  const [spellBrowserLevel, setSpellBrowserLevel] = useState<number | 'all'>('all')
  const [spellBrowserSearch, setSpellBrowserSearch] = useState('')

  async function handleAddSpell() {
    if (!character || !spellNameDraft.trim()) return
    const lvl = parseInt(spellLevelDraft, 10)
    const newSpell: Spell = {
      name: spellNameDraft.trim(),
      level: isNaN(lvl) ? 0 : lvl,
      prepared: true,
      ...(spellDamageDraft.trim() ? { damage_dice: spellDamageDraft.trim() } : {}),
      ...(spellNotesDraft.trim() ? { notes: spellNotesDraft.trim() } : {}),
    }
    const next = [...character.spellcasting.spells, newSpell]
    const updated = await withSave(() => updateSpells(character.id, next))
    if (updated) {
      setCharacter(updated)
      setSpellNameDraft('')
      setSpellLevelDraft('1')
      setSpellDamageDraft('')
      setSpellNotesDraft('')
      setAddingSpell(false)
    }
  }

  async function handleSaveSpellNotes(idx: number) {
    if (!character) return
    const next = character.spellcasting.spells.map((s, i) =>
      i === idx ? { ...s, notes: spellNotesEdit.trim() || undefined } : s
    )
    const updated = await withSave(() => updateSpells(character.id, next))
    if (updated) { setCharacter(updated); setEditingSpellNotesIdx(null) }
  }

  async function addSpellFromBrowser(name: string, level: number) {
    if (!character) return
    if (character.spellcasting.spells.some(s => s.name === name)) return
    // Les dés de dégâts viennent du SRD : sans eux, le sort n'apparaîtrait jamais
    // comme attaque en combat. Ils restent modifiables à la main ensuite.
    const damage = SPELL_DAMAGE[name]
    const next = [
      ...character.spellcasting.spells,
      { name, level, prepared: true, ...(damage ? { damage_dice: damage } : {}) },
    ]
    const updated = await withSave(() => updateSpells(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleRemoveSpell(index: number) {
    if (!character) return
    const next = character.spellcasting.spells.filter((_, i) => i !== index)
    const updated = await withSave(() => updateSpells(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleTogglePrepared(index: number) {
    if (!character) return
    const next = character.spellcasting.spells.map((s, i) =>
      i === index ? { ...s, prepared: !s.prepared } : s,
    )
    const updated = await withSave(() => updateSpells(character.id, next))
    if (updated) setCharacter(updated)
  }

  // ── Features ──────────────────────────────────────────────────────────────────

  const emptyFeatureDraft = (): Feature => ({ name: '', source: '', description: '' })
  const [addingFeature, setAddingFeature]     = useState(false)
  const [featureDraft, setFeatureDraft]       = useState<Feature>(emptyFeatureDraft)
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null)
  const [editingFeature, setEditingFeature]   = useState<number | null>(null)
  const [editDraft, setEditDraft]             = useState<Feature>(emptyFeatureDraft)
  const [featureSearch, setFeatureSearch]     = useState('')
  const [featureSourceFilter, setFeatureSourceFilter] = useState('all')
  const [macroSearch, setMacroSearch] = useState('')
  const [resourceResetFilter, setResourceResetFilter] = useState<'all' | ClassResource['reset']>('all')
  const [skillSearch, setSkillSearch] = useState('')
  const [skillProfFilter, setSkillProfFilter] = useState<'all' | 'prof' | 'expert'>('all')

  async function handleAddFeature() {
    if (!character || !featureDraft.name.trim()) return
    const next = [...(character.features ?? []), { ...featureDraft, name: featureDraft.name.trim() }]
    const updated = await withSave(() => updateFeatures(character.id, next))
    if (updated) { setCharacter(updated); setAddingFeature(false); setFeatureDraft(emptyFeatureDraft()) }
  }

  async function handleSaveFeature(index: number) {
    if (!character || !editDraft.name.trim()) return
    const next = character.features.map((f, i) => i === index ? { ...editDraft, name: editDraft.name.trim() } : f)
    const updated = await withSave(() => updateFeatures(character.id, next))
    if (updated) { setCharacter(updated); setEditingFeature(null) }
  }

  async function handleDeleteFeature(index: number) {
    if (!character) return
    const next = character.features.filter((_, i) => i !== index)
    const updated = await withSave(() => updateFeatures(character.id, next))
    if (updated) {
      setCharacter(updated)
      if (expandedFeature === index) setExpandedFeature(null)
    }
  }

  // ── Résistances & immunités ──────────────────────────────────────────────────

  async function toggleDamageModifier(
    category: 'resistances' | 'immunities' | 'vulnerabilities',
    type: string,
  ) {
    if (!character) return
    const current = character.damage_modifiers
    const list = current[category]
    const next = list.includes(type) ? list.filter(t => t !== type) : [...list, type]
    const updated = await withSave(() =>
      updateDamageModifiers(character.id, { ...current, [category]: next }),
    )
    if (updated) setCharacter(updated)
  }

  // ── Cast spell (use slot + roll damage) ─────────────────────────────────────

  function availableSlotLevel(spellLevel: number): number | null {
    if (!character || spellLevel === 0) return 0
    for (let lvl = spellLevel; lvl <= 9; lvl++) {
      const slot = character.spellcasting.slots[String(lvl)]
      if (slot && slot.used < slot.max) return lvl
    }
    return null
  }

  async function castSpell(spell: { name: string; level: number; concentration?: boolean; damage_dice?: string }) {
    if (!character) return
    let usedSlot = 0
    if (spell.level > 0) {
      const slotLevel = availableSlotLevel(spell.level)
      if (slotLevel === null) return
      const updated = await withSave(() => useSpellSlot(character.id, slotLevel, 'use'))
      if (!updated) return
      setCharacter(updated)
      usedSlot = slotLevel
    }
    setCastFeedback({ name: spell.name, slotLevel: usedSlot })
    setTimeout(() => setCastFeedback(null), 3000)
    if (spell.damage_dice) {
      const p = parseDice(spell.damage_dice)
      if (p) {
        handleRoll({
          sides: p.sides, count: p.count, modifier: p.bonus,
          label: `Dégâts: ${spell.name}`,
          advantage: advantage === 'adv',
          disadvantage: advantage === 'dis',
        })
        setDiceOpen(true)
      }
    }
    if (spell.concentration) {
      const updated = await withSave(() => updateConcentration(character.id, spell.name))
      if (updated) setCharacter(updated)
    }
  }

  // ── Concentration ────────────────────────────────────────────────────────────

  async function handleConcentrate(spellName: string) {
    if (!character) return
    const next = character.state.concentrating_on === spellName ? null : spellName
    const updated = await withSave(() => updateConcentration(character.id, next))
    if (updated) setCharacter(updated)
  }

  const [concSaveDmg, setConcSaveDmg] = useState('')
  const [concSaveResult, setConcSaveResult] = useState<{
    roll: number; modifier: number; total: number; dc: number; success: boolean
  } | null>(null)

  function handleConcentrationSave() {
    if (!character) return
    const dmg = parseInt(concSaveDmg, 10)
    const dc = dmg > 0 ? Math.max(10, Math.ceil(dmg / 2)) : 10
    const roll = Math.floor(Math.random() * 20) + 1
    const modifier = character.saving_throws.constitution.modifier
    const total = roll + modifier
    setConcSaveResult({ roll, modifier, total, dc, success: total >= dc })
    setConcSaveDmg('')
    setTimeout(() => setConcSaveResult(null), 8000)
  }

  // ── Sorts autocomplete ────────────────────────────────────────────────────────

  const [spellSuggestions, setSpellSuggestions] = useState<[string, number][]>([])

  function handleSpellNameChange(value: string) {
    setSpellNameDraft(value)
    if (value.trim().length < 2) { setSpellSuggestions([]); return }
    const lower = value.toLowerCase()
    setSpellSuggestions(
      SRD_SPELLS.filter(([name]) => name.toLowerCase().includes(lower)).slice(0, 8),
    )
  }

  function selectSpellSuggestion(name: string, level: number) {
    setSpellNameDraft(name)
    setSpellLevelDraft(String(level))
    setSpellSuggestions([])
  }

  // ── Dés de vie ───────────────────────────────────────────────────────────────

  const [hitDiceSpend, setHitDiceSpend] = useState('')
  const [shortRestResult, setShortRestResult] = useState<{
    rolls: number[]
    modifier: number
    total_healed: number
  } | null>(null)

  async function handleShortRest() {
    if (!character) return
    const n = parseInt(hitDiceSpend, 10)
    if (!n || n < 1) return
    const res = await withSave(() => shortRest(character.id, n))
    if (res) {
      setCharacter(res.character)
      setShortRestResult({ rolls: res.rolls, modifier: res.modifier, total_healed: res.total_healed })
      setHitDiceSpend('')
      setTimeout(() => setShortRestResult(null), 6000)
    }
  }

  // ── HP max temporaire ────────────────────────────────────────────────────────

  const [tempMaxInput, setTempMaxInput] = useState('')
  const [showTempMax, setShowTempMax] = useState(false)

  useEffect(() => {
    if (character) {
      setTempMaxInput(String(character.combat.temp_max_hp_bonus ?? 0))
      if ((character.combat.temp_max_hp_bonus ?? 0) > 0) setShowTempMax(true)
    }
  }, [character?.id])

  async function handleTempMaxHp() {
    if (!character) return
    const bonus = parseInt(tempMaxInput, 10)
    if (isNaN(bonus) || bonus < 0) return
    const updated = await withSave(() => updateTempMaxHp(character.id, bonus))
    if (updated) setCharacter(updated)
  }

  // ── Monnaie ──────────────────────────────────────────────────────────────────

  const emptyCurrency = (): Currency => ({ pc: 0, pa: 0, pe: 0, po: 0, pp: 0 })
  const [currencyDraft, setCurrencyDraft] = useState<Currency>(emptyCurrency)

  useEffect(() => {
    if (character) setCurrencyDraft(character.currency ?? emptyCurrency())
  }, [character?.id])

  async function handleSaveCurrency() {
    if (!character) return
    const updated = await withSave(() => updateCurrency(character.id, currencyDraft))
    if (updated) setCharacter(updated)
  }

  // ── Notes ────────────────────────────────────────────────────────────────────

  const [notesDraft, setNotesDraft] = useState('')
  const [notesDirty, setNotesDirty] = useState(false)
  const [notesPreview, setNotesPreview] = useState(false)
  const [dmNotesPreview, setDmNotesPreview] = useState(false)

  useEffect(() => {
    if (character) setNotesDraft(character.notes ?? '')
  }, [character?.id])

  async function handleSaveNotes() {
    if (!character || !notesDirty) return
    const updated = await withSave(() => updateNotes(character.id, notesDraft))
    if (updated) { setCharacter(updated); setNotesDirty(false) }
  }

  // ── Langues & maîtrises d'outils ─────────────────────────────────────────────

  const [languageDraft, setLanguageDraft] = useState('')
  const [toolDraft, setToolDraft]         = useState('')

  async function addLanguage() {
    if (!character || !languageDraft.trim()) return
    const next = [...character.languages, languageDraft.trim()]
    const updated = await withSave(() => updateLanguagesAndTools(character.id, { languages: next }))
    if (updated) { setCharacter(updated); setLanguageDraft('') }
  }

  async function removeLanguage(lang: string) {
    if (!character) return
    const next = character.languages.filter(l => l !== lang)
    const updated = await withSave(() => updateLanguagesAndTools(character.id, { languages: next }))
    if (updated) setCharacter(updated)
  }

  async function addTool() {
    if (!character || !toolDraft.trim()) return
    const next = [...character.tool_proficiencies, toolDraft.trim()]
    const updated = await withSave(() => updateLanguagesAndTools(character.id, { tool_proficiencies: next }))
    if (updated) { setCharacter(updated); setToolDraft('') }
  }

  async function removeTool(tool: string) {
    if (!character) return
    const next = character.tool_proficiencies.filter(t => t !== tool)
    const updated = await withSave(() => updateLanguagesAndTools(character.id, { tool_proficiencies: next }))
    if (updated) setCharacter(updated)
  }

  // ── DM Notes ─────────────────────────────────────────────────────────────────

  const [dmNotesDraft, setDmNotesDraft] = useState('')

  useEffect(() => {
    if (character) setDmNotesDraft(character.dm_notes ?? '')
  }, [character?.id])

  async function handleSaveDmNotes() {
    if (!character) return
    const updated = await withSave(() => updateDmNotes(character.id, dmNotesDraft))
    if (updated) setCharacter(updated)
  }

  // ── Traits de personnalité ────────────────────────────────────────────────────

  const [personalityDraft, setPersonalityDraft] = useState({
    personality_traits: '',
    ideals: '',
    bonds: '',
    flaws: '',
  })

  useEffect(() => {
    if (character) setPersonalityDraft({
      personality_traits: character.personality_traits ?? '',
      ideals:             character.ideals ?? '',
      bonds:              character.bonds ?? '',
      flaws:              character.flaws ?? '',
    })
  }, [character?.id])

  async function handleSavePersonality(field: keyof typeof personalityDraft) {
    if (!character) return
    const updated = await withSave(() => updatePersonality(character.id, { [field]: personalityDraft[field] }))
    if (updated) setCharacter(updated)
  }

  // ── Macros d'attaque ─────────────────────────────────────────────────────────

  interface MacroDraft { name: string; attack_bonus: string; damage_dice: string; damage_type: string; crit_dice: string; range: string; notes: string }
  const emptyMacroDraft = (): MacroDraft => ({ name: '', attack_bonus: '', damage_dice: '', damage_type: '', crit_dice: '', range: '', notes: '' })
  const draftFromMacro = (m: AttackMacro): MacroDraft => ({
    name: m.name,
    attack_bonus: m.attack_bonus !== null ? String(m.attack_bonus) : '',
    damage_dice: m.damage_dice,
    damage_type: m.damage_type ?? '',
    crit_dice: m.crit_dice ?? '',
    range: m.range ?? '',
    notes: m.notes ?? '',
  })
  const [addingMacro, setAddingMacro] = useState(false)
  const [macroDraft, setMacroDraft] = useState<MacroDraft>(emptyMacroDraft)
  const [editingMacroIndex, setEditingMacroIndex] = useState<number | null>(null)
  const [editMacroDraft, setEditMacroDraft] = useState<MacroDraft>(emptyMacroDraft)

  function draftToMacro(d: MacroDraft): AttackMacro {
    return {
      name: d.name.trim(),
      attack_bonus: d.attack_bonus !== '' ? parseInt(d.attack_bonus, 10) : null,
      damage_dice: d.damage_dice.trim(),
      damage_type: d.damage_type.trim() || undefined,
      crit_dice: d.crit_dice.trim() || undefined,
      range: d.range.trim() || undefined,
      notes: d.notes.trim() || undefined,
    }
  }

  async function handleAddMacro() {
    if (!character || !macroDraft.name.trim() || !macroDraft.damage_dice.trim()) return
    const next = [...character.attack_macros, draftToMacro(macroDraft)]
    const updated = await withSave(() => updateAttackMacros(character.id, next))
    if (updated) { setCharacter(updated); setMacroDraft(emptyMacroDraft()); setAddingMacro(false) }
  }

  async function handleSaveMacroEdit(index: number) {
    if (!character || !editMacroDraft.name.trim() || !editMacroDraft.damage_dice.trim()) return
    const next = character.attack_macros.map((m, i) => i === index ? draftToMacro(editMacroDraft) : m)
    const updated = await withSave(() => updateAttackMacros(character.id, next))
    if (updated) { setCharacter(updated); setEditingMacroIndex(null) }
  }

  async function handleDeleteMacro(index: number) {
    if (!character) return
    const next = character.attack_macros.filter((_, i) => i !== index)
    const updated = await withSave(() => updateAttackMacros(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleDuplicateMacro(index: number) {
    if (!character) return
    const src = character.attack_macros[index]
    const copy = { ...src, name: `${src.name} (copie)` }
    const next = [...character.attack_macros, copy]
    const updated = await withSave(() => updateAttackMacros(character.id, next))
    if (updated) setCharacter(updated)
  }

  function rollAttackMacro(macro: AttackMacro) {
    const bonus = macro.attack_bonus ?? 0
    handleRoll({ sides: 20, modifier: bonus, label: `Attaque: ${macro.name}`, count: 1 })
  }

  function rollDamageMacro(macro: AttackMacro) {
    const parsed = parseDice(macro.damage_dice)
    if (!parsed) return
    handleRoll({ sides: parsed.sides, count: parsed.count, modifier: parsed.bonus, label: `Dégâts: ${macro.name}` })
  }

  function rollCritMacro(macro: AttackMacro) {
    if (!macro.crit_dice) return
    const parsed = parseDice(macro.crit_dice)
    if (!parsed) return
    handleRoll({ sides: parsed.sides, count: parsed.count, modifier: parsed.bonus, label: `Critique: ${macro.name}` })
  }

  // ── Ressources de classe ─────────────────────────────────────────────────────

  interface ResourceDraft { name: string; max: string; reset: 'short' | 'long' | 'manual' }
  const emptyResourceDraft = (): ResourceDraft => ({ name: '', max: '1', reset: 'long' })
  const [addingResource, setAddingResource] = useState(false)
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft>(emptyResourceDraft)

  async function handleAddResource() {
    if (!character || !resourceDraft.name.trim()) return
    const maxVal = Math.max(0, parseInt(resourceDraft.max, 10) || 0)
    const res: ClassResource = { name: resourceDraft.name.trim(), max: maxVal, current: maxVal, reset: resourceDraft.reset }
    const next = [...character.resources, res]
    const updated = await withSave(() => updateResources(character.id, next))
    if (updated) { setCharacter(updated); setResourceDraft(emptyResourceDraft()); setAddingResource(false) }
  }

  async function handleResourceChange(index: number, delta: number) {
    if (!character) return
    const next = character.resources.map((r, i) =>
      i === index ? { ...r, current: Math.max(0, Math.min(r.max, r.current + delta)) } : r
    )
    const updated = await withSave(() => updateResources(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleDeleteResource(index: number) {
    if (!character) return
    const next = character.resources.filter((_, i) => i !== index)
    const updated = await withSave(() => updateResources(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleDuplicateResource(index: number) {
    if (!character) return
    const src = character.resources[index]
    if (!src) return
    const copy: ClassResource = { ...src, name: `${src.name} (copie)` }
    const next = [...character.resources, copy]
    const updated = await withSave(() => updateResources(character.id, next))
    if (updated) setCharacter(updated)
  }

  // ── Assistant de montée de niveau ─────────────────────────────────────────────

  const [showLevelUp, setShowLevelUp] = useState(false)
  const [hpMethod, setHpMethod] = useState<'max' | 'avg' | 'roll'>('max')
  const [rolledHpGain, setRolledHpGain] = useState<number | null>(null)

  function computeHpGain(): number {
    if (!character) return 0
    const conMod = character.modifiers.constitution
    const diceType = character.combat.hit_dice_type
    if (hpMethod === 'max') return diceType + conMod
    if (hpMethod === 'avg') return Math.floor(diceType / 2 + 1) + conMod
    return (rolledHpGain ?? 0) + conMod
  }

  async function handleLevelUp() {
    if (!character) return
    if (hpMethod === 'roll' && rolledHpGain === null) return
    const gain = Math.max(1, computeHpGain())
    const updated = await withSave(() => updateIdentity(character.id, {
      level: character.level + 1,
      max_hp: character.combat.max_hp + gain,
    }))
    if (updated) { setCharacter(updated); setShowLevelUp(false); setRolledHpGain(null) }
  }

  // ── Inventory ─────────────────────────────────────────────────────────────────

  interface ItemDraft { name: string; quantity: string; weight: string; value: string; notes: string }
  const emptyItemDraft = (): ItemDraft => ({ name: '', quantity: '1', weight: '0', value: '', notes: '' })
  const [addingItem, setAddingItem] = useState(false)
  const [itemDraft, setItemDraft]   = useState<ItemDraft>(emptyItemDraft)
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'equipped' | 'magical' | 'attuned'>('all')
  const [inventorySort, setInventorySort] = useState<'default' | 'name' | 'quantity'>('default')
  const [showItemCompendium, setShowItemCompendium] = useState(false)
  const [compendiumSearch, setCompendiumSearch]     = useState('')
  const [compendiumRarity, setCompendiumRarity]     = useState<ItemRarity | 'toutes'>('toutes')

  async function handleAddItem() {
    if (!character || !itemDraft.name.trim()) return
    const item: InventoryItem = {
      name:     itemDraft.name.trim(),
      quantity: Math.max(1, parseInt(itemDraft.quantity, 10) || 1),
      weight:   parseFloat(itemDraft.weight) || 0,
      value_gp: itemDraft.value.trim() === '' ? null : Math.max(0, parseFloat(itemDraft.value) || 0),
      notes:    itemDraft.notes.trim(),
      equipped: false,
      magical:  false,
    }
    const next = [...character.inventory.items, item]
    const updated = await withSave(() => updateInventory(character.id, next))
    if (updated) { setCharacter(updated); setItemDraft(emptyItemDraft()); setAddingItem(false) }
  }

  async function handleRemoveItem(index: number) {
    if (!character) return
    const next = character.inventory.items.filter((_, i) => i !== index)
    const updated = await withSave(() => updateInventory(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleQtyChange(index: number, delta: number) {
    if (!character) return
    const next = character.inventory.items.map((item, i) =>
      i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item,
    )
    const updated = await withSave(() => updateInventory(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleToggleEquipped(index: number) {
    if (!character) return
    const next = character.inventory.items.map((item, i) =>
      i === index ? { ...item, equipped: !item.equipped } : item,
    )
    const updated = await withSave(() => updateInventory(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleToggleMagical(index: number) {
    if (!character) return
    const next = character.inventory.items.map((item, i) =>
      i === index ? { ...item, magical: !item.magical, attuned: !item.magical ? item.attuned : false } : item,
    )
    const updated = await withSave(() => updateInventory(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleToggleAttuned(index: number) {
    if (!character) return
    const item = character.inventory.items[index]
    if (!item.magical) return
    const attunedCount = character.inventory.items.filter(it => it.attuned).length
    if (!item.attuned && attunedCount >= 3) return
    const next = character.inventory.items.map((it, i) =>
      i === index ? { ...it, attuned: !it.attuned } : it,
    )
    const updated = await withSave(() => updateInventory(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleDuplicateItem(index: number) {
    if (!character) return
    const src = character.inventory.items[index]
    const copy = { ...src, equipped: false, attuned: false }
    const next = [...character.inventory.items, copy]
    const updated = await withSave(() => updateInventory(character.id, next))
    if (updated) setCharacter(updated)
  }

  async function handleAddFromCompendium(magicItem: MagicItem) {
    if (!character) return
    const item: InventoryItem = {
      name:     magicItem.name,
      quantity: 1,
      weight:   0,
      value_gp: null,
      notes:    magicItem.description,
      equipped: false,
      magical:  true,
      attuned:  false,
    }
    const next = [...character.inventory.items, item]
    const updated = await withSave(() => updateInventory(character.id, next))
    if (updated) setCharacter(updated)
  }

  // ── Dice panel ───────────────────────────────────────────────────────────────

  const [diceOpen, setDiceOpen]         = useState(false)
  const [rollHistory, setRollHistory]   = useState<DiceRoll[]>([])
  const [selectedSides, setSelectedSides] = useState(20)
  const [diceModInput, setDiceModInput] = useState('')
  const [advantage, setAdvantage]       = useState<'none' | 'adv' | 'dis'>('none')
  const [lastRoll, setLastRoll]         = useState<DiceRoll | null>(null)

  // WS: also capture dice.rolled events
  useEffect(() => {
    if (!id || !token || !REALTIME_CONFIGURED) return
    const echo = createEcho(token)
    echo.private(`character.${id}`).listen('.dice.rolled', (e: DiceRoll) => {
      setRollHistory(h => [e, ...h].slice(0, 30))
      setLastRoll(e)
    })
    return () => {
      echo.leave(`character.${id}`)
      echo.disconnect()
    }
  }, [id, token])

  async function handleRoll(params: {
    sides: number
    count?: number
    modifier?: number
    label?: string
    advantage?: boolean
    disadvantage?: boolean
  }) {
    if (!character) return
    const result = await rollDice(character.id, params)
    setRollHistory(h => [result, ...h].slice(0, 30))
    setLastRoll(result)
  }

  function quickRoll(label: string, sides: number, modifier: number) {
    handleRoll({
      sides,
      modifier,
      label,
      count: 1,
      advantage: sides === 20 && advantage === 'adv',
      disadvantage: sides === 20 && advantage === 'dis',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!character) return null

  const isDying   = character.combat.current_hp <= 0
  const hpPct     = Math.max(0, Math.min(100, (character.combat.current_hp / character.combat.max_hp) * 100))
  const activeConditions = character.state.conditions

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={character.campaign_id ? `/characters?campaign=${character.campaign_id}` : '/characters'}
              className="text-stone-400 hover:text-stone-200 transition-colors text-sm shrink-0"
            >
              ← Retour
            </Link>
            <span className="text-stone-700">|</span>
            <span className="text-amber-400 font-display font-semibold tracking-wide truncate">{character.name}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {saving && (
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            )}
            {advantage !== 'none' && (
              <button
                onClick={() => setAdvantage('none')}
                title="Annuler l'avantage/désavantage"
                className={`text-xs font-bold px-2 py-1 rounded-lg border transition-colors ${
                  advantage === 'adv'
                    ? 'bg-emerald-700 border-emerald-600 text-white'
                    : 'bg-red-800 border-red-700 text-white'
                }`}
              >
                {advantage === 'adv' ? 'AVT' : 'DES'}
              </button>
            )}
            <button
              onClick={async () => {
                let c = character
                if (!c.share_token) {
                  c = await shareCharacter(c.id)
                  setCharacter(c)
                }
                const url = `${window.location.origin}/share/character/${c.share_token}`
                try {
                  await navigator.clipboard.writeText(url)
                } catch {
                  const el = document.createElement('textarea')
                  el.value = url
                  document.body.appendChild(el)
                  el.select()
                  document.execCommand('copy')
                  document.body.removeChild(el)
                }
                setShareCopied(true)
                setTimeout(() => setShareCopied(false), 2500)
              }}
              className={`text-sm transition-colors hidden sm:block ${
                shareCopied ? 'text-emerald-400' : 'text-stone-400 hover:text-stone-200'
              }`}
              title={character.share_token ? 'Copier le lien joueur' : 'Générer et copier le lien joueur'}
            >
              {shareCopied ? '✓ Lien copié' : '⟳ Partager'}
            </button>
            <button
              onClick={handleExport}
              className="text-stone-400 hover:text-stone-200 text-sm transition-colors hidden sm:block"
              title="Télécharger la fiche en JSON"
            >
              ↓ JSON
            </button>
            <button
              onClick={handleExportMarkdown}
              className="text-stone-400 hover:text-stone-200 text-sm transition-colors hidden sm:block"
              title="Télécharger la fiche en Markdown"
            >
              ↓ Markdown
            </button>
            <button
              onClick={() => importRef.current?.click()}
              disabled={importStatus === 'loading'}
              className={`text-sm transition-colors hidden sm:block ${
                importStatus === 'done'  ? 'text-emerald-400' :
                importStatus === 'error' ? 'text-red-400' :
                importStatus === 'loading' ? 'text-stone-500' :
                'text-stone-400 hover:text-stone-200'
              }`}
              title="Importer une fiche JSON (écrase les données actuelles)"
            >
              {importStatus === 'done' ? '✓ Importé' : importStatus === 'error' ? '✗ Erreur' : importStatus === 'loading' ? '…' : '↑ Importer'}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { handleImportFile(file); e.target.value = '' }
              }}
            />
            <a
              href={`/characters/${character.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-400 hover:text-stone-200 text-sm transition-colors hidden sm:block"
              title="Ouvrir la fiche imprimable"
            >
              ⎙ Imprimer
            </a>
          </div>
        </div>
      </header>

      {/* Dice panel — fixed bottom overlay */}
      {diceOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-stone-900 border-t border-stone-700 shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <div className="flex gap-6">

              {/* Left: controls */}
              <div className="flex-1 min-w-0 space-y-3">
                {/* Dice type buttons */}
                <div className="flex flex-wrap gap-2">
                  {[4, 6, 8, 10, 12, 20, 100].map(d => (
                    <button
                      key={d}
                      onClick={() => setSelectedSides(d)}
                      className={`w-12 h-10 rounded-lg border font-bold text-sm transition-colors ${
                        selectedSides === d
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-500'
                      }`}
                    >
                      d{d}
                    </button>
                  ))}
                </div>

                {/* Modifier + advantage row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 text-xs">Modif.</span>
                    <input
                      type="number"
                      value={diceModInput}
                      onChange={e => setDiceModInput(e.target.value)}
                      placeholder="0"
                      className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-rose-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  {selectedSides === 20 && (
                    <div className="flex gap-1">
                      {(['none', 'adv', 'dis'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setAdvantage(mode)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                            advantage === mode
                              ? mode === 'adv'
                                ? 'bg-emerald-700 border-emerald-600 text-white'
                                : mode === 'dis'
                                  ? 'bg-red-800 border-red-700 text-white'
                                  : 'bg-stone-600 border-stone-500 text-white'
                              : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'
                          }`}
                        >
                          {mode === 'none' ? 'Normal' : mode === 'adv' ? 'Avantage' : 'Désavantage'}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => handleRoll({
                      sides: selectedSides,
                      modifier: parseInt(diceModInput, 10) || 0,
                      advantage: advantage === 'adv',
                      disadvantage: advantage === 'dis',
                      label: `1d${selectedSides}`,
                    })}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-lg px-5 py-1.5 transition-colors"
                  >
                    Lancer
                  </button>
                </div>

                {/* Quick rolls */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => quickRoll('Initiative', 20, character.combat.initiative)}
                    className="bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 rounded-lg px-2.5 py-1 text-xs transition-colors"
                  >
                    Initiative {sign(character.combat.initiative)}
                  </button>
                  {SAVE_LABELS.map(([ability, label]) => {
                    const save = character.saving_throws[ability]
                    return (
                      <button
                        key={ability}
                        onClick={() => quickRoll(`Save: ${label}`, 20, save.modifier)}
                        className="bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 rounded-lg px-2.5 py-1 text-xs transition-colors"
                      >
                        {ABILITY_ABBR[ability]} {sign(save.modifier)}
                      </button>
                    )
                  })}
                  {SKILL_LABELS.map(([skill, label]) => {
                    const entry = character.skills[skill]
                    return (
                      <button
                        key={skill}
                        onClick={() => quickRoll(label, 20, entry.modifier)}
                        className="bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 rounded-lg px-2.5 py-1 text-xs transition-colors"
                      >
                        {label} {sign(entry.modifier)}
                      </button>
                    )
                  })}
                  {character.attack_macros.length > 0 && (
                    <>
                      <span className="self-center text-stone-600 text-xs">•</span>
                      {character.attack_macros.map((macro, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          <button
                            onClick={() => rollAttackMacro(macro)}
                            className="bg-rose-900/60 hover:bg-rose-800/60 border border-rose-700/50 text-rose-300 rounded-lg px-2.5 py-1 text-xs transition-colors"
                            title={`Attaque: 1d20${sign(macro.attack_bonus ?? 0)}`}
                          >
                            {macro.name} {sign(macro.attack_bonus ?? 0)}
                          </button>
                          <button
                            onClick={() => rollDamageMacro(macro)}
                            className="bg-orange-900/60 hover:bg-orange-800/60 border border-orange-700/50 text-orange-300 rounded-lg px-2.5 py-1 text-xs transition-colors"
                            title={`Dégâts: ${macro.damage_dice}`}
                          >
                            {macro.damage_dice}
                          </button>
                        </span>
                      ))}
                    </>
                  )}
                  {character.spellcasting.ability && character.spellcasting.spells.some(s => s.damage_dice) && (
                    <>
                      <span className="self-center text-stone-600 text-xs">•</span>
                      {character.spellcasting.ability && (
                        <button
                          onClick={() => quickRoll('Attaque de sort', 20, character.spellcasting.attack_bonus)}
                          className="bg-violet-900/60 hover:bg-violet-800/60 border border-violet-700/50 text-violet-300 rounded-lg px-2.5 py-1 text-xs transition-colors"
                        >
                          Sort {sign(character.spellcasting.attack_bonus)}
                        </button>
                      )}
                      {character.spellcasting.spells.filter(s => s.damage_dice).map((spell, i) => {
                        const p = parseDice(spell.damage_dice!)
                        if (!p) return null
                        return (
                          <button
                            key={i}
                            onClick={() => handleRoll({ sides: p.sides, count: p.count, modifier: p.bonus, label: `Dégâts: ${spell.name}` })}
                            className="bg-indigo-900/60 hover:bg-indigo-800/60 border border-indigo-700/50 text-indigo-300 rounded-lg px-2.5 py-1 text-xs transition-colors"
                            title={spell.name}
                          >
                            {spell.name.length > 12 ? spell.name.slice(0, 10) + '…' : spell.name} {spell.damage_dice}
                          </button>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>

              {/* Right: last result + history */}
              <div className="w-52 shrink-0 flex flex-col gap-2">
                {lastRoll && (
                  <div className="bg-stone-800 rounded-xl p-3 text-center border border-rose-700/40">
                    <p className="text-stone-400 text-xs truncate">{lastRoll.label}</p>
                    <p className="text-rose-300 font-black text-4xl leading-none my-1">{lastRoll.total}</p>
                    <p className="text-stone-500 text-xs">
                      [{lastRoll.rolls.join(', ')}]{lastRoll.modifier !== 0 ? ` ${sign(lastRoll.modifier)}` : ''}
                      {lastRoll.advantage && ' (av.)'}
                      {lastRoll.disadvantage && ' (dés.)'}
                    </p>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto max-h-28 space-y-1">
                  {rollHistory.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs px-1">
                      <span className="text-stone-500 truncate max-w-[100px]">{r.label}</span>
                      <span className={`font-bold ${r.total >= 20 ? 'text-amber-400' : r.total <= 2 ? 'text-red-400' : 'text-white'}`}>
                        {r.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6" style={{ paddingBottom: diceOpen ? '220px' : undefined }}>

        {/* Combat initiative live */}
        {combatState && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Combat — Round {combatState.round}
              </span>
              <button onClick={() => setCombatState(null)} className="text-stone-600 hover:text-stone-400 text-xs transition-colors">✕</button>
            </div>
            <div className="space-y-1.5">
              {combatState.order.map(entry => {
                const hpPct = entry.maxHp > 0 ? (entry.currentHp / entry.maxHp) * 100 : 0
                const barColor = hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500'
                const factionColor = entry.faction === 'allié' ? 'text-emerald-400' : entry.faction === 'ennemi' ? 'text-red-400' : 'text-stone-400'
                return (
                  <div key={entry.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${entry.isActive ? 'bg-amber-900/30 border border-amber-700/40' : 'bg-stone-800/40'}`}>
                    {entry.isActive && <span className="text-amber-400 text-xs">▶</span>}
                    {!entry.isActive && <span className="w-3" />}
                    <span className={`text-sm font-medium flex-1 truncate ${entry.isActive ? 'text-white' : 'text-stone-300'}`}>
                      {entry.name}
                    </span>
                    <span className={`text-xs ${factionColor}`}>
                      {entry.faction === 'allié' ? 'Allié' : entry.faction === 'ennemi' ? 'Ennemi' : 'Neutre'}
                    </span>
                    <div className="w-16 h-1.5 bg-stone-700 rounded-full overflow-hidden shrink-0">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }} />
                    </div>
                    <span className="text-xs text-stone-500 w-12 text-right shrink-0">{entry.currentHp}/{entry.maxHp}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Identity */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          {editingIdentity ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {([
                  ['name', 'Nom', 'text'],
                  ['race', 'Race', 'text'],
                  ['character_class', 'Classe', 'text'],
                  ['subclass', 'Sous-classe', 'text'],
                  ['background', 'Background', 'text'],
                  ['alignment', 'Alignement', 'text'],
                ] as [keyof IdentityPayload, string, string][]).map(([field, label]) => (
                  <div key={field}>
                    <label className="text-stone-500 text-xs mb-1 block">{label}</label>
                    <input
                      type="text"
                      value={(identityDraft[field] ?? '') as string}
                      onChange={e => setIdentityDraft(d => ({ ...d, [field]: e.target.value }))}
                      className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-stone-500 text-xs mb-1 block">Portrait</label>
                <ImagePicker
                  value={(identityDraft.portrait_url ?? '') as string}
                  onChange={url => setIdentityDraft(d => ({ ...d, portrait_url: url || null }))}
                  placeholder="URL du portrait…"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  ['level', 'Niveau', 1, 20],
                  ['experience_points', 'XP', 0, 355000],
                  ['max_hp', 'PV max', 1, 9999],
                  ['armor_class', 'CA', 1, 30],
                  ['speed', 'Vitesse (m)', 0, 200],
                ] as [keyof IdentityPayload, string, number, number][]).map(([field, label, min, max]) => (
                  <div key={field}>
                    <label className="text-stone-500 text-xs mb-1 block">{label}</label>
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={(identityDraft[field] ?? '') as number}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10) || 0
                        setIdentityDraft(d => ({ ...d, [field]: val }))
                      }}
                      className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-stone-500 text-xs mb-1 block">Dé de vie</label>
                  <select
                    value={identityDraft.hit_dice_type ?? 8}
                    onChange={e => setIdentityDraft(d => ({ ...d, hit_dice_type: parseInt(e.target.value, 10) }))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    {[4, 6, 8, 10, 12].map(d => (
                      <option key={d} value={d}>d{d}</option>
                    ))}
                  </select>
                  {identityDraft.character_class && HIT_DICE_BY_CLASS[identityDraft.character_class.toLowerCase()] && (
                    <button
                      type="button"
                      onClick={() => setIdentityDraft(d => ({
                        ...d,
                        hit_dice_type: HIT_DICE_BY_CLASS[d.character_class!.toLowerCase()],
                      }))}
                      className="text-amber-500 hover:text-amber-400 text-xs mt-1 transition-colors"
                    >
                      ↺ d{HIT_DICE_BY_CLASS[identityDraft.character_class.toLowerCase()]} suggéré
                    </button>
                  )}
                </div>
              </div>
              {/* Multiclasse */}
              <div className="border-t border-stone-800 pt-3">
                <label className="text-stone-500 text-xs mb-2 block">Multiclasse (optionnel)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-stone-600 text-xs mb-1 block">Classe secondaire</label>
                    <input
                      type="text"
                      placeholder="ex. Guerrier, Mage…"
                      value={identityDraft.secondary_class ?? ''}
                      onChange={e => setIdentityDraft(d => ({ ...d, secondary_class: e.target.value }))}
                      className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-stone-600 text-xs mb-1 block">Niveaux dans cette classe</label>
                    <input
                      type="number"
                      min={1}
                      max={19}
                      placeholder="ex. 3"
                      value={identityDraft.secondary_level ?? ''}
                      onChange={e => setIdentityDraft(d => ({ ...d, secondary_level: parseInt(e.target.value, 10) || undefined }))}
                      className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button onClick={() => setEditingIdentity(false)} className="text-stone-500 hover:text-stone-300 text-sm transition-colors">Annuler</button>
                <button onClick={saveIdentity} disabled={saving} className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40">Enregistrer</button>
              </div>
            </div>
          ) : (
            <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                {character.portrait_url && (
                  <img
                    src={character.portrait_url}
                    alt={character.name}
                    className="w-16 h-16 rounded-full object-cover shrink-0 border-2 border-stone-700"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                )}
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white break-words">{character.name}</h1>
                <p className="text-stone-400 mt-0.5">
                  {character.race} · {character.character_class}
                  {character.subclass && <span className="text-stone-500"> ({character.subclass})</span>}
                  {character.secondary_class && (
                    <span className="text-stone-500"> / {character.secondary_class}{character.secondary_level ? ` Niv.${character.secondary_level}` : ''}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {character.background && (
                    <span className="text-stone-500 text-xs">{character.background}</span>
                  )}
                  {character.alignment && (
                    <span className="text-stone-500 text-xs">{character.alignment}</span>
                  )}
                </div>
                {/* La progression se lit d'un coup d'œil, plutôt qu'un nombre brut. */}
                <div className="mt-3 max-w-xs">
                  <XpBar level={character.level} xp={character.experience_points} />
                </div>
              </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canLevelUp(character.level, character.experience_points) && (
                  <button
                    onClick={() => setShowLevelUp(v => !v)}
                    title={`${xpForNextLevel(character.level)?.toLocaleString()} XP requis pour le niveau ${character.level + 1}`}
                    className="bg-amber-500/20 border border-amber-500/50 text-amber-400 font-bold text-xs rounded-lg px-2.5 py-1.5 animate-pulse hover:animate-none hover:bg-amber-500/30 transition-colors"
                  >
                    ↑ Niveau {character.level + 1} disponible
                  </button>
                )}
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-sm rounded-lg px-3 py-1.5">
                  Niveau {character.level}
                </span>
                <button onClick={startEditIdentity} className="text-stone-600 hover:text-stone-400 text-xs transition-colors">
                  Modifier
                </button>
              </div>
            </div>

            {/* Level-up assistant */}
            {showLevelUp && canLevelUp(character.level, character.experience_points) && (
              <div className="mt-4 pt-4 border-t border-amber-500/20 bg-amber-500/5 rounded-lg p-4 space-y-3">
                <p className="text-amber-400 text-sm font-semibold">
                  Montée de niveau : {character.level} → {character.level + 1}
                </p>
                <div>
                  <p className="text-stone-400 text-xs mb-2">Gain de PV (d{character.combat.hit_dice_type} + {sign(character.modifiers.constitution)} CON)</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['max',  `Maximum (${character.combat.hit_dice_type + character.modifiers.constitution} PV)`],
                      ['avg',  `Moyenne (${Math.floor(character.combat.hit_dice_type / 2 + 1) + character.modifiers.constitution} PV)`],
                      ['roll', 'Lancer le dé'],
                    ] as const).map(([m, label]) => (
                      <button
                        key={m}
                        onClick={() => { setHpMethod(m); setRolledHpGain(null) }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          hpMethod === m
                            ? 'bg-amber-600 border-amber-500 text-white'
                            : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    {hpMethod === 'roll' && (
                      <button
                        onClick={() => setRolledHpGain(Math.floor(Math.random() * character.combat.hit_dice_type) + 1)}
                        className="px-3 py-1.5 rounded-lg border border-rose-700/50 bg-rose-900/40 text-rose-300 text-xs font-medium hover:bg-rose-800/40 transition-colors"
                      >
                        ⚅ {rolledHpGain !== null ? `${rolledHpGain} + ${character.modifiers.constitution} CON = +${Math.max(1, rolledHpGain + character.modifiers.constitution)} PV` : 'Lancer'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleLevelUp}
                    disabled={saving || (hpMethod === 'roll' && rolledHpGain === null)}
                    className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 font-bold text-sm rounded-lg px-5 py-2 transition-colors"
                  >
                    Confirmer la montée de niveau
                  </button>
                  <button
                    onClick={() => setShowLevelUp(false)}
                    className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

          {/* Left — Ability scores */}
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Caractéristiques
              </h2>
              {editingAbilities ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingAbilities(false)}
                    className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveAbilities}
                    disabled={saving}
                    className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    Enregistrer
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditAbilities}
                  className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                >
                  Modifier
                </button>
              )}
            </div>
            <div className="space-y-1">
              {ABILITY_LABELS.map(([key, abbr, label]) => {
                const score = character.abilities[key]
                const draftVal = parseInt(abilityDraft[key], 10)
                const displayScore = editingAbilities && !isNaN(draftVal) ? draftVal : score
                const mod = displayScore != null ? Math.floor((displayScore - 10) / 2) : 0
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2 border-b border-stone-800 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-stone-500 text-xs font-mono w-8">{abbr}</span>
                      <span className="text-stone-300 text-sm">{label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {editingAbilities ? (
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={abilityDraft[key]}
                          onChange={e =>
                            setAbilityDraft(d => ({ ...d, [key]: e.target.value }))
                          }
                          placeholder="—"
                          className="w-14 bg-stone-800 border border-stone-600 rounded px-2 py-0.5 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      ) : (
                        <span className="text-white font-semibold text-sm w-8 text-right">
                          {score ?? '—'}
                        </span>
                      )}
                      <button
                        onClick={() => { quickRoll(label, 20, mod); setDiceOpen(true) }}
                        disabled={editingAbilities}
                        title={`Jet de ${label} (1d20${sign(mod)})`}
                        className={`text-sm font-bold w-8 text-right rounded px-1 py-0.5 transition-colors disabled:cursor-default ${
                          mod > 0
                            ? 'text-emerald-400 hover:bg-stone-800'
                            : mod < 0
                              ? 'text-red-400 hover:bg-stone-800'
                              : 'text-stone-400 hover:bg-stone-800'
                        }`}
                      >
                        {sign(mod)}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-stone-800 flex items-center justify-between">
              <span className="text-stone-400 text-sm">Bonus de maîtrise</span>
              <span className="text-amber-400 font-bold text-sm">{sign(character.proficiency_bonus)}</span>
            </div>

            {/* Saving throws */}
            <div className="mt-4 pt-4 border-t border-stone-800">
              <h3 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">
                Jets de sauvegarde
              </h3>
              <div className="space-y-1">
                {SAVE_LABELS.map(([ability, label]) => {
                  const save = character.saving_throws[ability]
                  return (
                    <div key={ability} className="flex items-center justify-between py-1 group">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSaveProficiency(ability)}
                          disabled={saving}
                          title={save.proficient ? 'Retirer la maîtrise' : 'Ajouter la maîtrise'}
                          className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors disabled:cursor-not-allowed ${
                            save.proficient
                              ? 'bg-amber-400 border-amber-400'
                              : 'bg-transparent border-stone-600 hover:border-stone-400'
                          }`}
                        />
                        <span className="text-stone-300 text-xs">{label}</span>
                      </div>
                      <button
                        onClick={() => { quickRoll(`Save: ${label}`, 20, save.modifier); setDiceOpen(true) }}
                        className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-stone-800 transition-colors"
                        title={`Lancer ${label}`}
                      >
                        <span className="text-stone-500 text-xs font-mono">{ABILITY_ABBR[ability]}</span>
                        <span className={`text-xs font-bold w-7 text-right ${
                          save.modifier > 0 ? 'text-emerald-400' : save.modifier < 0 ? 'text-red-400' : 'text-stone-400'
                        }`}>
                          {sign(save.modifier)}
                        </span>
                        <span className="text-stone-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">🎲</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Passive perception */}
            <div className="mt-3 pt-3 border-t border-stone-800 flex items-center justify-between">
              <span className="text-stone-400 text-xs">Perception passive</span>
              <span className="text-stone-200 font-semibold text-sm">{character.passive_perception}</span>
            </div>
          </div>

          {/* Right — Combat + Conditions + Death saves */}
          <div className="space-y-4">

            {/* Combat stats — deux par ligne sur mobile : « Inspiration » ne tient pas en quatre. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox label="CA" value={character.combat.armor_class} />
              <StatBox label="Initiative" value={sign(character.combat.initiative)} />
              <StatBox label="Vitesse" value={`${character.combat.speed ?? 9}m`} />
              <StatBox label="Inspiration" value={character.combat.inspiration ? '✦' : '—'} />
            </div>

            {/* HP management */}
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-4">
                Points de vie
              </h2>

              {/* HP bar */}
              <div className="mb-4">
                <div className="flex items-end justify-between mb-2">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-3xl font-bold ${isDying ? 'text-red-400' : 'text-white'}`}
                    >
                      {character.combat.current_hp}
                    </span>
                    <span className="text-stone-500 text-lg">/ {character.combat.max_hp}</span>
                  </div>
                  {character.combat.temporary_hp > 0 && (
                    <span className="text-sky-400 text-sm font-semibold">
                      +{character.combat.temporary_hp} tmp
                    </span>
                  )}
                </div>
                <div className="h-3 bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${hpColor(character.combat.current_hp, character.combat.max_hp)}`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              </div>

              {/* Damage / Heal — `min-w-0` sur le champ : un input ne rétrécit pas sous sa
                  taille intrinsèque, et poussait « Soigner » hors de l'écran. */}
              <div className="flex flex-wrap gap-2">
                <input
                  ref={hpRef}
                  type="number"
                  min={1}
                  value={hpInput}
                  onChange={e => setHpInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleHp('damage')
                  }}
                  placeholder="Montant"
                  className="flex-1 min-w-0 basis-32 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={() => handleHp('damage')}
                  disabled={saving || !hpInput}
                  className="bg-red-900/60 hover:bg-red-800/60 border border-red-700/50 text-red-300 font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  Blesser
                </button>
                <button
                  onClick={() => handleHp('heal')}
                  disabled={saving || !hpInput}
                  className="bg-emerald-900/60 hover:bg-emerald-800/60 border border-emerald-700/50 text-emerald-300 font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  Soigner
                </button>
              </div>

              {/* Temporary max HP bonus */}
              {showTempMax ? (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-stone-400 text-sm shrink-0">Bonus PV max</span>
                  <input
                    type="number"
                    min={0}
                    value={tempMaxInput}
                    onChange={e => setTempMaxInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleTempMaxHp() }}
                    className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    onClick={handleTempMaxHp}
                    disabled={saving}
                    className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors disabled:opacity-40"
                  >
                    Définir
                  </button>
                  <button
                    onClick={() => { setShowTempMax(false); setTempMaxInput('0'); updateTempMaxHp(character.id, 0) }}
                    className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTempMax(true)}
                  className="mt-2 text-stone-600 hover:text-stone-400 text-xs transition-colors"
                >
                  + Bonus PV max temporaire
                </button>
              )}

              {/* Concentration banner */}
              {character.state.concentrating_on && (
                <div className="mt-3 bg-violet-950/50 border border-violet-700/50 rounded-lg px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-violet-400 text-xs shrink-0">⊙ Concentration</span>
                      <span className="text-violet-200 text-sm font-medium truncate">
                        {character.state.concentrating_on}
                      </span>
                    </div>
                    <button
                      onClick={() => handleConcentrate(character.state.concentrating_on!)}
                      disabled={saving}
                      className="text-violet-500 hover:text-violet-300 text-xs shrink-0 transition-colors disabled:opacity-40"
                      title="Relâcher la concentration"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Concentration save */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-violet-500 text-xs">
                      Jet CON {sign(character.saving_throws.constitution.modifier)}
                    </span>
                    <input
                      type="number"
                      min={1}
                      placeholder="Dégâts reçus"
                      value={concSaveDmg}
                      onChange={e => setConcSaveDmg(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleConcentrationSave() }}
                      className="w-28 bg-violet-900/40 border border-violet-700/50 rounded px-2 py-1 text-violet-200 text-xs focus:outline-none focus:border-violet-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={handleConcentrationSave}
                      className="bg-violet-700/40 hover:bg-violet-700/60 border border-violet-600/50 text-violet-200 text-xs rounded px-2.5 py-1 transition-colors"
                    >
                      Lancer
                    </button>
                    {concSaveResult && (
                      <span className={`text-xs font-semibold ${concSaveResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {concSaveResult.total} vs DD {concSaveResult.dc} — {concSaveResult.success ? 'Réussi ✓' : 'Raté ✗'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Temporary HP */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-stone-400 text-sm shrink-0">PV temporaires</span>
                <input
                  ref={tempRef}
                  type="number"
                  min={0}
                  value={tempInput}
                  onChange={e => setTempInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTempHp() }}
                  className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-sky-500 transition-colors"
                />
                <button
                  onClick={handleTempHp}
                  disabled={saving}
                  className="text-sky-400 hover:text-sky-300 text-sm transition-colors disabled:opacity-40"
                >
                  Définir
                </button>
              </div>
            </div>

            {/* Dés de vie */}
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                  Dés de vie
                </h2>
                <span className="text-stone-400 text-xs">
                  {character.combat.hit_dice_remaining}/{character.combat.hit_dice_max} d{character.combat.hit_dice_type}
                </span>
              </div>

              {/* Pip track */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: character.combat.hit_dice_max }, (_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2.5 rounded-full transition-colors ${
                      i < character.combat.hit_dice_remaining ? 'bg-teal-500' : 'bg-stone-700'
                    }`}
                  />
                ))}
              </div>

              {/* Repos court */}
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={character.combat.hit_dice_remaining}
                  value={hitDiceSpend}
                  onChange={e => setHitDiceSpend(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleShortRest() }}
                  placeholder="Dés"
                  disabled={character.combat.hit_dice_remaining === 0}
                  className="w-20 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-teal-500 transition-colors disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={handleShortRest}
                  disabled={saving || !hitDiceSpend || character.combat.hit_dice_remaining === 0}
                  className="bg-teal-900/60 hover:bg-teal-800/60 border border-teal-700/50 text-teal-300 font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  Repos court
                </button>
              </div>

              {shortRestResult && (
                <p className="text-teal-400 text-xs mt-2 animate-pulse">
                  +{shortRestResult.total_healed} PV
                  {' '}({shortRestResult.rolls.join(' + ')}
                  {shortRestResult.modifier !== 0 && ` + ${shortRestResult.modifier}×${shortRestResult.rolls.length} CON`})
                </p>
              )}
            </div>

            {/* Conditions */}
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-4">
                Conditions
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {Object.entries(CONDITIONS).map(([key]) => {
                  const active = activeConditions.includes(key)
                  const duration = character.state.condition_durations[key]
                  return (
                    <ConditionTag
                      key={key}
                      condition={key}
                      active={active}
                      duration={duration}
                      disabled={saving}
                      onClick={() => toggleCondition(key)}
                      className={`relative rounded-lg px-2 py-2 text-xs font-medium text-center transition-colors disabled:cursor-not-allowed w-full ${
                        active
                          ? 'bg-purple-600 border border-purple-500 text-white'
                          : 'bg-stone-800 border border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300'
                      }`}
                    />
                  )
                })}
              </div>
              {/* Duration inputs for active conditions */}
              {activeConditions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-800 flex flex-wrap gap-2">
                  {activeConditions.map(key => (
                    <div key={key} className="flex items-center gap-1.5 bg-stone-800 rounded-lg px-2 py-1">
                      <span className="text-purple-300 text-xs">{CONDITIONS[key]}</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="∞"
                        value={conditionDurationDraft[key] ?? (character.state.condition_durations[key] > 0 ? String(character.state.condition_durations[key]) : '')}
                        onChange={e => setConditionDurationDraft(d => ({ ...d, [key]: e.target.value }))}
                        onBlur={() => handleSetConditionDuration(key)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSetConditionDuration(key) }}
                        className="w-12 bg-stone-700 border border-stone-600 rounded px-1 py-0.5 text-white text-xs text-center focus:outline-none focus:border-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-stone-500 text-xs">tours</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Épuisement */}
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Épuisement</h2>
                <span className={`text-xs font-semibold ${
                  character.state.exhaustion_level === 0 ? 'text-stone-600' :
                  character.state.exhaustion_level <= 2  ? 'text-amber-400' :
                  character.state.exhaustion_level <= 4  ? 'text-orange-400' : 'text-red-400'
                }`}>
                  {character.state.exhaustion_level === 0 ? 'Aucun' : `Niveau ${character.state.exhaustion_level}`}
                </span>
              </div>
              <div className="flex gap-1.5 mb-3">
                {[1,2,3,4,5,6].map(lvl => (
                  <button
                    key={lvl}
                    onClick={async () => {
                      const updated = await withSave(() => updateExhaustion(character.id, character.state.exhaustion_level === lvl ? 0 : lvl))
                      if (updated) setCharacter(updated)
                    }}
                    disabled={saving}
                    title={[
                      'Niveau 1 — Désavantage aux jets de caractéristique',
                      'Niveau 2 — Vitesse divisée par 2',
                      'Niveau 3 — Désavantage aux jets d\'attaque et de sauvegarde',
                      'Niveau 4 — Maximum de points de vie divisé par 2',
                      'Niveau 5 — Vitesse réduite à 0',
                      'Niveau 6 — Mort',
                    ][lvl - 1]}
                    className={`flex-1 h-6 rounded transition-colors disabled:cursor-not-allowed text-xs font-bold ${
                      lvl <= character.state.exhaustion_level
                        ? lvl <= 2 ? 'bg-amber-500 border border-amber-400'
                          : lvl <= 4 ? 'bg-orange-500 border border-orange-400'
                          : 'bg-red-600 border border-red-500'
                        : 'bg-stone-800 border border-stone-700 hover:border-stone-500'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              {character.state.exhaustion_level > 0 && (
                <p className="text-stone-500 text-xs leading-relaxed">
                  {[
                    'Désavantage aux jets de caractéristique',
                    'Vitesse divisée par 2',
                    'Désavantage aux jets d\'attaque et de sauvegarde',
                    'Maximum de PV divisé par 2',
                    'Vitesse réduite à 0',
                    'Mort',
                  ][character.state.exhaustion_level - 1]}
                  {character.state.exhaustion_level > 1 && ` (+${character.state.exhaustion_level - 1} effet${character.state.exhaustion_level > 2 ? 's' : ''} précédent${character.state.exhaustion_level > 2 ? 's' : ''})`}
                </p>
              )}
            </div>

            {/* Death saves — shown when unconscious/dying */}
            {(isDying ||
              character.state.death_saves_successes > 0 ||
              character.state.death_saves_failures > 0) && (
              <div
                className={`border rounded-xl p-5 ${
                  character.state.death_saves_failures >= 3
                    ? 'bg-red-950/40 border-red-700/50'
                    : character.state.death_saves_successes >= 3
                      ? 'bg-emerald-950/40 border-emerald-700/50'
                      : 'bg-stone-900 border-stone-800'
                }`}
              >
                <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-4">
                  Jets de sauvegarde contre la mort
                </h2>
                <div className="space-y-3">
                  <SaveDots
                    label="Succès"
                    count={character.state.death_saves_successes}
                    color="bg-emerald-500"
                    onSet={v => handleDeathSave('successes', v)}
                    disabled={saving}
                  />
                  <SaveDots
                    label="Échecs"
                    count={character.state.death_saves_failures}
                    color="bg-red-500"
                    onSet={v => handleDeathSave('failures', v)}
                    disabled={saving}
                  />
                </div>
                {character.state.death_saves_successes >= 3 && (
                  <p className="text-emerald-400 text-sm font-medium mt-3">
                    Stabilisé — le personnage est stable.
                  </p>
                )}
                {character.state.death_saves_failures >= 3 && (
                  <p className="text-red-400 text-sm font-medium mt-3">
                    Mort — 3 échecs aux jets de mort.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Résistances & immunités */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Résistances & Immunités
          </h2>
          <div className="space-y-4">
            {([
              ['resistances',     'Résistances',    'bg-sky-600 border-sky-500 text-white',       'bg-stone-800 border-stone-700 text-stone-400 hover:border-sky-700/60'],
              ['immunities',      'Immunités',      'bg-emerald-700 border-emerald-600 text-white', 'bg-stone-800 border-stone-700 text-stone-400 hover:border-emerald-700/60'],
              ['vulnerabilities', 'Vulnérabilités', 'bg-red-700 border-red-600 text-white',         'bg-stone-800 border-stone-700 text-stone-400 hover:border-red-700/60'],
            ] as [keyof typeof character.damage_modifiers, string, string, string][]).map(([cat, label, activeClass, inactiveClass]) => (
              <div key={cat}>
                <p className="text-stone-500 text-xs font-medium mb-2">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {DAMAGE_TYPES.map(([type, typeLabel]) => {
                    const active = character.damage_modifiers[cat].includes(type)
                    return (
                      <button
                        key={type}
                        onClick={() => toggleDamageModifier(cat, type)}
                        disabled={saving}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${active ? activeClass : inactiveClass}`}
                      >
                        {typeLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attaques */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Attaques
            </h2>
            <button
              onClick={() => { setAddingMacro(v => !v); setMacroDraft(emptyMacroDraft()) }}
              className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
            >
              {addingMacro ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {addingMacro && (
            <div className="bg-stone-800 border border-stone-700 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-stone-500 text-xs mb-1 block">Nom *</label>
                  <input
                    type="text"
                    placeholder="Épée longue"
                    value={macroDraft.name}
                    onChange={e => setMacroDraft(d => ({ ...d, name: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs mb-1 block">Bonus d'attaque</label>
                  <input
                    type="number"
                    placeholder="+5"
                    value={macroDraft.attack_bonus}
                    onChange={e => setMacroDraft(d => ({ ...d, attack_bonus: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs mb-1 block">Dégâts *</label>
                  <input
                    type="text"
                    placeholder="1d8+3"
                    value={macroDraft.damage_dice}
                    onChange={e => setMacroDraft(d => ({ ...d, damage_dice: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs mb-1 block">Type de dégâts</label>
                  <select
                    value={macroDraft.damage_type}
                    onChange={e => setMacroDraft(d => ({ ...d, damage_type: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors"
                  >
                    <option value="">— aucun —</option>
                    {DAMAGE_TYPES.map(([type, label]) => (
                      <option key={type} value={type}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-stone-500 text-xs mb-1 block">Dés de critique</label>
                  <input
                    type="text"
                    placeholder="2d8+3"
                    value={macroDraft.crit_dice}
                    onChange={e => setMacroDraft(d => ({ ...d, crit_dice: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs mb-1 block">Portée</label>
                  <input
                    type="text"
                    placeholder="1,5 m"
                    value={macroDraft.range}
                    onChange={e => setMacroDraft(d => ({ ...d, range: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-stone-500 text-xs mb-1 block">Notes</label>
                  <input
                    type="text"
                    placeholder="Ex : finesse, lancer à deux mains…"
                    value={macroDraft.notes}
                    onChange={e => setMacroDraft(d => ({ ...d, notes: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setAddingMacro(false)}
                  className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddMacro}
                  disabled={saving || !macroDraft.name.trim() || !macroDraft.damage_dice.trim()}
                  className="bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white font-semibold text-sm rounded-lg px-5 py-2 transition-colors"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {character.attack_macros.length === 0 && !addingMacro ? (
            <p className="text-stone-500 text-sm">Aucune attaque enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {character.attack_macros.length >= 4 && (
                <input
                  type="text"
                  value={macroSearch}
                  onChange={e => setMacroSearch(e.target.value)}
                  placeholder="Rechercher une attaque…"
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-rose-600 transition-colors mb-1"
                />
              )}
              {character.attack_macros
                .map((macro, i) => ({ macro, i }))
                .filter(({ macro }) => !macroSearch || macro.name.toLowerCase().includes(macroSearch.toLowerCase()) || (macro.damage_type ?? '').toLowerCase().includes(macroSearch.toLowerCase()))
                .map(({ macro, i }) => (
                editingMacroIndex === i ? (
                  <div key={i} className="bg-stone-800 border border-rose-800/50 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-stone-500 text-xs mb-1 block">Nom *</label>
                        <input type="text" value={editMacroDraft.name} onChange={e => setEditMacroDraft(d => ({ ...d, name: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors" />
                      </div>
                      <div>
                        <label className="text-stone-500 text-xs mb-1 block">Bonus d'attaque</label>
                        <input type="number" value={editMacroDraft.attack_bonus} onChange={e => setEditMacroDraft(d => ({ ...d, attack_bonus: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                      <div>
                        <label className="text-stone-500 text-xs mb-1 block">Dégâts *</label>
                        <input type="text" value={editMacroDraft.damage_dice} onChange={e => setEditMacroDraft(d => ({ ...d, damage_dice: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors" />
                      </div>
                      <div>
                        <label className="text-stone-500 text-xs mb-1 block">Type de dégâts</label>
                        <select value={editMacroDraft.damage_type} onChange={e => setEditMacroDraft(d => ({ ...d, damage_type: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-colors">
                          <option value="">— aucun —</option>
                          {DAMAGE_TYPES.map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-stone-500 text-xs mb-1 block">Dés de critique</label>
                        <input type="text" placeholder="2d8+3" value={editMacroDraft.crit_dice} onChange={e => setEditMacroDraft(d => ({ ...d, crit_dice: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500 transition-colors" />
                      </div>
                      <div>
                        <label className="text-stone-500 text-xs mb-1 block">Portée</label>
                        <input type="text" placeholder="1,5 m" value={editMacroDraft.range} onChange={e => setEditMacroDraft(d => ({ ...d, range: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500 transition-colors" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-stone-500 text-xs mb-1 block">Notes</label>
                        <input type="text" placeholder="Ex : finesse, lancer à deux mains…" value={editMacroDraft.notes} onChange={e => setEditMacroDraft(d => ({ ...d, notes: e.target.value }))}
                          className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-rose-500 transition-colors" />
                      </div>
                    </div>
                    <div className="flex justify-between pt-1">
                      <button onClick={() => setEditingMacroIndex(null)} className="text-stone-500 hover:text-stone-300 text-sm transition-colors">Annuler</button>
                      <button onClick={() => handleSaveMacroEdit(i)} disabled={saving || !editMacroDraft.name.trim() || !editMacroDraft.damage_dice.trim()}
                        className="bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white font-semibold text-sm rounded-lg px-5 py-2 transition-colors">
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                <div key={i} className="flex items-center gap-3 bg-stone-800/50 border border-stone-800 rounded-lg px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">{macro.name}</span>
                      {macro.damage_type && (
                        <span className="text-stone-500 text-xs">
                          {DAMAGE_TYPES.find(([t]) => t === macro.damage_type)?.[1] ?? macro.damage_type}
                        </span>
                      )}
                      {macro.range && (
                        <span className="text-stone-600 text-xs bg-stone-800 rounded px-1.5 py-0.5">{macro.range}</span>
                      )}
                    </div>
                    {macro.notes && (
                      <p className="text-stone-500 text-xs mt-0.5 truncate" title={macro.notes}>{macro.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { rollAttackMacro(macro); setDiceOpen(true) }}
                      className="bg-rose-900/60 hover:bg-rose-800/60 border border-rose-700/50 text-rose-300 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                      title={`Attaque: 1d20${sign(macro.attack_bonus ?? 0)}`}
                    >
                      1d20{sign(macro.attack_bonus ?? 0)}
                    </button>
                    <button
                      onClick={() => { rollDamageMacro(macro); setDiceOpen(true) }}
                      className="bg-orange-900/60 hover:bg-orange-800/60 border border-orange-700/50 text-orange-300 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                      title={`Dégâts: ${macro.damage_dice}`}
                    >
                      {macro.damage_dice}
                    </button>
                    {macro.crit_dice && (
                      <button
                        onClick={() => { rollCritMacro(macro); setDiceOpen(true) }}
                        className="bg-yellow-900/60 hover:bg-yellow-800/60 border border-yellow-700/50 text-yellow-300 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                        title={`Critique: ${macro.crit_dice}`}
                      >
                        💥
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => handleDuplicateMacro(i)}
                    disabled={saving}
                    className="text-stone-700 hover:text-sky-400 transition-colors disabled:cursor-not-allowed text-xs shrink-0"
                    title="Dupliquer"
                  >⎘</button>
                  <button
                    onClick={() => { setEditingMacroIndex(i); setEditMacroDraft(draftFromMacro(macro)) }}
                    disabled={saving}
                    className="text-stone-600 hover:text-stone-300 transition-colors disabled:cursor-not-allowed text-sm shrink-0"
                    title="Modifier"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDeleteMacro(i)}
                    disabled={saving}
                    className="text-stone-700 hover:text-red-400 transition-colors disabled:cursor-not-allowed text-sm shrink-0"
                    title="Supprimer"
                  >
                    ×
                  </button>
                </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* Ressources de classe */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Ressources
            </h2>
            <button
              onClick={() => { setAddingResource(v => !v); setResourceDraft(emptyResourceDraft()) }}
              className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
            >
              {addingResource ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {addingResource && (
            <div className="bg-stone-800 border border-stone-700 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-stone-500 text-xs mb-1 block">Nom *</label>
                  <input
                    type="text"
                    placeholder="Inspiration bardique"
                    value={resourceDraft.name}
                    onChange={e => setResourceDraft(d => ({ ...d, name: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-stone-500 text-xs mb-1 block">Maximum *</label>
                  <input
                    type="number"
                    min="0"
                    value={resourceDraft.max}
                    onChange={e => setResourceDraft(d => ({ ...d, max: e.target.value }))}
                    className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-stone-500 text-xs mb-1 block">Récupération</label>
                <select
                  value={resourceDraft.reset}
                  onChange={e => setResourceDraft(d => ({ ...d, reset: e.target.value as ClassResource['reset'] }))}
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="long">Repos long</option>
                  <option value="short">Repos court</option>
                  <option value="manual">Manuel</option>
                </select>
              </div>
              <button
                onClick={handleAddResource}
                disabled={saving || !resourceDraft.name.trim()}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-stone-700 disabled:text-stone-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Ajouter
              </button>
            </div>
          )}

          {character.resources.length === 0 && !addingResource ? (
            <p className="text-stone-600 text-sm italic">Aucune ressource — Ki, Inspiration bardique, etc.</p>
          ) : (
            <div className="space-y-2">
              {character.resources.length >= 3 && (
                <div className="flex gap-1.5 flex-wrap mb-1">
                  {(['all', 'long', 'short', 'manual'] as const).map(f => {
                    const count = f === 'all' ? character.resources.length : character.resources.filter(r => r.reset === f).length
                    if (f !== 'all' && count === 0) return null
                    const labels = { all: `Tous (${count})`, long: `☀ Repos long (${count})`, short: `⏾ Repos court (${count})`, manual: `✎ Manuel (${count})` }
                    return (
                      <button key={f} onClick={() => setResourceResetFilter(f)}
                        className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${resourceResetFilter === f ? 'bg-amber-900/60 border-amber-600/60 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}>
                        {labels[f]}
                      </button>
                    )
                  })}
                </div>
              )}
              {character.resources
                .map((res, i) => ({ res, i }))
                .filter(({ res }) => resourceResetFilter === 'all' || res.reset === resourceResetFilter)
                .map(({ res, i }) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-stone-800/60 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{res.name}</div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {res.reset === 'long' ? 'Repos long' : res.reset === 'short' ? 'Repos court' : 'Manuel'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleResourceChange(i, -1)}
                      disabled={saving || res.current <= 0}
                      className="w-6 h-6 flex items-center justify-center rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 text-sm font-bold transition-colors"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold text-white w-10 text-center">
                      {res.current}<span className="text-stone-500 font-normal">/{res.max}</span>
                    </span>
                    <button
                      onClick={() => handleResourceChange(i, +1)}
                      disabled={saving || res.current >= res.max}
                      className="w-6 h-6 flex items-center justify-center rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed text-stone-300 text-sm font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => handleDuplicateResource(i)}
                    disabled={saving}
                    className="text-stone-700 hover:text-sky-400 transition-colors disabled:cursor-not-allowed text-xs shrink-0"
                    title="Dupliquer"
                  >⎘</button>
                  <button
                    onClick={() => handleDeleteResource(i)}
                    disabled={saving}
                    className="text-stone-700 hover:text-red-400 transition-colors disabled:cursor-not-allowed text-sm shrink-0"
                    title="Supprimer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skills */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Compétences
            </h2>
            <input
              type="text"
              value={skillSearch}
              onChange={e => setSkillSearch(e.target.value)}
              placeholder="Chercher…"
              className="w-24 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-stone-600"
            />
          </div>
          <div className="flex gap-1 mb-3">
            {(['all', 'prof', 'expert'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSkillProfFilter(f)}
                className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${skillProfFilter === f ? 'bg-amber-700/40 border-amber-600/50 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}
              >
                {f === 'all' ? 'Toutes' : f === 'prof' ? '● Maîtrisées' : '◆ Expertise'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0.5">
            {SKILL_LABELS.filter(([skill, label]) => {
              const entry = character.skills[skill]
              const matchesSearch = !skillSearch || label.toLowerCase().includes(skillSearch.toLowerCase())
              const matchesFilter = skillProfFilter === 'all' || (skillProfFilter === 'prof' && entry.proficient) || (skillProfFilter === 'expert' && entry.expert)
              return matchesSearch && matchesFilter
            }).map(([skill, label]) => {
              const entry = character.skills[skill]
              return (
                <div key={skill} className="flex items-center justify-between py-1.5 border-b border-stone-800/60 group">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      onClick={() => toggleSkillProficiency(skill)}
                      disabled={saving}
                      title={entry.proficient ? 'Retirer la maîtrise' : 'Ajouter la maîtrise'}
                      className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors disabled:cursor-not-allowed ${
                        entry.proficient
                          ? 'bg-amber-400 border-amber-400'
                          : 'bg-transparent border-stone-600 hover:border-stone-400'
                      }`}
                    />
                    <button
                      onClick={() => toggleSkillExpertise(skill)}
                      disabled={saving || !entry.proficient}
                      title={entry.expert ? 'Retirer l\'expertise' : 'Ajouter l\'expertise (double maîtrise)'}
                      className={`w-3 h-3 shrink-0 transition-colors disabled:cursor-default rotate-45 border ${
                        entry.expert
                          ? 'bg-amber-400 border-amber-400'
                          : entry.proficient
                            ? 'bg-transparent border-amber-600 hover:border-amber-400'
                            : 'bg-transparent border-stone-700 opacity-30'
                      }`}
                    />
                    <span className="text-stone-300 text-xs truncate">{label}</span>
                  </div>
                  <button
                    onClick={() => { quickRoll(label, 20, entry.modifier); setDiceOpen(true) }}
                    className="flex items-center gap-1.5 shrink-0 ml-2 rounded px-1.5 py-0.5 hover:bg-stone-800 transition-colors"
                    title={`Lancer ${label}`}
                  >
                    <span className="text-stone-500 text-xs font-mono">{ABILITY_ABBR[entry.ability]}</span>
                    <span className={`text-xs font-bold w-7 text-right ${
                      entry.modifier > 0 ? 'text-emerald-400' : entry.modifier < 0 ? 'text-red-400' : 'text-stone-400'
                    }`}>
                      {sign(entry.modifier)}
                    </span>
                    <span className="text-stone-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity">🎲</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Langues & outils */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Langues & Maîtrises d'outils
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Langues */}
            <div>
              <p className="text-stone-500 text-xs font-medium mb-2">Langues</p>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                {character.languages.map(lang => (
                  <span
                    key={lang}
                    className="inline-flex items-center gap-1 bg-stone-800 border border-stone-700 text-stone-300 text-xs rounded-full px-2.5 py-1"
                  >
                    {lang}
                    <button
                      onClick={() => removeLanguage(lang)}
                      disabled={saving}
                      className="text-stone-600 hover:text-red-400 transition-colors ml-0.5 leading-none disabled:cursor-not-allowed"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {character.languages.length === 0 && (
                  <span className="text-stone-700 text-xs italic">Aucune langue enregistrée</span>
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={languageDraft}
                  onChange={e => setLanguageDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addLanguage() }}
                  placeholder="Commun, Elfique…"
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={addLanguage}
                  disabled={saving || !languageDraft.trim()}
                  className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40 px-2"
                >
                  +
                </button>
              </div>
            </div>

            {/* Outils */}
            <div>
              <p className="text-stone-500 text-xs font-medium mb-2">Maîtrises d'outils</p>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                {character.tool_proficiencies.map(tool => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 bg-stone-800 border border-stone-700 text-stone-300 text-xs rounded-full px-2.5 py-1"
                  >
                    {tool}
                    <button
                      onClick={() => removeTool(tool)}
                      disabled={saving}
                      className="text-stone-600 hover:text-red-400 transition-colors ml-0.5 leading-none disabled:cursor-not-allowed"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {character.tool_proficiencies.length === 0 && (
                  <span className="text-stone-700 text-xs italic">Aucune maîtrise d'outil</span>
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={toolDraft}
                  onChange={e => setToolDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTool() }}
                  placeholder="Outils de voleur, Luth…"
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  onClick={addTool}
                  disabled={saving || !toolDraft.trim()}
                  className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40 px-2"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Inventaire
              </h2>
              {character.inventory.items.length > 0 && (() => {
                const total = character.inventory.items.reduce(
                  (s, it) => s + it.weight * it.quantity, 0,
                )
                const pct = Math.min(100, (total / character.inventory.capacity) * 100)
                const color = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                const attunedCount = character.inventory.items.filter(it => it.attuned).length
                return (
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-stone-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-stone-500 text-xs">
                        {total.toFixed(1)} / {character.inventory.capacity} kg
                      </span>
                    </div>
                    {attunedCount > 0 && (
                      <span className={`text-xs font-medium ${attunedCount >= 3 ? 'text-amber-400' : 'text-violet-400'}`}>
                        ◈ {attunedCount}/3
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>
            <div className="flex items-center gap-2">
              {character.inventory.items.length > 3 && (
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                  className="w-32 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-stone-600"
                />
              )}
              <button
                onClick={() => { setShowItemCompendium(true); setCompendiumSearch(''); setCompendiumRarity('toutes') }}
                className="text-violet-400 hover:text-violet-300 text-xs transition-colors"
                title="Ajouter depuis le compendium d'objets magiques"
              >
                ✦ Compendium
              </button>
              <button
                onClick={() => { setAddingItem(v => !v); setItemDraft(emptyItemDraft()) }}
                className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
              >
                {addingItem ? 'Annuler' : '+ Ajouter'}
              </button>
            </div>
          </div>

          {/* Inventory filter pills + sort */}
          {character.inventory.items.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {(['all', 'equipped', 'magical', 'attuned'] as const).map(f => {
                const items = character.inventory.items
                const count = f === 'all' ? items.length : f === 'equipped' ? items.filter(it => it.equipped).length : f === 'magical' ? items.filter(it => it.magical).length : items.filter(it => it.attuned).length
                if (f !== 'all' && count === 0) return null
                const label = f === 'all' ? `Tous (${count})` : f === 'equipped' ? `⬤ Équipé (${count})` : f === 'magical' ? `✦ Magique (${count})` : `◈ Accordé (${count})`
                return (
                  <button key={f} onClick={() => setInventoryFilter(f)} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${inventoryFilter === f ? 'bg-amber-900/60 border-amber-600/60 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}>
                    {label}
                  </button>
                )
              })}
              <select
                value={inventorySort}
                onChange={e => setInventorySort(e.target.value as typeof inventorySort)}
                className="ml-auto bg-stone-800 border border-stone-700 rounded px-2 py-0.5 text-stone-400 text-xs focus:outline-none focus:border-stone-500 transition-colors"
              >
                <option value="default">Défaut</option>
                <option value="name">Nom A→Z</option>
                <option value="quantity">Quantité ↓</option>
              </select>
            </div>
          )}

          {/* Add item form */}
          {addingItem && (
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-stone-800">
              <input
                type="text"
                placeholder="Nom de l'objet"
                value={itemDraft.name}
                onChange={e => setItemDraft(d => ({ ...d, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
                className="flex-1 min-w-[160px] bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <input
                type="number"
                placeholder="Qté"
                min={1}
                value={itemDraft.quantity}
                onChange={e => setItemDraft(d => ({ ...d, quantity: e.target.value }))}
                className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <input
                type="number"
                placeholder="kg"
                min={0}
                step={0.1}
                value={itemDraft.weight}
                onChange={e => setItemDraft(d => ({ ...d, weight: e.target.value }))}
                className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Valeur (po)"
                value={itemDraft.value}
                onChange={e => setItemDraft(d => ({ ...d, value: e.target.value }))}
                title="Valeur unitaire en pièces d'or — laissez vide si l'objet n'a pas de prix"
                className="w-36 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <input
                type="text"
                placeholder="Notes (optionnel)"
                value={itemDraft.notes}
                onChange={e => setItemDraft(d => ({ ...d, notes: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAddItem() }}
                className="flex-1 min-w-[140px] bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              <button
                onClick={handleAddItem}
                disabled={saving || !itemDraft.name.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
              >
                Ajouter
              </button>
            </div>
          )}

          {character.inventory.items.length === 0 ? (
            <p className="text-stone-500 text-sm">Inventaire vide.</p>
          ) : (
            <div className="divide-y divide-stone-800/60">
              {character.inventory.items
                .map((item, i) => ({ item, i }))
                .filter(({ item }) => !inventorySearch || item.name.toLowerCase().includes(inventorySearch.toLowerCase()))
                .filter(({ item }) => inventoryFilter === 'all' || (inventoryFilter === 'equipped' && item.equipped) || (inventoryFilter === 'magical' && item.magical) || (inventoryFilter === 'attuned' && item.attuned))
                .sort((a, b) => {
                  if (inventorySort === 'name') return a.item.name.localeCompare(b.item.name, 'fr')
                  if (inventorySort === 'quantity') return b.item.quantity - a.item.quantity
                  return 0
                })
                .map(({ item, i }) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  {/* Equipped toggle */}
                  <button
                    onClick={() => handleToggleEquipped(i)}
                    disabled={saving}
                    title={item.equipped ? 'Déséquiper' : 'Équiper'}
                    className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors disabled:cursor-not-allowed ${
                      item.equipped
                        ? 'bg-amber-400 border-amber-400'
                        : 'bg-transparent border-stone-600 hover:border-stone-400'
                    }`}
                  />

                  {/* Magical toggle */}
                  <button
                    onClick={() => handleToggleMagical(i)}
                    disabled={saving}
                    title={item.magical ? 'Objet magique (cliquer pour retirer)' : 'Marquer comme magique'}
                    className={`text-xs shrink-0 transition-colors disabled:cursor-not-allowed ${
                      item.magical ? 'text-purple-400' : 'text-stone-700 hover:text-stone-500'
                    }`}
                  >
                    ✦
                  </button>

                  {/* Attunement toggle (only for magical items) */}
                  {item.magical && (() => {
                    const attunedCount = character.inventory.items.filter(it => it.attuned).length
                    const canAttune = item.attuned || attunedCount < 3
                    return (
                      <button
                        onClick={() => handleToggleAttuned(i)}
                        disabled={saving || (!item.attuned && !canAttune)}
                        title={item.attuned ? 'Syntonisé (cliquer pour retirer)' : canAttune ? 'Syntoniser' : 'Limite de 3 syntonie atteinte'}
                        className={`text-xs shrink-0 transition-colors disabled:cursor-not-allowed ${
                          item.attuned ? 'text-amber-400' : 'text-stone-700 hover:text-stone-500'
                        }`}
                      >
                        ◈
                      </button>
                    )
                  })()}

                  {/* Name */}
                  <span className={`flex-1 min-w-0 text-sm truncate ${item.equipped ? 'text-white font-medium' : 'text-stone-300'}`}>
                    {item.name}
                    {item.magical && <span className="ml-1 text-purple-400 text-xs">✦</span>}
                    {item.attuned && <span className="ml-0.5 text-amber-400 text-xs">◈</span>}
                  </span>

                  {/* Quantity */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleQtyChange(i, -1)}
                      disabled={saving || item.quantity <= 0}
                      className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-bold transition-colors disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="text-white text-sm w-6 text-center font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => handleQtyChange(i, +1)}
                      disabled={saving}
                      className="w-6 h-6 rounded bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-bold transition-colors disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>

                  {/* Weight */}
                  {item.weight > 0 && (
                    <span className="text-stone-500 text-xs w-14 text-right shrink-0">
                      {(item.weight * item.quantity).toFixed(1)} kg
                    </span>
                  )}

                  {/* Value */}
                  {item.value_gp != null && (
                    <span className="text-amber-600 text-xs w-16 text-right shrink-0 truncate" title={formatGold(lineGold(item))}>
                      {formatGold(item.value_gp)}
                    </span>
                  )}

                  {/* Notes */}
                  {item.notes && (
                    <span className="text-stone-500 text-xs italic truncate max-w-[120px] hidden sm:block" title={item.notes}>{item.notes}</span>
                  )}

                  {/* Duplicate */}
                  <button
                    onClick={() => handleDuplicateItem(i)}
                    disabled={saving}
                    className="text-stone-700 hover:text-sky-400 transition-colors disabled:cursor-not-allowed text-xs shrink-0"
                    title="Dupliquer"
                  >⎘</button>

                  {/* Delete */}
                  <button
                    onClick={() => handleRemoveItem(i)}
                    disabled={saving}
                    className="text-stone-700 hover:text-red-400 transition-colors disabled:cursor-not-allowed text-sm shrink-0"
                    title="Supprimer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monnaie */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-4">Monnaie</h2>
          <div className="grid grid-cols-5 gap-3">
            {([
              ['pc', 'Cuivre',   'text-orange-400'],
              ['pa', 'Argent',   'text-stone-300'],
              ['pe', 'Électrum', 'text-teal-400'],
              ['po', 'Or',       'text-amber-400'],
              ['pp', 'Platine',  'text-sky-300'],
            ] as const).map(([key, label, color]) => (
              <div key={key} className="text-center">
                <p className={`text-xs font-semibold mb-1.5 ${color}`}>{label}</p>
                <input
                  type="number"
                  min={0}
                  value={currencyDraft[key]}
                  onChange={e => setCurrencyDraft(prev => ({
                    ...prev,
                    [key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))}
                  onBlur={handleSaveCurrency}
                  disabled={saving}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Spell slots */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Emplacements de sorts
            </h2>
            <div className="flex items-center gap-3">
              {!editingSlots && (
                <button
                  onClick={handleLongRest}
                  disabled={saving}
                  className="text-sky-400 hover:text-sky-300 text-xs transition-colors disabled:opacity-40"
                >
                  Repos long
                </button>
              )}
              {editingSlots ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingSlots(false)}
                    className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveSlotConfig}
                    disabled={saving}
                    className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    Enregistrer
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditSlots}
                  className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                >
                  Configurer
                </button>
              )}
            </div>
          </div>

          {/* Spellcasting stats */}
          {character.spellcasting.ability && (
            <div className="flex gap-4 mb-4 pb-4 border-b border-stone-800">
              <div className="text-center">
                <p className="text-stone-500 text-xs">Caractéristique</p>
                <p className="text-white font-semibold text-sm mt-0.5">
                  {ABILITY_ABBR[character.spellcasting.ability]}
                  {' '}
                  <span className={`text-xs font-bold ${character.spellcasting.modifier >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {sign(character.spellcasting.modifier)}
                  </span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-stone-500 text-xs">DD de sort</p>
                <p className="text-white font-semibold text-sm mt-0.5">{character.spellcasting.save_dc}</p>
              </div>
              <div className="text-center">
                <p className="text-stone-500 text-xs">Bonus d'attaque</p>
                <p className="text-white font-semibold text-sm mt-0.5">
                  {sign(character.spellcasting.attack_bonus)}
                </p>
              </div>
            </div>
          )}

          {editingSlots ? (
            <div className="space-y-3">
              {/* Spellcasting ability picker */}
              <div className="flex items-center gap-3">
                <span className="text-stone-400 text-xs w-28 shrink-0">Caractéristique</span>
                <select
                  value={abilityDraftSpell}
                  onChange={e => setAbilityDraftSpell(e.target.value as AbilityName | '')}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="">— aucune —</option>
                  {ABILITY_OPTIONS.map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              {/* Max slots per level */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[1,2,3,4,5,6,7,8,9].map(lvl => (
                  <div key={lvl} className="bg-stone-800 rounded-lg p-2 text-center">
                    <p className="text-stone-400 text-xs mb-1.5">Niv. {lvl}</p>
                    <input
                      type="number"
                      min={0}
                      max={9}
                      placeholder="0"
                      value={slotDraft[String(lvl)]?.max ?? ''}
                      onChange={e =>
                        setSlotDraft(d => ({
                          ...d,
                          [String(lvl)]: { max: e.target.value, used: d[String(lvl)]?.used ?? '0' },
                        }))
                      }
                      className="w-full bg-stone-700 border border-stone-600 rounded px-1 py-1 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))}
              </div>
              <p className="text-stone-600 text-xs">Mettre 0 ou laisser vide pour supprimer un niveau.</p>
            </div>
          ) : Object.keys(character.spellcasting.slots).length === 0 ? (
            <p className="text-stone-500 text-sm">
              Aucun emplacement configuré.{' '}
              <button onClick={startEditSlots} className="text-amber-400 hover:text-amber-300 transition-colors">
                Configurer
              </button>
            </p>
          ) : (
            <div className="space-y-3">
              {[1,2,3,4,5,6,7,8,9]
                .filter(lvl => character.spellcasting.slots[String(lvl)])
                .map(lvl => {
                  const slot = character.spellcasting.slots[String(lvl)]
                  const available = slot.max - slot.used
                  return (
                    <div key={lvl} className="flex items-center gap-4">
                      <span className="text-stone-400 text-xs w-16 shrink-0">Niveau {lvl}</span>
                      <div className="flex gap-1.5 flex-1">
                        {Array.from({ length: slot.max }).map((_, i) => {
                          const isFull = i < available
                          return (
                            <button
                              key={i}
                              disabled={saving}
                              onClick={() => handleUseSlot(lvl, isFull ? 'use' : 'restore')}
                              title={isFull ? 'Utiliser cet emplacement' : 'Récupérer cet emplacement'}
                              className={`w-6 h-6 rounded-full border-2 transition-colors disabled:cursor-not-allowed ${
                                isFull
                                  ? 'bg-violet-500 border-violet-400 hover:bg-violet-400'
                                  : 'bg-transparent border-stone-600 hover:border-stone-400'
                              }`}
                            />
                          )
                        })}
                      </div>
                      <span className="text-stone-500 text-xs w-10 text-right shrink-0">
                        {available}/{slot.max}
                      </span>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Multiclass spell slot calculator */}
        {character.secondary_class && (() => {
          const slots = computeMulticlassSlots(
            character.character_class,
            character.level - (character.secondary_level ?? 0),
            character.secondary_class,
            character.secondary_level ?? 0,
          )
          if (!slots) return null
          return (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">
                Emplacements multiclasse
              </h2>
              <p className="text-stone-500 text-xs mb-3">
                {character.character_class} Niv.{character.level - (character.secondary_level ?? 0)} / {character.secondary_class} Niv.{character.secondary_level ?? 0}
                {' → '}niveau de lanceur de sorts combiné
              </p>
              <div className="flex flex-wrap gap-2">
                {slots.map((count, i) => (
                  <div key={i} className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-center min-w-[60px]">
                    <p className="text-stone-500 text-xs mb-1">Niv. {i + 1}</p>
                    <p className="text-violet-300 font-bold">{count}</p>
                  </div>
                ))}
              </div>
              <p className="text-stone-600 text-xs mt-3">Emplacements combinés selon la table multiclasse D&D 5e (PHB p.165)</p>
            </div>
          )
        })()}

        {/* Spells known */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Sorts
              </h2>
              {character.spellcasting.spells.length > 0 && (() => {
                const preparedCount = character.spellcasting.spells.filter(s => s.prepared).length
                const totalCount = character.spellcasting.spells.length
                return (
                  <button
                    onClick={() => setSpellFilter(f => f === 'all' ? 'prepared' : 'all')}
                    className={`text-xs rounded-lg px-2 py-0.5 border transition-colors ${
                      spellFilter === 'prepared'
                        ? 'bg-violet-700/40 border-violet-600/50 text-violet-300'
                        : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                    }`}
                    title={spellFilter === 'all' ? 'Afficher uniquement les sorts préparés' : 'Afficher tous les sorts'}
                  >
                    {preparedCount}/{totalCount} préparés
                  </button>
                )
              })()}
            </div>
            <div className="flex items-center gap-2">
              {character.spellcasting.spells.length > 4 && (
                <input
                  type="text"
                  value={spellSearch}
                  onChange={e => setSpellSearch(e.target.value)}
                  placeholder="Chercher…"
                  className="w-28 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors placeholder:text-stone-600"
                />
              )}
              {character.spellcasting.spells.length > 4 && (
                <select
                  value={spellSortMode}
                  onChange={e => setSpellSortMode(e.target.value as typeof spellSortMode)}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-stone-400 text-xs focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="default">Par défaut</option>
                  <option value="name">Nom A→Z</option>
                  <option value="prepared">Préparés d'abord</option>
                </select>
              )}
              <button
                onClick={() => setShowCompendium(true)}
                className="text-xs rounded-lg px-2 py-0.5 border bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300 transition-colors"
              >
                📚 Compendium
              </button>
              <button
                onClick={() => { setShowSpellBrowser(v => !v); setSpellBrowserSearch('') }}
                className={`text-xs rounded-lg px-2 py-0.5 border transition-colors ${
                  showSpellBrowser
                    ? 'bg-violet-700/40 border-violet-600/50 text-violet-300'
                    : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                }`}
              >
                📖 Répertoire
              </button>
              <button
                onClick={() => setAddingSpell(v => !v)}
                className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
              >
                {addingSpell ? 'Annuler' : '+ Ajouter'}
              </button>
            </div>
          </div>

          {/* Spell browser */}
          {showSpellBrowser && (() => {
            const known = new Set(character.spellcasting.spells.map(s => s.name))
            const filtered = SRD_SPELLS.filter(([name, level]) =>
              (spellBrowserLevel === 'all' || level === spellBrowserLevel) &&
              (spellBrowserSearch === '' || name.toLowerCase().includes(spellBrowserSearch.toLowerCase()))
            )
            return (
              <div className="mb-4 pb-4 border-b border-stone-800">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <input
                    type="text"
                    placeholder="Rechercher un sort…"
                    value={spellBrowserSearch}
                    onChange={e => setSpellBrowserSearch(e.target.value)}
                    className="flex-1 min-w-[150px] bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {(['all', 0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as (number | 'all')[]).map(lvl => (
                      <button
                        key={String(lvl)}
                        onClick={() => setSpellBrowserLevel(lvl)}
                        className={`text-xs rounded px-2 py-0.5 border transition-colors ${
                          spellBrowserLevel === lvl
                            ? 'bg-violet-700/60 border-violet-600 text-violet-200'
                            : 'border-stone-700 text-stone-500 hover:text-stone-300 hover:border-stone-600'
                        }`}
                      >
                        {lvl === 'all' ? 'Tous' : lvl === 0 ? 'Tour' : lvl}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
                  {filtered.length === 0 ? (
                    <p className="text-stone-600 text-xs py-2">Aucun sort trouvé.</p>
                  ) : filtered.map(([name, level]) => {
                    const isKnown = known.has(name)
                    return (
                      <div
                        key={name}
                        className={`flex items-center justify-between rounded px-2 py-1.5 transition-colors ${
                          isKnown ? 'opacity-40' : 'hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs min-w-[54px] shrink-0 text-stone-500">
                            {level === 0 ? 'Tour' : `Niv. ${level}`}
                          </span>
                          <span className={`text-sm truncate ${isKnown ? 'text-stone-600' : 'text-stone-200'}`}>{name}</span>
                          {isKnown && <span className="text-stone-600 text-xs shrink-0">✓</span>}
                        </div>
                        {!isKnown && (
                          <button
                            onClick={() => addSpellFromBrowser(name, level)}
                            disabled={saving}
                            className="shrink-0 text-violet-400 hover:text-violet-300 text-sm font-bold ml-2 transition-colors disabled:opacity-40"
                          >
                            +
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Add spell form */}
          {addingSpell && (
            <div className="mb-4 pb-4 border-b border-stone-800 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Nom du sort"
                    value={spellNameDraft}
                    onChange={e => handleSpellNameChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { handleAddSpell(); setSpellSuggestions([]) }
                      if (e.key === 'Escape') setSpellSuggestions([])
                    }}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                  />
                  {spellSuggestions.length > 0 && (
                    <ul className="absolute z-20 left-0 right-0 top-full mt-1 bg-stone-800 border border-stone-700 rounded-lg overflow-hidden shadow-xl">
                      {spellSuggestions.map(([name, level]) => (
                        <li key={name}>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); selectSpellSuggestion(name, level) }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-stone-700 transition-colors flex items-center justify-between gap-2"
                          >
                            <span className="text-stone-200">{name}</span>
                            <span className="text-stone-500 text-xs shrink-0">
                              {level === 0 ? 'Tour de magie' : `Niv. ${level}`}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <select
                  value={spellLevelDraft}
                  onChange={e => setSpellLevelDraft(e.target.value)}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="0">Tour de magie</option>
                  {[1,2,3,4,5,6,7,8,9].map(l => (
                    <option key={l} value={String(l)}>Niv. {l}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddSpell}
                  disabled={saving || !spellNameDraft.trim()}
                  className="bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-stone-500 text-xs shrink-0">Dés de dégâts</span>
                <input
                  type="text"
                  placeholder="ex: 2d6+3 (optionnel)"
                  value={spellDamageDraft}
                  onChange={e => setSpellDamageDraft(e.target.value)}
                  className="w-36 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
                <span className="text-stone-500 text-xs shrink-0">Notes</span>
                <input
                  type="text"
                  placeholder="Portée, composantes… (optionnel)"
                  value={spellNotesDraft}
                  onChange={e => setSpellNotesDraft(e.target.value)}
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>
          )}

          {character.spellcasting.spells.length === 0 ? (
            <p className="text-stone-500 text-sm">Aucun sort enregistré.</p>
          ) : (
            <div className="space-y-4">
              {[0,1,2,3,4,5,6,7,8,9].map(lvl => {
                const spells = character.spellcasting.spells
                  .map((s, i) => ({ ...s, _idx: i }))
                  .filter(s => s.level === lvl && (spellFilter === 'all' || s.prepared) && (!spellSearch || s.name.toLowerCase().includes(spellSearch.toLowerCase())))
                  .sort((a, b) => spellSortMode === 'name' ? a.name.localeCompare(b.name, 'fr') : spellSortMode === 'prepared' ? (b.prepared ? 1 : 0) - (a.prepared ? 1 : 0) : 0)
                if (spells.length === 0) return null
                return (
                  <div key={lvl}>
                    <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-2">
                      {SPELL_LEVEL_LABELS[lvl]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {spells.map(spell => {
                        const isConcentrating = character.state.concentrating_on === spell.name
                        return (
                          <div key={spell._idx} className="flex flex-col gap-1">
                          <div
                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${
                              isConcentrating
                                ? 'bg-violet-700/50 border-violet-500 text-violet-100'
                                : spell.prepared
                                  ? 'bg-violet-900/40 border-violet-700/60 text-violet-200'
                                  : 'bg-stone-800 border-stone-700 text-stone-400'
                            }`}
                          >
                            <button
                              onClick={() => handleTogglePrepared(spell._idx)}
                              disabled={saving}
                              title={spell.prepared ? 'Marquer comme non préparé' : 'Marquer comme préparé'}
                              className={`w-2.5 h-2.5 rounded-full border transition-colors disabled:cursor-not-allowed shrink-0 ${
                                spell.prepared ? 'bg-violet-400 border-violet-400' : 'bg-transparent border-stone-500'
                              }`}
                            />
                            {(() => {
                              const detail = SPELL_DETAILS[spell.name]
                              return (
                                <span className="relative group/spell">
                                  <span className="cursor-default">{spell.name}</span>
                                  <div className="absolute bottom-full left-0 mb-1.5 z-20 hidden group-hover/spell:block pointer-events-none">
                                    <div className="bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 shadow-xl text-xs space-y-1 min-w-[200px] max-w-[300px]">
                                      <p className="font-semibold text-white">{spell.name}</p>
                                      <p className="text-stone-400">{spell.level === 0 ? 'Tour de magie' : `Niveau ${spell.level}`}{detail ? ` · ${detail.school}` : ''}</p>
                                      {detail && (
                                        <>
                                          <p className="text-stone-500">⏱ {detail.castingTime} · ↔ {detail.range}</p>
                                          <p className="text-stone-500">⌛ {detail.duration}</p>
                                          <p className="text-stone-300 leading-relaxed pt-0.5 border-t border-stone-700">{detail.description}</p>
                                        </>
                                      )}
                                      {!detail && spell.concentration && <p className="text-violet-400">◈ Concentration</p>}
                                      {!detail && spell.damage_dice && <p className="text-orange-400">Dégâts : {spell.damage_dice}</p>}
                                      {spell.notes && <p className="text-stone-300 italic pt-0.5 border-t border-stone-700">{spell.notes}</p>}
                                    </div>
                                  </div>
                                </span>
                              )
                            })()}
                            <button
                              onClick={() => {
                                if (editingSpellNotesIdx === spell._idx) { setEditingSpellNotesIdx(null) }
                                else { setEditingSpellNotesIdx(spell._idx); setSpellNotesEdit(spell.notes ?? '') }
                              }}
                              title={spell.notes ? 'Modifier les notes' : 'Ajouter des notes'}
                              className={`text-xs transition-colors shrink-0 ${spell.notes ? 'text-stone-400 hover:text-stone-200' : 'text-stone-700 hover:text-stone-500'}`}
                            >
                              ✎
                            </button>
                            {(() => {
                              const slotAvail = availableSlotLevel(spell.level)
                              const canCast = spell.level === 0 || slotAvail !== null
                              return (
                                <button
                                  onClick={() => castSpell(spell)}
                                  disabled={saving || !canCast}
                                  title={
                                    spell.level === 0
                                      ? 'Lancer (tour cantrip)'
                                      : canCast
                                        ? `Lancer — utilise emplacement niv.${slotAvail}`
                                        : 'Aucun emplacement disponible'
                                  }
                                  className={`ml-0.5 text-xs font-semibold px-1.5 py-0.5 rounded transition-colors shrink-0 ${
                                    canCast
                                      ? 'bg-violet-700/50 text-violet-200 hover:bg-violet-600/70 disabled:cursor-not-allowed'
                                      : 'text-stone-600 cursor-not-allowed'
                                  }`}
                                >
                                  Lancer
                                </button>
                              )
                            })()}
                            {character.spellcasting.ability && (
                              <button
                                onClick={() => {
                                  handleRoll({ sides: 20, modifier: character.spellcasting.attack_bonus, label: `Attaque sort: ${spell.name}`, count: 1 })
                                  setDiceOpen(true)
                                }}
                                title={`Jet d'attaque: 1d20${sign(character.spellcasting.attack_bonus)}`}
                                className="text-xs text-violet-500 hover:text-violet-300 transition-colors shrink-0"
                              >
                                ⚔
                              </button>
                            )}
                            {spell.damage_dice && (
                              <button
                                onClick={() => {
                                  const p = parseDice(spell.damage_dice!)
                                  if (p) { handleRoll({ sides: p.sides, count: p.count, modifier: p.bonus, label: `Dégâts: ${spell.name}` }); setDiceOpen(true) }
                                }}
                                title={`Dégâts: ${spell.damage_dice}`}
                                className="text-xs text-orange-500 hover:text-orange-300 transition-colors shrink-0"
                              >
                                {spell.damage_dice}
                              </button>
                            )}
                            <button
                              onClick={() => handleConcentrate(spell.name)}
                              disabled={saving}
                              title={isConcentrating ? 'Relâcher la concentration' : 'Se concentrer sur ce sort'}
                              className={`ml-0.5 text-xs transition-colors disabled:cursor-not-allowed ${
                                isConcentrating
                                  ? 'text-violet-300 hover:text-violet-100'
                                  : 'text-stone-600 hover:text-violet-400'
                              }`}
                            >
                              ⊙
                            </button>
                            <button
                              onClick={() => handleRemoveSpell(spell._idx)}
                              disabled={saving}
                              className="text-stone-600 hover:text-red-400 transition-colors disabled:cursor-not-allowed text-xs leading-none"
                              title="Supprimer ce sort"
                            >
                              ×
                            </button>
                          </div>
                          {editingSpellNotesIdx === spell._idx && (
                            <div className="flex gap-1.5 w-full">
                              <input
                                type="text"
                                autoFocus
                                value={spellNotesEdit}
                                onChange={e => setSpellNotesEdit(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveSpellNotes(spell._idx)
                                  if (e.key === 'Escape') setEditingSpellNotesIdx(null)
                                }}
                                placeholder="Portée, composantes, description…"
                                className="flex-1 bg-stone-800 border border-violet-700/50 rounded px-2 py-1 text-white text-xs placeholder-stone-600 focus:outline-none"
                              />
                              <button onClick={() => handleSaveSpellNotes(spell._idx)} disabled={saving}
                                className="text-violet-400 hover:text-violet-200 text-xs px-2 transition-colors disabled:opacity-40">✓</button>
                              <button onClick={() => setEditingSpellNotesIdx(null)}
                                className="text-stone-500 hover:text-stone-300 text-xs px-1 transition-colors">✕</button>
                            </div>
                          )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Traits &amp; Capacités
            </h2>
            <div className="flex items-center gap-2">
              {character.features.length > 3 && (
                <input
                  type="text"
                  value={featureSearch}
                  onChange={e => setFeatureSearch(e.target.value)}
                  placeholder="Chercher…"
                  className="w-28 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-stone-600"
                />
              )}
              <button
                onClick={() => { setAddingFeature(v => !v); setFeatureDraft(emptyFeatureDraft()) }}
                className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
              >
                {addingFeature ? 'Annuler' : '+ Ajouter'}
              </button>
            </div>
          </div>

          {/* Source filter pills */}
          {(() => {
            const sources = [...new Set(character.features.map(f => f.source).filter(Boolean))] as string[]
            if (sources.length < 2) return null
            return (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(['all', ...sources]).map(s => (
                  <button key={s} onClick={() => setFeatureSourceFilter(s)} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${featureSourceFilter === s ? 'bg-amber-900/60 border-amber-600/60 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}>
                    {s === 'all' ? `Toutes (${character.features.length})` : `${s} (${character.features.filter(f => f.source === s).length})`}
                  </button>
                ))}
              </div>
            )
          })()}

          {/* Add form */}
          {addingFeature && (
            <div className="bg-stone-800 border border-stone-700 rounded-xl p-4 mb-4 space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Nom de la capacité *"
                  value={featureDraft.name}
                  onChange={e => setFeatureDraft(d => ({ ...d, name: e.target.value }))}
                  className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <input
                  type="text"
                  placeholder="Source (Classe, Race…)"
                  value={featureDraft.source}
                  onChange={e => setFeatureDraft(d => ({ ...d, source: e.target.value }))}
                  className="w-40 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
              <textarea
                placeholder="Description…"
                value={featureDraft.description}
                onChange={e => setFeatureDraft(d => ({ ...d, description: e.target.value }))}
                rows={3}
                className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddFeature}
                  disabled={saving || !featureDraft.name.trim()}
                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}

          {/* Feature list */}
          {character.features.length === 0 && !addingFeature ? (
            <p className="text-stone-500 text-sm">Aucune capacité enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {character.features.map((f, i) => ({ f, i })).filter(({ f }) => (featureSourceFilter === 'all' || f.source === featureSourceFilter) && (!featureSearch || f.name.toLowerCase().includes(featureSearch.toLowerCase()) || (f.source ?? '').toLowerCase().includes(featureSearch.toLowerCase()))).map(({ f, i }) => (
                <div key={i} className="border border-stone-800 rounded-xl overflow-hidden">
                  {editingFeature === i ? (
                    /* Inline edit form */
                    <div className="bg-stone-800 p-4 space-y-3">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                          className="flex-1 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <input
                          type="text"
                          placeholder="Source"
                          value={editDraft.source}
                          onChange={e => setEditDraft(d => ({ ...d, source: e.target.value }))}
                          className="w-40 bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>
                      <textarea
                        value={editDraft.description}
                        onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                        rows={3}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm focus:outline-none focus:border-amber-500 transition-colors resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setEditingFeature(null)}
                          className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                        >
                          Annuler
                        </button>
                        <div className="flex gap-4">
                          <button
                            onClick={() => handleDeleteFeature(i)}
                            disabled={saving}
                            className="text-red-500 hover:text-red-400 text-xs transition-colors disabled:opacity-40"
                          >
                            Supprimer
                          </button>
                          <button
                            onClick={() => handleSaveFeature(i)}
                            disabled={saving || !editDraft.name.trim()}
                            className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Display row */
                    <div>
                      <button
                        onClick={() => setExpandedFeature(expandedFeature === i ? null : i)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-800/50 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-stone-500 text-xs transition-transform duration-200" style={{ transform: expandedFeature === i ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                            ▶
                          </span>
                          <span className="text-white text-sm font-medium truncate">{f.name}</span>
                          {f.source && (
                            <span className="shrink-0 text-xs bg-stone-800 text-stone-400 border border-stone-700 rounded px-1.5 py-0.5">
                              {f.source}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setEditDraft({ ...f })
                            setEditingFeature(i)
                            setExpandedFeature(null)
                          }}
                          className="shrink-0 text-stone-600 hover:text-stone-400 text-xs transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Modifier
                        </button>
                      </button>
                      {expandedFeature === i && f.description && (
                        <div className="px-4 pb-4">
                          <MarkdownText className="text-stone-400 text-sm">{f.description}</MarkdownText>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Traits de personnalité */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Traits de personnalité
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['personality_traits', 'Traits de personnalité', 'Comment ce personnage se comporte-t-il ?'],
              ['ideals',             'Idéaux',                 'En quoi croit-il profondément ?'],
              ['bonds',              'Liens',                  'Qui ou quoi lui tient à cœur ?'],
              ['flaws',              'Défauts',                'Quelle est sa faiblesse ou son vice ?'],
            ] as [keyof typeof personalityDraft, string, string][]).map(([field, label, placeholder]) => (
              <div key={field}>
                <p className="text-stone-500 text-xs font-medium mb-1">{label}</p>
                <textarea
                  value={personalityDraft[field]}
                  onChange={e => setPersonalityDraft(d => ({ ...d, [field]: e.target.value }))}
                  onBlur={() => handleSavePersonality(field)}
                  placeholder={placeholder}
                  rows={3}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Notes</h2>
            <div className="flex items-center gap-3">
              {!notesPreview && (
                <MicButton
                  onTranscript={text => { setNotesDraft(prev => prev ? prev + '\n' + text : text); setNotesDirty(true) }}
                />
              )}
              {notesDirty && !notesPreview && (
                <button onClick={handleSaveNotes} disabled={saving}
                  className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40">
                  Enregistrer
                </button>
              )}
              {notesDraft.trim() && (
                <button onClick={() => { if (!notesPreview) handleSaveNotes(); setNotesPreview(v => !v) }}
                  className="text-stone-500 hover:text-stone-300 text-xs transition-colors">
                  {notesPreview ? '✎ Éditer' : '👁 Aperçu'}
                </button>
              )}
            </div>
          </div>
          {notesPreview ? (
            <div className="min-h-[80px]">
              <MarkdownText>{notesDraft}</MarkdownText>
            </div>
          ) : (
            <textarea
              value={notesDraft}
              onChange={e => { setNotesDraft(e.target.value); setNotesDirty(true) }}
              onBlur={handleSaveNotes}
              placeholder={"Notes libres sur ce personnage…\n\n## Titre  **gras**  *italique*  - liste"}
              rows={5}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono"
            />
          )}
        </div>

        {/* Notes MJ */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-stone-300 text-sm font-semibold">Notes MJ</h2>
              <p className="text-stone-500 text-xs mt-0.5">Privées — non diffusées en temps réel</p>
            </div>
            {!dmNotesPreview && (
              <MicButton
                onTranscript={text => setDmNotesDraft(prev => prev ? prev + '\n' + text : text)}
              />
            )}
            {dmNotesDraft.trim() && (
              <button onClick={() => setDmNotesPreview(v => !v)}
                className="text-stone-500 hover:text-stone-300 text-xs transition-colors">
                {dmNotesPreview ? '✎ Éditer' : '👁 Aperçu'}
              </button>
            )}
          </div>
          {dmNotesPreview ? (
            <div className="min-h-[60px]">
              <MarkdownText>{dmNotesDraft}</MarkdownText>
            </div>
          ) : (
            <textarea
              value={dmNotesDraft}
              onChange={e => setDmNotesDraft(e.target.value)}
              onBlur={handleSaveDmNotes}
              placeholder={"Secrets, arcs narratifs, liens avec la campagne…\n\n## Titre  **gras**  - liste"}
              rows={4}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y font-mono"
            />
          )}
        </div>
      </main>
      {showCompendium && <SpellCompendiumModal onClose={() => setShowCompendium(false)} />}

      {/* Modal compendium objets magiques */}
      {showItemCompendium && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-16 px-4"
          onClick={() => setShowItemCompendium(false)}
        >
          <div
            className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[70vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-stone-800 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold">Compendium d'objets magiques</h2>
                <button onClick={() => setShowItemCompendium(false)} className="text-stone-500 hover:text-stone-300 transition-colors">✕</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Rechercher…"
                  value={compendiumSearch}
                  onChange={e => setCompendiumSearch(e.target.value)}
                  autoFocus
                  className="flex-1 min-w-0 basis-40 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
                <select
                  value={compendiumRarity}
                  onChange={e => setCompendiumRarity(e.target.value as ItemRarity | 'toutes')}
                  className="min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-2 py-2 text-stone-300 text-sm focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="toutes">Toutes raretés</option>
                  <option value="commun">Commun</option>
                  <option value="peu commun">Peu commun</option>
                  <option value="rare">Rare</option>
                  <option value="très rare">Très rare</option>
                  <option value="légendaire">Légendaire</option>
                </select>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-1">
              {MAGIC_ITEMS
                .filter(it =>
                  (compendiumRarity === 'toutes' || it.rarity === compendiumRarity) &&
                  it.name.toLowerCase().includes(compendiumSearch.toLowerCase())
                )
                .map((it, idx) => {
                  const rarityColor = it.rarity === 'légendaire' ? 'text-amber-400' : it.rarity === 'très rare' ? 'text-purple-400' : it.rarity === 'rare' ? 'text-blue-400' : it.rarity === 'peu commun' ? 'text-emerald-400' : 'text-stone-400'
                  return (
                    <button
                      key={idx}
                      onClick={() => { handleAddFromCompendium(it); setShowItemCompendium(false) }}
                      className="w-full text-left bg-stone-800/60 hover:bg-stone-800 border border-stone-700/50 hover:border-violet-700/50 rounded-lg px-3 py-2.5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-white text-sm font-medium">{it.name}</span>
                          {it.attunement && <span className="ml-1.5 text-amber-400 text-xs">◈ syntonie</span>}
                          <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">{it.description}</p>
                        </div>
                        <span className={`text-xs shrink-0 ${rarityColor} capitalize`}>{it.rarity}</span>
                      </div>
                    </button>
                  )
                })
              }
              {MAGIC_ITEMS.filter(it =>
                (compendiumRarity === 'toutes' || it.rarity === compendiumRarity) &&
                it.name.toLowerCase().includes(compendiumSearch.toLowerCase())
              ).length === 0 && (
                <p className="text-stone-600 text-sm text-center py-8">Aucun objet trouvé.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast: sort lancé */}
      {castFeedback && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-violet-900/95 border border-violet-600/60 text-violet-100 rounded-xl px-4 py-3 shadow-xl animate-fade-in pointer-events-none">
          <span className="text-lg">✨</span>
          <div>
            <p className="text-sm font-semibold">{castFeedback.name}</p>
            <p className="text-xs text-violet-300">
              {castFeedback.slotLevel === 0 ? 'Cantrip lancé' : `Emplacement de niveau ${castFeedback.slotLevel} utilisé`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
