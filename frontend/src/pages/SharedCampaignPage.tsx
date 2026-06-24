import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedCampaign } from '../api/share'
import type { Campaign, CampaignSession } from '../api/campaigns'
import type { Character } from '../api/characters'
import type { Combatant } from '../api/combatants'
import { createPublicEcho, REVERB_CONFIGURED } from '../lib/echo'
import { MarkdownText } from '../components/MarkdownText'

const CONDITIONS_FR: Record<string, string> = {
  blinded: 'Aveuglé', charmed: 'Charmé', deafened: 'Assourdi',
  exhaustion: 'Épuisé', frightened: 'Effrayé', grappled: 'Agrippé',
  incapacitated: 'Hors de combat', invisible: 'Invisible', paralyzed: 'Paralysé',
  petrified: 'Pétrifié', poisoned: 'Empoisonné', prone: 'À terre',
  restrained: 'Entravé', stunned: 'Étourdi', unconscious: 'Inconscient',
}

function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}

function CharacterCard({ c }: { c: Character }) {
  const hpPct = Math.max(0, Math.min(100, (c.combat.current_hp / c.combat.max_hp) * 100))
  const isDying = c.combat.current_hp <= 0
  const isUnconscious = c.state.conditions.includes('unconscious')

  return (
    <div className={`bg-stone-900 border rounded-2xl p-5 transition-colors ${isDying ? 'border-red-800' : 'border-stone-800'}`}>
      {/* Name + class */}
      <div className="mb-4 flex items-start gap-3">
        {c.portrait_url && (
          <img
            src={c.portrait_url}
            alt={c.name}
            className="w-14 h-14 rounded-full object-cover shrink-0 border-2 border-stone-700"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={`font-bold text-xl leading-tight ${isDying ? 'text-red-400' : 'text-white'}`}>
              {c.name}
            </h2>
            {c.combat.inspiration && (
              <span className="text-amber-400 text-sm" title="Inspiration">✦</span>
            )}
            {(isDying || isUnconscious) && (
              <span className="text-sm font-normal text-red-400">
                {isDying ? '— Mourant' : '— Inconscient'}
              </span>
            )}
          </div>
          <p className="text-stone-500 text-sm mt-0.5">
            {c.race} · {c.character_class} · Niveau {c.level}
          </p>
          {c.state.concentrating_on && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs bg-violet-900/50 border border-violet-700/50 text-violet-300 rounded-full px-2 py-0.5">
              ◈ {c.state.concentrating_on}
            </span>
          )}
        </div>
      </div>

      {/* HP section */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-stone-400 text-sm font-medium">Points de vie</span>
          <span className={`text-2xl font-bold tabular-nums ${isDying ? 'text-red-400' : 'text-white'}`}>
            {c.combat.current_hp}
            <span className="text-stone-500 text-base font-normal"> / {c.combat.max_hp}</span>
            {c.combat.temporary_hp > 0 && (
              <span className="text-sky-400 text-base font-semibold ml-1">+{c.combat.temporary_hp}</span>
            )}
          </span>
        </div>
        <div className="h-3 bg-stone-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${hpColor(c.combat.current_hp, c.combat.max_hp)}`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-stone-800 rounded-xl py-2.5 text-center">
          <p className="text-stone-500 text-xs mb-0.5">CA</p>
          <p className="text-white font-bold text-xl">{c.combat.armor_class}</p>
        </div>
        <div className="bg-stone-800 rounded-xl py-2.5 text-center">
          <p className="text-stone-500 text-xs mb-0.5">Initiative</p>
          <p className="text-white font-bold text-xl">{sign(c.combat.initiative)}</p>
        </div>
        <div className="bg-stone-800 rounded-xl py-2.5 text-center">
          <p className="text-stone-500 text-xs mb-0.5">Maîtrise</p>
          <p className="text-white font-bold text-xl">+{c.proficiency_bonus}</p>
        </div>
      </div>

      {/* Resources */}
      {c.resources.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {c.resources.map((r, i) => (
            <div key={i} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
              r.current === 0 ? 'bg-stone-800 border-stone-700' : 'bg-stone-800 border-stone-600'
            }`}>
              <span className={`text-xs font-medium ${r.current === 0 ? 'text-stone-600' : 'text-stone-300'}`}>
                {r.name}
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: r.max }, (_, j) => (
                  <div key={j} className={`w-2 h-2 rounded-full ${j < r.current ? 'bg-amber-400' : 'bg-stone-700'}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Conditions */}
      {c.state.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {c.state.conditions.map(cond => (
            <span
              key={cond}
              className="text-sm bg-purple-900/50 border border-purple-700 text-purple-300 rounded-lg px-2.5 py-1"
            >
              {CONDITIONS_FR[cond] ?? cond}
            </span>
          ))}
        </div>
      )}

      {/* Death saves */}
      {isDying && (c.state.death_saves_successes > 0 || c.state.death_saves_failures > 0) && (
        <div className="mt-3 pt-3 border-t border-stone-800 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">Succès</span>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border ${i < c.state.death_saves_successes ? 'bg-emerald-500 border-emerald-500' : 'border-stone-600'}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-400">Échecs</span>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border ${i < c.state.death_saves_failures ? 'bg-red-500 border-red-500' : 'border-stone-600'}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CombatantCard({ c }: { c: Combatant }) {
  const hpPct = Math.max(0, Math.min(100, (c.current_hp / c.max_hp) * 100))
  const isDead = c.current_hp <= 0

  return (
    <div className={`bg-stone-900 border rounded-2xl p-5 transition-colors ${isDead ? 'border-stone-700 opacity-60' : 'border-red-900/60'}`}>
      <div className="mb-3">
        <h3 className={`font-bold text-lg leading-tight ${isDead ? 'text-stone-500' : 'text-white'}`}>
          {c.name}
          <span className="ml-2 text-xs font-normal text-red-500">Ennemi</span>
        </h3>
      </div>

      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-stone-400 text-sm">PV</span>
          <span className={`text-2xl font-bold tabular-nums ${isDead ? 'text-stone-500' : 'text-white'}`}>
            {c.current_hp}
            <span className="text-stone-500 text-base font-normal"> / {c.max_hp}</span>
          </span>
        </div>
        <div className="h-3 bg-stone-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isDead ? 'bg-stone-600' :
              hpPct > 50 ? 'bg-red-600' :
              hpPct > 25 ? 'bg-orange-600' : 'bg-red-800'
            }`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      <div className="flex gap-3">
        {c.armor_class != null && (
          <div className="bg-stone-800 rounded-xl py-2 px-3 text-center">
            <p className="text-stone-500 text-xs mb-0.5">CA</p>
            <p className="text-white font-bold text-lg">{c.armor_class}</p>
          </div>
        )}
        {c.initiative_roll != null && (
          <div className="bg-stone-800 rounded-xl py-2 px-3 text-center">
            <p className="text-stone-500 text-xs mb-0.5">Initiative</p>
            <p className="text-white font-bold text-lg">{c.initiative_roll}</p>
          </div>
        )}
      </div>

      {c.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {c.conditions.map(cond => (
            <span key={cond} className="text-sm bg-purple-900/50 border border-purple-700 text-purple-300 rounded-lg px-2.5 py-1">
              {CONDITIONS_FR[cond] ?? cond}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function SharedCampaignPage() {
  const { token } = useParams<{ token: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [sessions, setSessions] = useState<CampaignSession[]>([])
  const [activeTurn, setActiveTurn] = useState<{ kind: 'character' | 'combatant'; id: number; round: number } | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getSharedCampaign(token)
      .then(c => {
        setCampaign(c)
        setCharacters(c.characters)
        setCombatants(c.combatants ?? [])
        setSessions(c.sessions ?? [])
        setLastUpdate(new Date())
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token || (characters.length === 0 && combatants.length === 0) || !REVERB_CONFIGURED) return
    const echo = createPublicEcho()
    echo.channel(`campaign-share.${token}`)
      .listen('.character.updated', (e: { character: Character }) => {
        setCharacters(prev => prev.map(ch => ch.id === e.character.id ? e.character : ch))
        setLastUpdate(new Date())
      })
      .listen('.combatant.updated', (e: { combatant: Combatant }) => {
        setCombatants(prev => {
          const exists = prev.some(c => c.id === e.combatant.id)
          if (exists) return prev.map(c => c.id === e.combatant.id ? e.combatant : c)
          return [...prev, e.combatant]
        })
        setLastUpdate(new Date())
      })
      .listen('.combat.turn-updated', (e: { active_kind: 'character' | 'combatant' | null; active_id: number | null; round: number }) => {
        if (e.active_kind && e.active_id != null) {
          setActiveTurn({ kind: e.active_kind, id: e.active_id, round: e.round })
        } else {
          setActiveTurn(null)
        }
      })
    return () => {
      echo.leave(`campaign-share.${token}`)
      echo.disconnect()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, characters.length > 0 || combatants.length > 0])

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-400 text-5xl mb-4">🔒</p>
          <p className="text-white text-lg font-semibold">Lien invalide ou révoqué</p>
          <p className="text-stone-500 text-sm mt-1">Ce lien de partage n'existe plus ou a été désactivé.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-amber-400 font-bold text-lg shrink-0">🍺 Taverne</span>
            <span className="text-stone-700">|</span>
            <span className="text-white font-semibold truncate">{campaign.name}</span>
            <span className="shrink-0 text-xs bg-emerald-900/50 border border-emerald-700 text-emerald-400 rounded-full px-2.5 py-0.5">
              En direct
            </span>
          </div>
          {lastUpdate && (
            <p className="text-stone-600 text-xs shrink-0 hidden sm:block">
              Mis à jour à {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        {campaign.description && (
          <p className="text-stone-400 text-sm">{campaign.description}</p>
        )}

        {/* Journal de session */}
        {sessions.length > 0 && (
          <section>
            <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-3">
              Journal de session
            </h2>
            <div className="space-y-3">
              {sessions.slice(0, 5).map(s => (
                <div key={s.id} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="text-white font-semibold text-sm">{s.title}</h3>
                    {s.session_date && (
                      <span className="text-stone-500 text-xs shrink-0">
                        {new Date(s.session_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {s.notes && <MarkdownText className="text-stone-400">{s.notes}</MarkdownText>}
                </div>
              ))}
            </div>
          </section>
        )}

        {characters.length === 0 && combatants.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-stone-500 text-sm">Aucun personnage dans cette campagne.</p>
          </div>
        ) : (() => {
          // Build initiative order when combat is active
          type CombatEntry =
            | { kind: 'character'; initiative_roll: number; data: Character }
            | { kind: 'combatant'; initiative_roll: number; data: Combatant }

          const allWithRoll: CombatEntry[] = [
            ...characters
              .filter(c => c.combat.initiative_roll != null)
              .map(c => ({ kind: 'character' as const, initiative_roll: c.combat.initiative_roll!, data: c })),
            ...combatants
              .filter(c => c.initiative_roll != null)
              .map(c => ({ kind: 'combatant' as const, initiative_roll: c.initiative_roll!, data: c })),
          ].sort((a, b) => b.initiative_roll - a.initiative_roll)

          const inCombat = allWithRoll.length > 0

          return (
            <>
              {/* Initiative order — shown when combat is active */}
              {inCombat && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest">
                      ⚔ Ordre d'initiative
                    </h2>
                    {activeTurn && (
                      <span className="text-amber-400 text-xs font-semibold">
                        Round {activeTurn.round}
                      </span>
                    )}
                  </div>
                  <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                    <div className="divide-y divide-stone-800">
                      {allWithRoll.map((entry, pos) => {
                        const isChar = entry.kind === 'character'
                        const c = entry.data as Character
                        const cb = entry.data as Combatant
                        const currentHp  = isChar ? c.combat.current_hp  : cb.current_hp
                        const maxHp      = isChar ? c.combat.max_hp      : cb.max_hp
                        const isDying    = currentHp <= 0
                        const hpPct      = Math.max(0, Math.min(100, (currentHp / maxHp) * 100))
                        const conditions = isChar ? c.state.conditions : cb.conditions
                        const name       = isChar ? c.name : cb.name

                        const isActive = activeTurn?.kind === entry.kind && activeTurn?.id === entry.data.id

                        return (
                          <div key={`${entry.kind}-${entry.data.id}`} className={`flex items-center gap-4 px-5 py-3 transition-colors ${isActive ? 'bg-amber-900/30 border-l-2 border-amber-400' : ''}`}>
                            {/* Position */}
                            <span className="text-stone-600 text-sm font-mono w-5 shrink-0">{pos + 1}</span>

                            {/* Initiative roll */}
                            <span className="text-amber-400 font-bold text-sm w-8 text-center shrink-0">
                              {entry.initiative_roll}
                            </span>

                            {/* Name + type */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                {isChar && c.portrait_url && (
                                  <img
                                    src={c.portrait_url}
                                    alt={c.name}
                                    className="w-6 h-6 rounded-full object-cover shrink-0 border border-stone-700"
                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                  />
                                )}
                                <span className={`font-semibold text-sm truncate ${isDying ? 'text-red-400' : 'text-white'}`}>
                                  {name}
                                </span>
                                {isChar && c.combat.inspiration && (
                                  <span className="text-amber-400 text-xs shrink-0" title="Inspiration">✦</span>
                                )}
                                {!isChar && (
                                  <span className="shrink-0 text-xs bg-red-900/40 border border-red-800/50 text-red-400 rounded px-1.5 py-0.5">
                                    Ennemi
                                  </span>
                                )}
                                {isDying && (
                                  <span className="shrink-0 text-xs bg-red-900/40 border border-red-700/50 text-red-300 rounded px-1.5 py-0.5">
                                    À terre
                                  </span>
                                )}
                              </div>
                              {(conditions.length > 0 || (isChar && c.state.concentrating_on)) && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {isChar && c.state.concentrating_on && (
                                    <span className="text-xs bg-violet-900/40 border border-violet-700/40 text-violet-300 rounded px-1.5 py-0.5">
                                      ◈ {c.state.concentrating_on}
                                    </span>
                                  )}
                                  {conditions.map(cond => (
                                    <span key={cond} className="text-xs bg-purple-900/40 border border-purple-700/40 text-purple-300 rounded px-1.5 py-0.5">
                                      {CONDITIONS_FR[cond] ?? cond}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* HP bar */}
                            <div className="w-36 shrink-0 hidden sm:block">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
                                  {currentHp}
                                </span>
                                <span className="text-stone-500 text-xs">/ {maxHp}</span>
                              </div>
                              <div className="h-2 bg-stone-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${hpColor(currentHp, maxHp)}`}
                                  style={{ width: `${hpPct}%` }}
                                />
                              </div>
                            </div>

                            {/* HP text on mobile */}
                            <div className="sm:hidden shrink-0">
                              <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
                                {currentHp}/{maxHp}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </section>
              )}

              {/* Character cards */}
              {characters.length > 0 && (
                <section>
                  <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-4">Personnages</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {characters.map(c => (
                      <CharacterCard key={c.id} c={c} />
                    ))}
                  </div>
                </section>
              )}

              {/* Combatant cards — only shown when not in combat (to avoid redundancy) */}
              {combatants.length > 0 && !inCombat && (
                <section>
                  <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-4">Ennemis & PNJ</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {combatants.map(c => (
                      <CombatantCard key={c.id} c={c} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )
        })()}
      </main>
    </div>
  )
}
