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
  updateIdentity,
  updateNotes,
  shortRest,
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
} from '../api/characters'
import { logout } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { createEcho } from '../lib/echo'
import { SRD_SPELLS } from '../data/spells'

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

const CONDITIONS: Record<string, string> = {
  blinded:        'Aveuglé',
  charmed:        'Charmé',
  deafened:       'Assourdi',
  exhaustion:     'Épuisé',
  frightened:     'Effrayé',
  grappled:       'Agrippé',
  incapacitated:  'Hors de combat',
  invisible:      'Invisible',
  paralyzed:      'Paralysé',
  petrified:      'Pétrifié',
  poisoned:       'Empoisonné',
  prone:          'À terre',
  restrained:     'Entravé',
  stunned:        'Étourdi',
  unconscious:    'Inconscient',
}

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
  const { id } = useParams<{ id: string }>()
  const { token, user, clearAuth } = useAuth()
  const navigate = useNavigate()

  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

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
      race: character.race,
      character_class: character.character_class,
      subclass: character.subclass ?? '',
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
    if (!id || !token) return
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

  async function withSave<T>(fn: () => Promise<T>): Promise<T | undefined> {
    isSelfUpdate.current = true
    setSaving(true)
    try {
      return await fn()
    } catch {
      // TODO: toast error
    } finally {
      setSaving(false)
      // Give the broadcast a tick to arrive before we clear the flag
      setTimeout(() => { isSelfUpdate.current = false }, 500)
    }
  }

  async function handleHp(type: 'damage' | 'heal') {
    const amount = parseInt(hpInput, 10)
    if (!amount || amount <= 0 || !character) return
    const updated = await withSave(() => updateHp(character.id, amount, type))
    if (updated) { setCharacter(updated); setHpInput('') }
  }

  async function handleTempHp() {
    const amount = parseInt(tempInput, 10)
    if (isNaN(amount) || amount < 0 || !character) return
    const updated = await withSave(() => updateHp(character.id, amount, 'temporary'))
    if (updated) setCharacter(updated)
  }

  async function toggleCondition(key: string) {
    if (!character) return
    const active = character.state.conditions
    const next = active.includes(key)
      ? active.filter(c => c !== key)
      : [...active, key]
    const updated = await withSave(() => updateConditions(character.id, next))
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
    const next = current.includes(skill)
      ? current.filter(s => s !== skill)
      : [...current, skill]
    const updated = await withSave(() => updateProficiencies(character.id, saveProfs, next))
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

  async function handleAddSpell() {
    if (!character || !spellNameDraft.trim()) return
    const lvl = parseInt(spellLevelDraft, 10)
    const newSpell: Spell = { name: spellNameDraft.trim(), level: isNaN(lvl) ? 0 : lvl, prepared: true }
    const next = [...character.spellcasting.spells, newSpell]
    const updated = await withSave(() => updateSpells(character.id, next))
    if (updated) {
      setCharacter(updated)
      setSpellNameDraft('')
      setSpellLevelDraft('1')
      setAddingSpell(false)
    }
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

  // ── Concentration ────────────────────────────────────────────────────────────

  async function handleConcentrate(spellName: string) {
    if (!character) return
    const next = character.state.concentrating_on === spellName ? null : spellName
    const updated = await withSave(() => updateConcentration(character.id, next))
    if (updated) setCharacter(updated)
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

  useEffect(() => {
    if (character) setNotesDraft(character.notes ?? '')
  }, [character?.id])

  async function handleSaveNotes() {
    if (!character || !notesDirty) return
    const updated = await withSave(() => updateNotes(character.id, notesDraft))
    if (updated) { setCharacter(updated); setNotesDirty(false) }
  }

  // ── Inventory ─────────────────────────────────────────────────────────────────

  interface ItemDraft { name: string; quantity: string; weight: string; value: string }
  const emptyItemDraft = (): ItemDraft => ({ name: '', quantity: '1', weight: '0', value: '' })
  const [addingItem, setAddingItem] = useState(false)
  const [itemDraft, setItemDraft]   = useState<ItemDraft>(emptyItemDraft)

  async function handleAddItem() {
    if (!character || !itemDraft.name.trim()) return
    const item: InventoryItem = {
      name:     itemDraft.name.trim(),
      quantity: Math.max(1, parseInt(itemDraft.quantity, 10) || 1),
      weight:   parseFloat(itemDraft.weight) || 0,
      value:    itemDraft.value.trim(),
      equipped: false,
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

  // ── Dice panel ───────────────────────────────────────────────────────────────

  const [diceOpen, setDiceOpen]         = useState(false)
  const [rollHistory, setRollHistory]   = useState<DiceRoll[]>([])
  const [selectedSides, setSelectedSides] = useState(20)
  const [diceModInput, setDiceModInput] = useState('')
  const [advantage, setAdvantage]       = useState<'none' | 'adv' | 'dis'>('none')
  const [lastRoll, setLastRoll]         = useState<DiceRoll | null>(null)

  // WS: also capture dice.rolled events
  useEffect(() => {
    if (!id || !token) return
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
    handleRoll({ sides, modifier, label, count: 1 })
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
              to="/characters"
              className="text-stone-400 hover:text-stone-200 transition-colors text-sm shrink-0"
            >
              ← Retour
            </Link>
            <span className="text-stone-700">|</span>
            <span className="text-amber-400 font-bold truncate">{character.name}</span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {saving && (
              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            )}
            <button
              onClick={() => setDiceOpen(v => !v)}
              className={`text-sm font-bold px-3 py-1 rounded-lg border transition-colors ${
                diceOpen
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-500'
              }`}
            >
              ⚅ Dés
            </button>
            <span className="text-stone-400 text-sm hidden sm:block">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-stone-400 hover:text-stone-200 text-sm transition-colors"
            >
              Déconnexion
            </button>
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
              <div className="flex items-center justify-between pt-1">
                <button onClick={() => setEditingIdentity(false)} className="text-stone-500 hover:text-stone-300 text-sm transition-colors">Annuler</button>
                <button onClick={saveIdentity} disabled={saving} className="text-amber-400 hover:text-amber-300 text-sm font-semibold transition-colors disabled:opacity-40">Enregistrer</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-white">{character.name}</h1>
                <p className="text-stone-400 mt-0.5">
                  {character.race} · {character.character_class}
                  {character.subclass && <span className="text-stone-500"> ({character.subclass})</span>}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {character.background && (
                    <span className="text-stone-500 text-xs">{character.background}</span>
                  )}
                  {character.alignment && (
                    <span className="text-stone-500 text-xs">{character.alignment}</span>
                  )}
                  {character.experience_points > 0 && (
                    <span className="text-stone-500 text-xs">{character.experience_points} XP</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-sm rounded-lg px-3 py-1.5">
                  Niveau {character.level}
                </span>
                <button onClick={startEditIdentity} className="text-stone-600 hover:text-stone-400 text-xs transition-colors">
                  Modifier
                </button>
              </div>
            </div>
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
                      <span
                        className={`text-sm font-bold w-8 text-right ${
                          mod > 0
                            ? 'text-emerald-400'
                            : mod < 0
                              ? 'text-red-400'
                              : 'text-stone-400'
                        }`}
                      >
                        {sign(mod)}
                      </span>
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
                    <div key={ability} className="flex items-center justify-between py-1">
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
                      <div className="flex items-center gap-2">
                        <span className="text-stone-500 text-xs font-mono">{ABILITY_ABBR[ability]}</span>
                        <span className={`text-xs font-bold w-7 text-right ${
                          save.modifier > 0 ? 'text-emerald-400' : save.modifier < 0 ? 'text-red-400' : 'text-stone-400'
                        }`}>
                          {sign(save.modifier)}
                        </span>
                      </div>
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

            {/* Combat stats */}
            <div className="grid grid-cols-4 gap-3">
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

              {/* Damage / Heal */}
              <div className="flex gap-2">
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
                  className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
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

              {/* Concentration banner */}
              {character.state.concentrating_on && (
                <div className="mt-3 flex items-center justify-between gap-2 bg-violet-950/50 border border-violet-700/50 rounded-lg px-3 py-2">
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
                {Object.entries(CONDITIONS).map(([key, label]) => {
                  const active = activeConditions.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleCondition(key)}
                      disabled={saving}
                      className={`rounded-lg px-2 py-2 text-xs font-medium text-center transition-colors disabled:cursor-not-allowed ${
                        active
                          ? 'bg-purple-600 border border-purple-500 text-white'
                          : 'bg-stone-800 border border-stone-700 text-stone-400 hover:border-stone-600 hover:text-stone-300'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
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

        {/* Skills */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-4">
            Compétences
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0.5">
            {SKILL_LABELS.map(([skill, label]) => {
              const entry = character.skills[skill]
              return (
                <div key={skill} className="flex items-center justify-between py-1.5 border-b border-stone-800/60">
                  <div className="flex items-center gap-2 min-w-0">
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
                    <span className="text-stone-300 text-xs truncate">{label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-stone-500 text-xs font-mono">{ABILITY_ABBR[entry.ability]}</span>
                    <span className={`text-xs font-bold w-7 text-right ${
                      entry.modifier > 0 ? 'text-emerald-400' : entry.modifier < 0 ? 'text-red-400' : 'text-stone-400'
                    }`}>
                      {sign(entry.modifier)}
                    </span>
                  </div>
                </div>
              )
            })}
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
                return (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-24 h-1.5 bg-stone-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-stone-500 text-xs">
                      {total.toFixed(1)} / {character.inventory.capacity} kg
                    </span>
                  </div>
                )
              })()}
            </div>
            <button
              onClick={() => { setAddingItem(v => !v); setItemDraft(emptyItemDraft()) }}
              className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
            >
              {addingItem ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

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
                type="text"
                placeholder="Valeur (ex: 15 po)"
                value={itemDraft.value}
                onChange={e => setItemDraft(d => ({ ...d, value: e.target.value }))}
                className="w-36 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
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
              {character.inventory.items.map((item, i) => (
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

                  {/* Name */}
                  <span className={`flex-1 min-w-0 text-sm truncate ${item.equipped ? 'text-white font-medium' : 'text-stone-300'}`}>
                    {item.name}
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
                  {item.value && (
                    <span className="text-amber-600 text-xs w-16 text-right shrink-0 truncate">{item.value}</span>
                  )}

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

        {/* Spells known */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Sorts
            </h2>
            <button
              onClick={() => setAddingSpell(v => !v)}
              className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
            >
              {addingSpell ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

          {/* Add spell form */}
          {addingSpell && (
            <div className="mb-4 pb-4 border-b border-stone-800">
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
            </div>
          )}

          {character.spellcasting.spells.length === 0 ? (
            <p className="text-stone-500 text-sm">Aucun sort enregistré.</p>
          ) : (
            <div className="space-y-4">
              {[0,1,2,3,4,5,6,7,8,9].map(lvl => {
                const spells = character.spellcasting.spells
                  .map((s, i) => ({ ...s, _idx: i }))
                  .filter(s => s.level === lvl)
                if (spells.length === 0) return null
                return (
                  <div key={lvl}>
                    <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-2">
                      {SPELL_LEVEL_LABELS[lvl]}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {spells.map(spell => (
                        {(() => {
                          const isConcentrating = character.state.concentrating_on === spell.name
                          return (
                            <div
                              key={spell._idx}
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
                              <span>{spell.name}</span>
                              <button
                                onClick={() => handleConcentrate(spell.name)}
                                disabled={saving}
                                title={isConcentrating ? 'Relâcher la concentration' : 'Se concentrer sur ce sort'}
                                className={`ml-1 text-xs transition-colors disabled:cursor-not-allowed ${
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
                          )
                        })()}
                      ))}
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
            <button
              onClick={() => { setAddingFeature(v => !v); setFeatureDraft(emptyFeatureDraft()) }}
              className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
            >
              {addingFeature ? 'Annuler' : '+ Ajouter'}
            </button>
          </div>

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
              {character.features.map((f, i) => (
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
                          <p className="text-stone-400 text-sm whitespace-pre-wrap leading-relaxed">
                            {f.description}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Notes</h2>
            {notesDirty && (
              <button
                onClick={handleSaveNotes}
                disabled={saving}
                className="text-amber-400 hover:text-amber-300 text-xs font-semibold transition-colors disabled:opacity-40"
              >
                Enregistrer
              </button>
            )}
          </div>
          <textarea
            value={notesDraft}
            onChange={e => { setNotesDraft(e.target.value); setNotesDirty(true) }}
            onBlur={handleSaveNotes}
            placeholder="Notes libres sur ce personnage…"
            rows={5}
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors resize-y"
          />
        </div>
      </main>
    </div>
  )
}
