import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  getCharacter,
  updateHp,
  updateConditions,
  updateDeathSaves,
  updateAbilities,
  type Character,
} from '../api/characters'
import { logout } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'

// ── Constantes ────────────────────────────────────────────────────────────────

const ABILITY_LABELS: [keyof Character['abilities'], string, string][] = [
  ['strength',     'FOR', 'Force'],
  ['dexterity',    'DEX', 'Dextérité'],
  ['constitution', 'CON', 'Constitution'],
  ['intelligence', 'INT', 'Intelligence'],
  ['wisdom',       'SAG', 'Sagesse'],
  ['charisma',     'CHA', 'Charisme'],
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
  const { user, clearAuth } = useAuth()
  const navigate = useNavigate()

  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  const [hpInput, setHpInput]         = useState('')
  const [tempInput, setTempInput]     = useState('')
  const hpRef  = useRef<HTMLInputElement>(null)
  const tempRef = useRef<HTMLInputElement>(null)

  type AbilityKey = keyof Character['abilities']
  type AbilityDraft = Record<AbilityKey, string>
  const ABILITY_KEYS: AbilityKey[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
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

  // Sync temp HP input with loaded character
  useEffect(() => {
    if (character) setTempInput(String(character.combat.temporary_hp))
  }, [character?.id])  // only on first load

  async function withSave<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setSaving(true)
    try {
      return await fn()
    } catch {
      // TODO: toast error
    } finally {
      setSaving(false)
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
    const payload: Partial<Record<AbilityKey, number>> = {}
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Identity */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{character.name}</h1>
              <p className="text-stone-400 mt-0.5">
                {character.race} · {character.character_class}
              </p>
            </div>
            <span className="shrink-0 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-sm rounded-lg px-3 py-1.5">
              Niveau {character.level}
            </span>
          </div>
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
      </main>
    </div>
  )
}
