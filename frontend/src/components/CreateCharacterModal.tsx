import { useState } from 'react'
import { createCharacter, updateAbilities, updateProficiencies, type Character } from '../api/characters'
import { ApiError } from '../api/client'

interface Props {
  campaignId: number
  onCreated: () => void
  onClose: () => void
}

// ── Data ──────────────────────────────────────────────────────────────────────

const RACES = [
  'Humain', 'Elfe', 'Haut-Elfe', 'Elfe Sylvestre', 'Nain', 'Halfelin', 'Gnome',
  'Demi-Elfe', 'Demi-Orc', 'Tiefelin', 'Dragonnet', 'Aasimar',
]

interface ClassInfo { name: string; hit_die: number; saves: string[] }

const CLASSES: ClassInfo[] = [
  { name: 'Barbare',      hit_die: 12, saves: ['strength', 'constitution'] },
  { name: 'Barde',        hit_die:  8, saves: ['dexterity', 'charisma'] },
  { name: 'Clerc',        hit_die:  8, saves: ['wisdom', 'charisma'] },
  { name: 'Druide',       hit_die:  8, saves: ['intelligence', 'wisdom'] },
  { name: 'Guerrier',     hit_die: 10, saves: ['strength', 'constitution'] },
  { name: 'Moine',        hit_die:  8, saves: ['strength', 'dexterity'] },
  { name: 'Paladin',      hit_die: 10, saves: ['wisdom', 'charisma'] },
  { name: 'Rôdeur',       hit_die: 10, saves: ['strength', 'dexterity'] },
  { name: 'Roublard',     hit_die:  8, saves: ['dexterity', 'intelligence'] },
  { name: 'Ensorceleur',  hit_die:  6, saves: ['constitution', 'charisma'] },
  { name: 'Occultiste',   hit_die:  8, saves: ['wisdom', 'charisma'] },
  { name: 'Magicien',     hit_die:  6, saves: ['intelligence', 'wisdom'] },
]

const ABILITIES = [
  { key: 'strength',     label: 'FOR', full: 'Force' },
  { key: 'dexterity',    label: 'DEX', full: 'Dextérité' },
  { key: 'constitution', label: 'CON', full: 'Constitution' },
  { key: 'intelligence', label: 'INT', full: 'Intelligence' },
  { key: 'wisdom',       label: 'SAG', full: 'Sagesse' },
  { key: 'charisma',     label: 'CHA', full: 'Charisme' },
]

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

type AbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'

function modifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

