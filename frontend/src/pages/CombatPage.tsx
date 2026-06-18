import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { listCharacters, setInitiativeRoll, type Character, type DiceRoll } from '../api/characters'
import { getCampaign, type Campaign } from '../api/campaigns'
import {
  listCombatants,
  createCombatant,
  updateCombatantHp,
  updateCombatantInitiative,
  deleteCombatant,
  type Combatant,
} from '../api/combatants'
import { logout } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { createEcho } from '../lib/echo'

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

const CONDITIONS_FR: Record<string, string> = {
  blinded: 'Aveuglé', charmed: 'Charmé', deafened: 'Assourdi',
  exhaustion: 'Épuisé', frightened: 'Effrayé', grappled: 'Agrippé',
  incapacitated: 'Hors de combat', invisible: 'Invisible', paralyzed: 'Paralysé',
  petrified: 'Pétrifié', poisoned: 'Empoisonné', prone: 'À terre',
  restrained: 'Entravé', stunned: 'Étourdi', unconscious: 'Inconscient',
}

// ── Unified row type ──────────────────────────────────────────────────────────

type CombatRow =
  | { kind: 'character'; initiativeRoll: number | null; data: Character }
  | { kind: 'combatant'; initiativeRoll: number | null; data: Combatant }

function rowId(row: CombatRow): string {
  return `${row.kind}-${row.data.id}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InitInput({
  value,
  mod,
  onSet,
}: {
  value: number | null
  mod: number
  onSet: (roll: number | null) => void
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : '')

  useEffect(() => {
    setDraft(value != null ? String(value) : '')
  }, [value])

  function commit() {
    const n = parseInt(draft, 10)
    onSet(isNaN(n) ? null : n)
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit() }}
        placeholder={sign(mod)}
        className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {value == null && (
        <span className="text-stone-600 text-xs">(mod {sign(mod)})</span>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CombatPage() {
  const { token, user, clearAuth } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const campaignId = searchParams.get('campaign') ? Number(searchParams.get('campaign')) : null

  const [characters, setCharacters] = useState<Character[]>([])
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTurn, setActiveTurn] = useState(0)
  const [diceLog, setDiceLog] = useState<DiceRoll[]>([])
  const [actionState, setActionState] = useState<Record<string, { action: boolean; bonus: boolean; reaction: boolean }>>({})

  // Combatant HP input per combatant id
  const [combatantHpInputs, setCombatantHpInputs] = useState<Record<number, string>>({})

  // Add combatant form
  const [addingCombatant, setAddingCombatant] = useState(false)
  const [combatantDraft, setCombatantDraft] = useState({ name: '', max_hp: '', ac: '', initiative: '' })

  const echoRef = useRef<ReturnType<typeof createEcho> | null>(null)

  // Load characters + combatants
  useEffect(() => {
    if (campaignId) {
      Promise.all([getCampaign(campaignId), listCombatants(campaignId)])
        .then(([c, cbs]) => {
          setCampaign(c)
          setCharacters(c.characters)
          setCombatants(cbs)
        })
        .catch(() => navigate('/campaigns'))
        .finally(() => setLoading(false))
    } else {
      listCharacters()
        .then(setCharacters)
        .catch(() => navigate('/characters'))
        .finally(() => setLoading(false))
    }
  }, [campaignId, navigate])

  // WS subscriptions
  useEffect(() => {
    if (!token || (characters.length === 0 && combatants.length === 0)) return

    const echo = createEcho(token)
    echoRef.current = echo

    characters.forEach(c => {
      echo.private(`character.${c.id}`)
        .listen('.character.updated', (e: { character: Character }) => {
          setCharacters(prev => prev.map(ch => ch.id === e.character.id ? e.character : ch))
        })
        .listen('.dice.rolled', (e: DiceRoll) => {
          setDiceLog(log => [e, ...log].slice(0, 50))
        })
    })

    combatants.forEach(cb => {
      echo.private(`combatant.${cb.id}`)
        .listen('.combatant.updated', (e: { combatant: Combatant }) => {
          setCombatants(prev => prev.map(c => c.id === e.combatant.id ? e.combatant : c))
        })
    })

    return () => {
      characters.forEach(c => echo.leave(`character.${c.id}`))
      combatants.forEach(cb => echo.leave(`combatant.${cb.id}`))
      echo.disconnect()
      echoRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, characters.map(c => c.id).join(','), combatants.map(c => c.id).join(',')])

  // Build unified sorted list
  const allRows: CombatRow[] = [
    ...characters.map(c => ({ kind: 'character' as const, initiativeRoll: c.combat.initiative_roll, data: c })),
    ...combatants.map(c => ({ kind: 'combatant' as const, initiativeRoll: c.initiative_roll, data: c })),
  ].sort((a, b) => {
    const ra = a.initiativeRoll ?? -Infinity
    const rb = b.initiativeRoll ?? -Infinity
    if (rb !== ra) return (rb as number) - (ra as number)
    // tiebreak: character initiative mod vs combatant AC (proxy)
    const modA = a.kind === 'character' ? a.data.combat.initiative : 0
    const modB = b.kind === 'character' ? b.data.combat.initiative : 0
    return modB - modA
  })

  const withRoll = allRows.filter(r => r.initiativeRoll != null)
  const withoutRoll = allRows.filter(r => r.initiativeRoll == null)
  const sorted = [...withRoll, ...withoutRoll]

  const activeCombatant = withRoll[activeTurn % Math.max(1, withRoll.length)] ?? null

  function updateCharacter(updated: Character) {
    setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  async function handleSetCharacterInitiative(id: number, roll: number | null) {
    const updated = await setInitiativeRoll(id, roll)
    updateCharacter(updated)
  }

  async function handleSetCombatantInitiative(id: number, roll: number | null) {
    if (!campaignId) return
    const updated = await updateCombatantInitiative(campaignId, id, roll)
    setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  async function handleRollAllInitiative() {
    const d20 = () => Math.floor(Math.random() * 20) + 1
    await Promise.all([
      ...characters.map(async c => {
        const roll = d20() + c.combat.initiative
        const updated = await setInitiativeRoll(c.id, roll)
        updateCharacter(updated)
      }),
      ...combatants.map(async cb => {
        if (!campaignId) return
        const roll = d20()
        const updated = await updateCombatantInitiative(campaignId, cb.id, roll)
        setCombatants(prev => prev.map(x => x.id === updated.id ? updated : x))
      }),
    ])
  }

  async function handleCombatantHp(combatantId: number, type: 'damage' | 'heal') {
    if (!campaignId) return
    const raw = combatantHpInputs[combatantId] ?? ''
    const amount = parseInt(raw, 10)
    if (!amount || amount <= 0) return
    const updated = await updateCombatantHp(campaignId, combatantId, amount, type)
    setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
    setCombatantHpInputs(prev => ({ ...prev, [combatantId]: '' }))
  }

  async function handleDeleteCombatant(id: number) {
    if (!campaignId) return
    await deleteCombatant(campaignId, id)
    setCombatants(prev => prev.filter(c => c.id !== id))
  }

  async function handleAddCombatant() {
    if (!campaignId || !combatantDraft.name.trim()) return
    const maxHp = parseInt(combatantDraft.max_hp, 10)
    if (!maxHp || maxHp < 1) return
    const created = await createCombatant(campaignId, {
      name: combatantDraft.name.trim(),
      max_hp: maxHp,
      armor_class: combatantDraft.ac ? parseInt(combatantDraft.ac, 10) || null : null,
      initiative_roll: combatantDraft.initiative ? parseInt(combatantDraft.initiative, 10) || null : null,
    })
    setCombatants(prev => [...prev, created])
    setCombatantDraft({ name: '', max_hp: '', ac: '', initiative: '' })
    setAddingCombatant(false)
  }

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  async function handleReset() {
    await Promise.all(characters.map(c => setInitiativeRoll(c.id, null)))
    setCharacters(prev => prev.map(c => ({
      ...c,
      combat: { ...c.combat, initiative_roll: null },
    })))
    if (campaignId) {
      await Promise.all(combatants.map(c => updateCombatantInitiative(campaignId, c.id, null)))
      setCombatants(prev => prev.map(c => ({ ...c, initiative_roll: null })))
    }
    setActiveTurn(0)
  }

  async function handleClearCombatants() {
    if (!campaignId || combatants.length === 0) return
    await Promise.all(combatants.map(c => deleteCombatant(campaignId, c.id)))
    setCombatants([])
  }

  function getActions(key: string) {
    return actionState[key] ?? { action: false, bonus: false, reaction: false }
  }

  function toggleAction(key: string, type: 'action' | 'bonus' | 'reaction') {
    setActionState(prev => {
      const cur = prev[key] ?? { action: false, bonus: false, reaction: false }
      return { ...prev, [key]: { ...cur, [type]: !cur[type] } }
    })
  }

  function nextTurn() {
    if (withRoll.length === 0) return
    setActiveTurn(t => {
      const next = (t + 1) % withRoll.length
      const nextRow = withRoll[next]
      if (nextRow) {
        setActionState(prev => ({ ...prev, [rowId(nextRow)]: { action: false, bonus: false, reaction: false } }))
      }
      return next
    })
  }

  function prevTurn() {
    if (withRoll.length === 0) return
    setActiveTurn(t => (t - 1 + withRoll.length) % withRoll.length)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Active row info for the turn banner
  const activeRowName = activeCombatant
    ? activeCombatant.kind === 'character'
      ? activeCombatant.data.name
      : activeCombatant.data.name
    : '—'
  const activeRowSubtitle = activeCombatant
    ? activeCombatant.kind === 'character'
      ? `${activeCombatant.data.race} · ${activeCombatant.data.character_class} · Niv. ${activeCombatant.data.level} · ${activeCombatant.data.combat.current_hp}/${activeCombatant.data.combat.max_hp} PV`
      : `Ennemi · ${activeCombatant.data.current_hp}/${activeCombatant.data.max_hp} PV${activeCombatant.data.armor_class ? ` · CA ${activeCombatant.data.armor_class}` : ''}`
    : null

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={campaign ? `/campaigns/${campaign.id}` : '/characters'}
              className="text-stone-400 hover:text-stone-200 transition-colors text-sm shrink-0"
            >
              {campaign ? `← ${campaign.name}` : '← Personnages'}
            </Link>
            <span className="text-stone-700">|</span>
            <span className="text-amber-400 font-bold">⚔ Combat Tracker</span>
            {campaign && (
              <span className="text-stone-500 text-sm hidden sm:block truncate">— {campaign.name}</span>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Turn controls */}
        {withRoll.length > 0 && (
          <div className="bg-stone-900 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-stone-400 text-xs uppercase tracking-widest mb-0.5">Tour actif</p>
              <p className="text-white font-bold text-lg">{activeRowName}</p>
              {activeRowSubtitle && (
                <p className="text-stone-400 text-xs mt-0.5">{activeRowSubtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prevTurn}
                className="bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                ← Précédent
              </button>
              <span className="text-stone-500 text-sm">
                {activeTurn + 1}/{withRoll.length}
              </span>
              <button
                onClick={nextTurn}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* Initiative table */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Ordre d'initiative
            </h2>
            <div className="flex items-center gap-3">
              {(characters.length > 0 || combatants.length > 0) && (
                <button
                  onClick={handleRollAllInitiative}
                  className="bg-amber-600/20 hover:bg-amber-600/40 border border-amber-600/40 text-amber-400 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                  title="Lance 1d20 + modificateur pour tous les participants"
                >
                  ⚅ Lancer l'initiative
                </button>
              )}
              {campaignId && combatants.length > 0 && (
                <button
                  onClick={handleClearCombatants}
                  className="text-red-600 hover:text-red-400 text-xs transition-colors"
                >
                  Vider ennemis
                </button>
              )}
              <button
                onClick={handleReset}
                className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="px-5 py-10 text-center text-stone-500 text-sm">
              Aucun combattant.{' '}
              <Link to="/characters" className="text-amber-400 hover:text-amber-300">
                Créer un personnage
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-800">
              {sorted.map((row) => {
                const isActive = withRoll.length > 0 && activeCombatant && rowId(row) === rowId(activeCombatant)
                const position = withRoll.findIndex(r => rowId(r) === rowId(row))

                if (row.kind === 'character') {
                  const character = row.data
                  const isDying = character.combat.current_hp <= 0
                  const hpPct = Math.max(0, Math.min(100,
                    (character.combat.current_hp / character.combat.max_hp) * 100,
                  ))

                  return (
                    <div
                      key={rowId(row)}
                      className={`px-5 py-4 transition-colors ${
                        isActive
                          ? 'bg-amber-500/10 border-l-2 border-amber-500'
                          : 'hover:bg-stone-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Position */}
                        <div className="w-6 shrink-0 text-center">
                          {position >= 0 ? (
                            <span className={`text-sm font-bold ${isActive ? 'text-amber-400' : 'text-stone-500'}`}>
                              {position + 1}
                            </span>
                          ) : (
                            <span className="text-stone-700 text-sm">—</span>
                          )}
                        </div>

                        {/* Initiative */}
                        <div className="w-36 shrink-0">
                          <InitInput
                            value={character.combat.initiative_roll}
                            mod={character.combat.initiative}
                            onSet={roll => handleSetCharacterInitiative(character.id, roll)}
                          />
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Link
                              to={`/characters/${character.id}`}
                              className={`font-semibold truncate hover:underline ${
                                isActive ? 'text-amber-300' : isDying ? 'text-red-400' : 'text-white'
                              }`}
                            >
                              {character.name}
                            </Link>
                            {isDying && (
                              <span className="shrink-0 text-xs bg-red-900/60 border border-red-700/50 text-red-300 rounded px-1.5 py-0.5">
                                À terre
                              </span>
                            )}
                          </div>
                          <p className="text-stone-500 text-xs truncate mt-0.5">
                            {character.race} · {character.character_class} · Niv.{character.level}
                            {' · '}CA {character.combat.armor_class}
                          </p>
                          {(character.damage_modifiers.resistances.length > 0 ||
                            character.damage_modifiers.immunities.length > 0 ||
                            character.damage_modifiers.vulnerabilities.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {character.damage_modifiers.resistances.length > 0 && (
                                <span
                                  title={`Résistances : ${character.damage_modifiers.resistances.join(', ')}`}
                                  className="text-xs bg-sky-900/60 border border-sky-700/50 text-sky-300 rounded px-1.5 py-0.5"
                                >
                                  R×{character.damage_modifiers.resistances.length}
                                </span>
                              )}
                              {character.damage_modifiers.immunities.length > 0 && (
                                <span
                                  title={`Immunités : ${character.damage_modifiers.immunities.join(', ')}`}
                                  className="text-xs bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 rounded px-1.5 py-0.5"
                                >
                                  I×{character.damage_modifiers.immunities.length}
                                </span>
                              )}
                              {character.damage_modifiers.vulnerabilities.length > 0 && (
                                <span
                                  title={`Vulnérabilités : ${character.damage_modifiers.vulnerabilities.join(', ')}`}
                                  className="text-xs bg-red-900/60 border border-red-700/50 text-red-300 rounded px-1.5 py-0.5"
                                >
                                  V×{character.damage_modifiers.vulnerabilities.length}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* HP */}
                        <div className="w-40 shrink-0 hidden sm:block">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
                              {character.combat.current_hp}
                            </span>
                            <span className="text-stone-500 text-xs">/ {character.combat.max_hp}</span>
                            {character.combat.temporary_hp > 0 && (
                              <span className="text-sky-400 text-xs font-semibold">
                                +{character.combat.temporary_hp} tmp
                              </span>
                            )}
                          </div>
                          <div className="h-2 bg-stone-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${hpColor(character.combat.current_hp, character.combat.max_hp)}`}
                              style={{ width: `${hpPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Conditions */}
                        <div className="hidden lg:flex flex-wrap gap-1 w-36 shrink-0">
                          {character.state.conditions.length === 0 ? (
                            <span className="text-stone-700 text-xs">—</span>
                          ) : (
                            character.state.conditions.map(c => (
                              <span
                                key={c}
                                className="text-xs bg-purple-900/60 border border-purple-700/50 text-purple-300 rounded px-1.5 py-0.5"
                              >
                                {CONDITIONS_FR[c] ?? c}
                              </span>
                            ))
                          )}
                        </div>

                        {/* Action economy */}
                        <div className="hidden md:flex items-center gap-1 shrink-0">
                          {(['action', 'bonus', 'reaction'] as const).map(type => {
                            const key = rowId(row)
                            const used = getActions(key)[type]
                            return (
                              <button
                                key={type}
                                onClick={() => toggleAction(key, type)}
                                title={type === 'action' ? 'Action' : type === 'bonus' ? 'Action bonus' : 'Réaction'}
                                className={`w-6 h-6 rounded text-xs font-bold border transition-colors ${
                                  used
                                    ? 'bg-stone-800 border-stone-700 text-stone-600 line-through'
                                    : type === 'action'
                                      ? 'bg-amber-600/20 border-amber-600/50 text-amber-400 hover:bg-amber-600/30'
                                      : type === 'bonus'
                                        ? 'bg-sky-600/20 border-sky-600/50 text-sky-400 hover:bg-sky-600/30'
                                        : 'bg-rose-600/20 border-rose-600/50 text-rose-400 hover:bg-rose-600/30'
                                }`}
                              >
                                {type === 'action' ? 'A' : type === 'bonus' ? 'B' : 'R'}
                              </button>
                            )
                          })}
                        </div>

                        {/* Sheet link */}
                        <Link
                          to={`/characters/${character.id}`}
                          className="text-stone-600 hover:text-stone-400 transition-colors shrink-0 text-sm"
                          title="Ouvrir la fiche"
                        >
                          ↗
                        </Link>
                      </div>
                    </div>
                  )
                }

                // Combatant row
                const cb = row.data
                const isDying = cb.current_hp <= 0
                const hpPct = Math.max(0, Math.min(100, (cb.current_hp / cb.max_hp) * 100))
                const hpInput = combatantHpInputs[cb.id] ?? ''

                return (
                  <div
                    key={rowId(row)}
                    className={`px-5 py-4 transition-colors ${
                      isActive
                        ? 'bg-red-500/10 border-l-2 border-red-500'
                        : 'hover:bg-stone-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Position */}
                      <div className="w-6 shrink-0 text-center">
                        {position >= 0 ? (
                          <span className={`text-sm font-bold ${isActive ? 'text-red-400' : 'text-stone-500'}`}>
                            {position + 1}
                          </span>
                        ) : (
                          <span className="text-stone-700 text-sm">—</span>
                        )}
                      </div>

                      {/* Initiative */}
                      <div className="w-36 shrink-0">
                        <InitInput
                          value={cb.initiative_roll}
                          mod={0}
                          onSet={roll => handleSetCombatantInitiative(cb.id, roll)}
                        />
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-semibold truncate ${isActive ? 'text-red-300' : isDying ? 'text-red-400' : 'text-white'}`}>
                            {cb.name}
                          </span>
                          <span className="shrink-0 text-xs bg-red-900/40 border border-red-800/50 text-red-400 rounded px-1.5 py-0.5">
                            Ennemi
                          </span>
                          {isDying && (
                            <span className="shrink-0 text-xs bg-stone-800 border border-stone-700 text-stone-400 rounded px-1.5 py-0.5">
                              À terre
                            </span>
                          )}
                        </div>
                        {cb.armor_class != null && (
                          <p className="text-stone-500 text-xs mt-0.5">CA {cb.armor_class}</p>
                        )}
                      </div>

                      {/* HP + controls */}
                      <div className="w-48 shrink-0 hidden sm:block">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
                            {cb.current_hp}
                          </span>
                          <span className="text-stone-500 text-xs">/ {cb.max_hp}</span>
                        </div>
                        <div className="h-2 bg-stone-700 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${hpColor(cb.current_hp, cb.max_hp)}`}
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={hpInput}
                            min={1}
                            onChange={e => setCombatantHpInputs(prev => ({ ...prev, [cb.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleCombatantHp(cb.id, 'damage') }}
                            placeholder="PV"
                            className="w-14 bg-stone-800 border border-stone-700 rounded px-1.5 py-1 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => handleCombatantHp(cb.id, 'damage')}
                            className="bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-300 text-xs rounded px-1.5 py-1 transition-colors"
                          >
                            Dmg
                          </button>
                          <button
                            onClick={() => handleCombatantHp(cb.id, 'heal')}
                            className="bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-700/50 text-emerald-300 text-xs rounded px-1.5 py-1 transition-colors"
                          >
                            Soin
                          </button>
                        </div>
                      </div>

                      {/* Conditions placeholder */}
                      <div className="hidden lg:block w-36 shrink-0">
                        {cb.conditions.length === 0 ? (
                          <span className="text-stone-700 text-xs">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {cb.conditions.map(c => (
                              <span key={c} className="text-xs bg-purple-900/60 border border-purple-700/50 text-purple-300 rounded px-1.5 py-0.5">
                                {CONDITIONS_FR[c] ?? c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action economy */}
                      <div className="hidden md:flex items-center gap-1 shrink-0">
                        {(['action', 'bonus', 'reaction'] as const).map(type => {
                          const key = rowId(row)
                          const used = getActions(key)[type]
                          return (
                            <button
                              key={type}
                              onClick={() => toggleAction(key, type)}
                              title={type === 'action' ? 'Action' : type === 'bonus' ? 'Action bonus' : 'Réaction'}
                              className={`w-6 h-6 rounded text-xs font-bold border transition-colors ${
                                used
                                  ? 'bg-stone-800 border-stone-700 text-stone-600 line-through'
                                  : type === 'action'
                                    ? 'bg-amber-600/20 border-amber-600/50 text-amber-400 hover:bg-amber-600/30'
                                    : type === 'bonus'
                                      ? 'bg-sky-600/20 border-sky-600/50 text-sky-400 hover:bg-sky-600/30'
                                      : 'bg-rose-600/20 border-rose-600/50 text-rose-400 hover:bg-rose-600/30'
                              }`}
                            >
                              {type === 'action' ? 'A' : type === 'bonus' ? 'B' : 'R'}
                            </button>
                          )
                        })}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteCombatant(cb.id)}
                        className="text-stone-700 hover:text-red-500 transition-colors shrink-0 text-sm"
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add combatant section */}
          {campaignId && (
            <div className="border-t border-stone-800 px-5 py-3">
              {!addingCombatant ? (
                <button
                  onClick={() => setAddingCombatant(true)}
                  className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                >
                  + Ajouter un ennemi / PNJ
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Nouvel adversaire</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={combatantDraft.name}
                      onChange={e => setCombatantDraft(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nom *"
                      className="col-span-2 sm:col-span-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                    />
                    <input
                      type="number"
                      value={combatantDraft.max_hp}
                      onChange={e => setCombatantDraft(prev => ({ ...prev, max_hp: e.target.value }))}
                      placeholder="PV max *"
                      min={1}
                      className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <input
                      type="number"
                      value={combatantDraft.ac}
                      onChange={e => setCombatantDraft(prev => ({ ...prev, ac: e.target.value }))}
                      placeholder="CA"
                      className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <input
                      type="number"
                      value={combatantDraft.initiative}
                      onChange={e => setCombatantDraft(prev => ({ ...prev, initiative: e.target.value }))}
                      placeholder="Initiative"
                      className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddCombatant}
                      disabled={!combatantDraft.name.trim() || !combatantDraft.max_hp}
                      className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
                    >
                      Ajouter
                    </button>
                    <button
                      onClick={() => { setAddingCombatant(false); setCombatantDraft({ name: '', max_hp: '', ac: '', initiative: '' }) }}
                      className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <p className="text-stone-600 text-xs text-center">
          Initiative modifiable · PV ennemis avec Dmg / Soin · Sync temps réel
        </p>

        {/* Dice log */}
        {diceLog.length > 0 && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Journal des jets
              </h2>
              <button
                onClick={() => setDiceLog([])}
                className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
              >
                Effacer
              </button>
            </div>
            <div className="divide-y divide-stone-800/60 max-h-64 overflow-y-auto">
              {diceLog.map((roll, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="w-10 shrink-0 text-center">
                    <span className={`font-black text-lg ${
                      roll.total >= 20 && roll.sides === 20 ? 'text-amber-400' :
                      roll.total <= roll.sides * roll.count * 0.1 ? 'text-red-400' :
                      'text-white'
                    }`}>
                      {roll.total}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-200 text-sm font-medium truncate">{roll.label}</p>
                    <p className="text-stone-500 text-xs">
                      {roll.character_name} · [{roll.rolls.join(', ')}]
                      {roll.modifier !== 0 && ` ${roll.modifier >= 0 ? '+' : ''}${roll.modifier}`}
                      {roll.advantage && ' · avantage'}
                      {roll.disadvantage && ' · désavantage'}
                    </p>
                  </div>
                  <span className="text-stone-600 text-xs shrink-0">
                    {new Date(roll.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
