import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { listCharacters, setInitiativeRoll, type Character, type DiceRoll } from '../api/characters'
import { getCampaign, type Campaign } from '../api/campaigns'
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

// ── Sub-components ────────────────────────────────────────────────────────────

function InitInput({
  character,
  onSet,
}: {
  character: Character
  onSet: (id: number, roll: number | null) => void
}) {
  const [draft, setDraft] = useState(
    character.combat.initiative_roll != null
      ? String(character.combat.initiative_roll)
      : '',
  )

  // sync when parent updates (WS)
  useEffect(() => {
    setDraft(
      character.combat.initiative_roll != null
        ? String(character.combat.initiative_roll)
        : '',
    )
  }, [character.combat.initiative_roll])

  function commit() {
    const n = parseInt(draft, 10)
    onSet(character.id, isNaN(n) ? null : n)
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit() }}
        placeholder={sign(character.combat.initiative)}
        className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {character.combat.initiative_roll == null && (
        <span className="text-stone-600 text-xs">(mod {sign(character.combat.initiative)})</span>
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
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTurn, setActiveTurn] = useState(0)
  const [diceLog, setDiceLog] = useState<DiceRoll[]>([])

  // Map id→round for WS subscriptions cleanup
  const echoRefs = useRef<Map<number, ReturnType<typeof createEcho>>>(new Map())

  // Load characters (all or filtered to campaign)
  useEffect(() => {
    if (campaignId) {
      getCampaign(campaignId)
        .then(c => { setCampaign(c); setCharacters(c.characters) })
        .catch(() => navigate('/campaigns'))
        .finally(() => setLoading(false))
    } else {
      listCharacters()
        .then(setCharacters)
        .catch(() => navigate('/characters'))
        .finally(() => setLoading(false))
    }
  }, [campaignId, navigate])

  // Subscribe to each character's WS channel
  useEffect(() => {
    if (!token || characters.length === 0) return

    const echo = createEcho(token)
    echoRefs.current.clear()

    characters.forEach(c => {
      echo.private(`character.${c.id}`)
        .listen('.character.updated', (e: { character: Character }) => {
          setCharacters(prev => prev.map(ch => ch.id === e.character.id ? e.character : ch))
        })
        .listen('.dice.rolled', (e: DiceRoll) => {
          setDiceLog(log => [e, ...log].slice(0, 50))
        })
    })

    return () => {
      characters.forEach(c => echo.leave(`character.${c.id}`))
      echo.disconnect()
    }
  }, [token, characters.map(c => c.id).join(',')])

  // Characters sorted by initiative_roll (desc), then by initiative modifier (tiebreak)
  const sorted = [...characters].sort((a, b) => {
    const ra = a.combat.initiative_roll ?? -Infinity
    const rb = b.combat.initiative_roll ?? -Infinity
    if (rb !== ra) return (rb as number) - (ra as number)
    return b.combat.initiative - a.combat.initiative
  })

  const withRoll = sorted.filter(c => c.combat.initiative_roll != null)
  const withoutRoll = sorted.filter(c => c.combat.initiative_roll == null)

  function updateCharacter(updated: Character) {
    setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  async function handleSetInitiative(id: number, roll: number | null) {
    const updated = await setInitiativeRoll(id, roll)
    updateCharacter(updated)
  }

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  // Reset all initiatives
  async function handleReset() {
    await Promise.all(characters.map(c => setInitiativeRoll(c.id, null)))
    setCharacters(prev => prev.map(c => ({
      ...c,
      combat: { ...c.combat, initiative_roll: null },
    })))
    setActiveTurn(0)
  }

  // Advance to next living character in sorted order
  function nextTurn() {
    if (withRoll.length === 0) return
    setActiveTurn(t => (t + 1) % withRoll.length)
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

  const activeCombatant = withRoll[activeTurn % withRoll.length] ?? null

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
              <p className="text-white font-bold text-lg">{activeCombatant?.name ?? '—'}</p>
              {activeCombatant && (
                <p className="text-stone-400 text-xs mt-0.5">
                  {activeCombatant.race} · {activeCombatant.character_class} · Niv. {activeCombatant.level}
                  {' · '}{activeCombatant.combat.current_hp}/{activeCombatant.combat.max_hp} PV
                </p>
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
            <button
              onClick={handleReset}
              className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
            >
              Réinitialiser
            </button>
          </div>

          {characters.length === 0 ? (
            <div className="px-5 py-10 text-center text-stone-500 text-sm">
              Aucun personnage.{' '}
              <Link to="/characters" className="text-amber-400 hover:text-amber-300">
                Créer un personnage
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-800">
              {[...withRoll, ...withoutRoll].map((character) => {
                const isActive = withRoll.length > 0 && character.id === activeCombatant?.id
                const isDying = character.combat.current_hp <= 0
                const hpPct = Math.max(0, Math.min(100,
                  (character.combat.current_hp / character.combat.max_hp) * 100,
                ))
                const position = withRoll.indexOf(character)

                return (
                  <div
                    key={character.id}
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

                      {/* Initiative input */}
                      <div className="w-36 shrink-0">
                        <InitInput character={character} onSet={handleSetInitiative} />
                      </div>

                      {/* Name + identity */}
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
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <p className="text-stone-600 text-xs text-center">
          Cliquer sur le champ d'initiative pour le modifier · Le tour actif est mis en surbrillance · Les PV se synchronisent en temps réel
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