function sign(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

// ── Wizard ────────────────────────────────────────────────────────────────────

export function CreateCharacterModal({ campaignId, onCreated, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 1
  const [name, setName] = useState('')
  const [race, setRace] = useState('')
  const [className, setClassName] = useState('')
  const [level, setLevel] = useState(1)
  const [background, setBackground] = useState('')

  // Step 2 — scores de caractéristiques
  const [scoreMode, setScoreMode] = useState<'array' | 'manual'>('array')
  const [assignments, setAssignments] = useState<Record<AbilityKey, number | ''>>({
    strength: '', dexterity: '', constitution: '',
    intelligence: '', wisdom: '', charisma: '',
  })
  const [rolled, setRolled] = useState<number[]>([])

  // Derived
  const classInfo = CLASSES.find(c => c.name === className)
  const hitDie = classInfo?.hit_die ?? 8
  const conMod = modifier(Number(assignments.constitution) || 10)
  const dexMod = modifier(Number(assignments.dexterity) || 10)
  const computedHp = hitDie + conMod * level
  const computedAc = 10 + dexMod

  // Step 3
  const [maxHp, setMaxHp] = useState('')
  const [armorClass, setArmorClass] = useState('')

  // ── Helpers ────────────────────────────────────────────────────────────────

  function usedValues(): number[] {
    return Object.values(assignments).filter((v): v is number => v !== '')
  }

  function availableArray(): number[] {
    const used = usedValues()
    const pool = [...STANDARD_ARRAY]
    used.forEach(v => {
      const idx = pool.indexOf(v)
      if (idx !== -1) pool.splice(idx, 1)
    })
    return pool
  }

  function assignScore(ability: AbilityKey, value: number | '') {
    setAssignments(a => ({ ...a, [ability]: value }))
  }

  function rollScores(): number[] {
    const results: number[] = []
    for (let i = 0; i < 6; i++) {
      const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1)
      dice.sort((a, b) => b - a)
      results.push(dice[0] + dice[1] + dice[2])
    }
    results.sort((a, b) => b - a)
    return results
  }

  function handleRollScores() {
    const results = rollScores()
    setRolled(results)
    const reset: Record<AbilityKey, number | ''> = {
      strength: '', dexterity: '', constitution: '',
      intelligence: '', wisdom: '', charisma: '',
    }
    setAssignments(reset)
  }

  function rolledAvailable(): number[] {
    const used = usedValues()
    const pool = [...rolled]
    used.forEach(v => {
      const idx = pool.indexOf(v)
      if (idx !== -1) pool.splice(idx, 1)
    })
    return pool
  }

  const poolForMode = scoreMode === 'array' ? availableArray() : rolledAvailable()
  const allAssigned = Object.values(assignments).every(v => v !== '')

  // ── Step navigation ────────────────────────────────────────────────────────

  function goToStep2() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Le nom est requis.'
    if (!race) errs.race = 'Choisir une race.'
    if (!className) errs.className = 'Choisir une classe.'
    setErrors(errs)
    if (Object.keys(errs).length === 0) setStep(2)
  }

  function goToStep3() {
    if (!allAssigned && scoreMode !== 'manual') return
    const hp = String(Math.max(1, computedHp))
    const ac = String(Math.max(1, computedAc))
    setMaxHp(hp)
    setArmorClass(ac)
    setStep(3)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setLoading(true)
    try {
      const hp = parseInt(maxHp, 10) || 1
      const ac = parseInt(armorClass, 10) || 10

      const character: Character = await createCharacter({
        name: name.trim(),
        race,
        character_class: className,
        max_hp: hp,
        armor_class: ac,
        level,
        campaign_id: campaignId,
      })

      // Patch abilities if assigned
      if (allAssigned) {
        await updateAbilities(character.id, {
          strength:     Number(assignments.strength),
          dexterity:    Number(assignments.dexterity),
          constitution: Number(assignments.constitution),
          intelligence: Number(assignments.intelligence),
          wisdom:       Number(assignments.wisdom),
          charisma:     Number(assignments.charisma),
        })
      }

      // Patch save proficiencies based on class
      if (classInfo?.saves) {
        await updateProficiencies(character.id, classInfo.saves, [])
      }

      onCreated()
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const apiErrors = (err.data.errors as Record<string, string[]>) ?? {}
        const flat: Record<string, string> = {}
        Object.entries(apiErrors).forEach(([k, v]) => { flat[k] = v[0] })
        setErrors(flat)
        setStep(1)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold">Nouveau personnage</h2>
            <div className="flex gap-1.5">
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    s === step ? 'bg-amber-400' : s < step ? 'bg-amber-600' : 'bg-stone-700'
                  }`}
                />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 transition-colors text-xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ── Step 1 ── Identité */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-stone-500 text-xs uppercase tracking-widest font-semibold">Étape 1 — Identité</p>

              <div>
                <label className="block text-stone-300 text-sm font-medium mb-1.5">Nom *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Nom de votre personnage…"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 text-sm font-medium mb-1.5">Race *</label>
                  <select
                    value={race}
                    onChange={e => setRace(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value="">Choisir…</option>
                    {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {errors.race && <p className="text-red-400 text-xs mt-1">{errors.race}</p>}
                </div>

                <div>
                  <label className="block text-stone-300 text-sm font-medium mb-1.5">Classe *</label>
                  <select
                    value={className}
                    onChange={e => setClassName(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value="">Choisir…</option>
                    {CLASSES.map(c => <option key={c.name} value={c.name}>{c.name} (d{c.hit_die})</option>)}
                  </select>
                  {errors.className && <p className="text-red-400 text-xs mt-1">{errors.className}</p>}
                </div>
              </div>

              {classInfo && (
                <p className="text-stone-600 text-xs">
                  Jets de sauvegarde maîtrisés : {classInfo.saves.map(s => ABILITIES.find(a => a.key === s)?.label).join(', ')}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 text-sm font-medium mb-1.5">Niveau</label>
                  <input
                    type="number"
                    min={1} max={20}
                    value={level}
                    onChange={e => setLevel(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-stone-300 text-sm font-medium mb-1.5">Background</label>
                  <input
                    type="text"
                    value={background}
                    onChange={e => setBackground(e.target.value)}
                    placeholder="Soldat, Criminel…"
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2 ── Caractéristiques */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-stone-500 text-xs uppercase tracking-widest font-semibold">Étape 2 — Caractéristiques</p>

              {/* Mode toggle */}
              <div className="flex gap-2">
                {(['array', 'manual'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => {
                      setScoreMode(mode)
                      setAssignments({ strength: '', dexterity: '', constitution: '', intelligence: '', wisdom: '', charisma: '' })
                      setRolled([])
                    }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      scoreMode === mode
                        ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                        : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'
                    }`}
                  >
                    {mode === 'array' ? 'Tableau standard' : 'Saisie libre'}
                  </button>
                ))}
              </div>

              {scoreMode === 'array' && (
                <div className="bg-stone-800/50 rounded-lg p-3 flex flex-wrap gap-2">
                  <span className="text-stone-500 text-xs w-full">Valeurs disponibles :</span>
                  {STANDARD_ARRAY.map((v, i) => {
                    const available = availableArray()
                    const taken = !available.includes(v) || available.filter(x => x === v).length < STANDARD_ARRAY.filter(x => x === v).length
                    return (
                      <span
                        key={i}
                        className={`text-sm font-bold px-3 py-1 rounded-lg border ${
                          taken
                            ? 'bg-stone-700/40 border-stone-700 text-stone-600 line-through'
                            : 'bg-stone-700 border-stone-600 text-white'
                        }`}
                      >
                        {v}
                      </span>
                    )
                  })}
                </div>
              )}

              {scoreMode === 'manual' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRollScores}
                    className="bg-rose-700/30 hover:bg-rose-700/50 border border-rose-700/50 text-rose-300 text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                  >
                    ⚅ Lancer 4d6
                  </button>
                  {rolled.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {rolled.map((v, i) => (
                        <span key={i} className={`text-sm font-bold px-2.5 py-1 rounded-lg border ${
                          rolledAvailable().includes(v) ? 'bg-stone-700 border-stone-600 text-white' : 'bg-stone-700/40 border-stone-700 text-stone-600 line-through'
                        }`}>{v}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Assignment grid */}
              <div className="space-y-2">
                {ABILITIES.map(ability => {
                  const val = assignments[ability.key as AbilityKey]
                  const mod = val !== '' ? modifier(Number(val)) : null
                  const isSaveProficient = classInfo?.saves.includes(ability.key) ?? false

                  return (
                    <div key={ability.key} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-24 shrink-0">
                        {isSaveProficient && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Jet de sauvegarde maîtrisé" />
                        )}
                        {!isSaveProficient && <span className="w-2 h-2 shrink-0" />}
                        <span className="text-stone-300 text-sm font-medium">{ability.full}</span>
                      </div>

                      {scoreMode === 'array' ? (
                        <select
                          value={val}
                          onChange={e => assignScore(ability.key as AbilityKey, e.target.value === '' ? '' : Number(e.target.value))}
                          className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        >
                          <option value="">—</option>
                          {val !== '' && <option value={Number(val)}>{Number(val)}</option>}
                          {poolForMode.map((v, i) => (
                            <option key={i} value={v}>{v}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          min={1} max={30}
                          value={val}
                          onChange={e => assignScore(ability.key as AbilityKey, e.target.value === '' ? '' : Math.max(1, Math.min(30, parseInt(e.target.value) || 10)))}
                          placeholder="10"
                          className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      )}

                      {mod !== null ? (
                        <span className={`text-sm font-bold w-8 text-right shrink-0 ${
                          mod > 0 ? 'text-emerald-400' : mod < 0 ? 'text-red-400' : 'text-stone-400'
                        }`}>
                          {sign(mod)}
                        </span>
                      ) : (
                        <span className="w-8 shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>

              {allAssigned && (
                <p className="text-stone-500 text-xs">
                  PV estimés : {hitDie} + {conMod >= 0 ? '+' : ''}{conMod} (CON) = <span className="text-white font-semibold">{computedHp}</span>
                  {level > 1 && ` × Niv.${level} = ${Math.max(1, computedHp)}`}
                  {'  ·  '}CA de base : 10 + {dexMod} (DEX) = <span className="text-white font-semibold">{computedAc}</span>
                </p>
              )}
            </div>
          )}

          {/* ── Step 3 ── Finaliser */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-stone-500 text-xs uppercase tracking-widest font-semibold">Étape 3 — Finaliser</p>

              <div className="bg-stone-800/60 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Nom</span>
                  <span className="text-white font-medium">{name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Race · Classe</span>
                  <span className="text-white">{race} · {className} (d{hitDie})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Niveau</span>
                  <span className="text-white">{level}</span>
                </div>
                {allAssigned && (
                  <div className="flex justify-between text-sm flex-wrap gap-x-4">
                    <span className="text-stone-400">Caractéristiques</span>
                    <span className="text-stone-300 text-xs font-mono">
                      {ABILITIES.map(a => `${a.label} ${assignments[a.key as AbilityKey]}`).join('  ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 text-sm font-medium mb-1.5">
                    PV max *
                    {allAssigned && (
                      <span className="text-stone-600 text-xs font-normal ml-1">(auto : {computedHp})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxHp}
                    onChange={e => setMaxHp(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block text-stone-300 text-sm font-medium mb-1.5">
                    CA *
                    {allAssigned && (
                      <span className="text-stone-600 text-xs font-normal ml-1">(auto : {computedAc})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={armorClass}
                    onChange={e => setArmorClass(e.target.value)}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {errors.max_hp && <p className="text-red-400 text-xs">{errors.max_hp}</p>}
              {errors.armor_class && <p className="text-red-400 text-xs">{errors.armor_class}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-stone-800 shrink-0">
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={loading}
              className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium rounded-lg py-2.5 text-sm transition-colors disabled:opacity-40"
            >
              ← Retour
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              Annuler
            </button>
          )}

          {step === 1 && (
            <button
              onClick={goToStep2}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              Suivant →
            </button>
          )}
          {step === 2 && (
            <button
              onClick={goToStep3}
              disabled={scoreMode === 'array' && !allAssigned}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-stone-700 disabled:text-stone-500 text-stone-950 font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              Suivant →
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleSubmit}
              disabled={loading || !maxHp || !armorClass}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading ? 'Création…' : 'Créer le personnage'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
