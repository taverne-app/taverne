import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedCampaign } from '../api/share'
import type { Campaign, TreasureItem } from '../api/campaigns'
import { formatGold } from '../lib/gold'
import type { Character } from '../api/characters'
import type { Combatant } from '../api/combatants'
import { createPublicEcho, REALTIME_CONFIGURED } from '../lib/echo'
import { MarkdownText } from '../components/MarkdownText'
import { FloatingDiceRoller } from '../components/FloatingDiceRoller'
import { RulesCompendium } from '../components/RulesCompendium'
import { SharedSidebar } from '../components/SharedSidebar'

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
    <div
      className={`border rounded-2xl p-5 transition-colors shadow-[0_4px_24px_rgba(0,0,0,0.4)] ${isDying ? 'border-red-300' : 'border-amber-200/70'}`}
      style={{ background: 'linear-gradient(160deg, #fdfcf8 0%, #f5ead0 100%)' }}
    >
      {/* Name + class */}
      <div className="mb-4 flex items-start gap-3">
        {c.portrait_url && (
          <img
            src={c.portrait_url}
            alt={c.name}
            className="w-14 h-14 rounded-full object-cover shrink-0 border-2 border-amber-200"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={`font-bold text-xl leading-tight ${isDying ? 'text-red-600' : 'text-stone-900'}`}>
              {c.name}
            </h2>
            {c.combat.inspiration && (
              <span className="text-amber-600 text-sm" title="Inspiration">✦</span>
            )}
            {(isDying || isUnconscious) && (
              <span className="text-sm font-normal text-red-500">
                {isDying ? '— Mourant' : '— Inconscient'}
              </span>
            )}
          </div>
          <p className="text-stone-500 text-sm mt-0.5">
            {c.race} · {c.character_class} · Niveau {c.level}
          </p>
          {c.state.concentrating_on && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs bg-violet-100/80 border border-violet-400/50 text-violet-800 rounded-full px-2 py-0.5">
              ◈ {c.state.concentrating_on}
            </span>
          )}
        </div>
      </div>

      {/* HP section */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-stone-600 text-sm font-medium">Points de vie</span>
          <span className={`text-2xl font-bold tabular-nums ${isDying ? 'text-red-600' : 'text-stone-900'}`}>
            {c.combat.current_hp}
            <span className="text-stone-500 text-base font-normal"> / {c.combat.max_hp}</span>
            {c.combat.temporary_hp > 0 && (
              <span className="text-sky-600 text-base font-semibold ml-1">+{c.combat.temporary_hp}</span>
            )}
          </span>
        </div>
        <div className="h-3 bg-amber-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${hpColor(c.combat.current_hp, c.combat.max_hp)}`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-amber-100/80 rounded-xl py-2.5 text-center">
          <p className="text-stone-500 text-xs mb-0.5">CA</p>
          <p className="text-stone-900 font-bold text-xl">{c.combat.armor_class}</p>
        </div>
        <div className="bg-amber-100/80 rounded-xl py-2.5 text-center">
          <p className="text-stone-500 text-xs mb-0.5">Initiative</p>
          <p className="text-stone-900 font-bold text-xl">{sign(c.combat.initiative)}</p>
        </div>
        <div className="bg-amber-100/80 rounded-xl py-2.5 text-center">
          <p className="text-stone-500 text-xs mb-0.5">Maîtrise</p>
          <p className="text-stone-900 font-bold text-xl">+{c.proficiency_bonus}</p>
        </div>
      </div>

      {/* Resources */}
      {c.resources.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {c.resources.map((r, i) => (
            <div key={i} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${
              r.current === 0 ? 'bg-amber-50 border-amber-200' : 'bg-amber-100/60 border-amber-300/60'
            }`}>
              <span className={`text-xs font-medium ${r.current === 0 ? 'text-stone-500' : 'text-stone-700'}`}>
                {r.name}
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: r.max }, (_, j) => (
                  <div key={j} className={`w-2 h-2 rounded-full ${j < r.current ? 'bg-amber-500' : 'bg-stone-300'}`} />
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
              className="text-sm bg-purple-100/80 border border-purple-400/50 text-purple-800 rounded-lg px-2.5 py-1"
            >
              {CONDITIONS_FR[cond] ?? cond}
            </span>
          ))}
        </div>
      )}

      {/* Death saves */}
      {isDying && (c.state.death_saves_successes > 0 || c.state.death_saves_failures > 0) && (
        <div className="mt-3 pt-3 border-t border-amber-200/60 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-600">Succès</span>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border ${i < c.state.death_saves_successes ? 'bg-emerald-500 border-emerald-500' : 'border-stone-400'}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-red-500">Échecs</span>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border ${i < c.state.death_saves_failures ? 'bg-red-500 border-red-500' : 'border-stone-400'}`}
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

import type { Quest } from '../api/campaigns'

function QuestHistory({ quests }: { quests: Quest[] }) {
  const [open, setOpen] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'failed'>('all')

  const filteredQuests = quests.filter(q => {
    const matchesFilter = historyFilter === 'all' || q.status === historyFilter
    const matchesSearch = !historySearch || q.title.toLowerCase().includes(historySearch.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <section>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-stone-500 text-xs font-semibold uppercase tracking-widest mb-3 hover:text-stone-300 transition-colors"
      >
        Historique des quêtes ({quests.length}) <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div>
          {quests.length > 3 && (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Chercher une quête…"
                className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
              />
              {(['all', 'completed', 'failed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={`text-xs px-2 py-1 rounded-lg border transition-colors ${historyFilter === f ? 'bg-stone-700 border-stone-600 text-stone-200' : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'}`}
                >
                  {f === 'all' ? `Toutes (${quests.length})` : f === 'completed' ? `✅ (${quests.filter(q => q.status === 'completed').length})` : `❌ (${quests.filter(q => q.status === 'failed').length})`}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredQuests.map(q => (
              <div key={q.id} className={`bg-stone-900 border rounded-xl p-4 ${q.status === 'completed' ? 'border-emerald-900/40' : 'border-red-900/30'}`}>
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0 mt-0.5">{q.status === 'completed' ? '✅' : '❌'}</span>
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm leading-tight ${q.status === 'completed' ? 'text-stone-300' : 'text-stone-500 line-through'}`}>{q.title}</p>
                    {q.giver && <p className="text-stone-600 text-xs mt-0.5">— {q.giver}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function SharedCampaignPage() {
  const { token } = useParams<{ token: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [activeTurn, setActiveTurn] = useState<{ kind: 'character' | 'combatant'; id: number; round: number } | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [expandedFactionIdx, setExpandedFactionIdx] = useState<number | null>(null)
  const [factionSearch, setFactionSearch] = useState('')
  const [factionRepFilter, setFactionRepFilter] = useState<'all' | 'allied' | 'neutral' | 'enemy'>('all')
  const [activeQuestSearch, setActiveQuestSearch] = useState('')
  const [npcSearch, setNpcSearch] = useState('')
  const [locationSearchShared, setLocationSearchShared] = useState('')
  const [treasurySearch, setTreasurySearch] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getSharedCampaign(token)
      .then(c => {
        setCampaign(c)
        setCharacters(c.characters)
        setCombatants(c.combatants ?? [])
        setLastUpdate(new Date())
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token || (characters.length === 0 && combatants.length === 0) || !REALTIME_CONFIGURED) return
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
    <>
    <SharedSidebar campaignShareToken={token} />
    <div className="ml-14 min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-amber-400 font-display font-semibold tracking-widest shrink-0">🍺 Taverne</span>
            <span className="text-stone-700">|</span>
            <span className="text-white font-display font-semibold tracking-wide truncate">{campaign.name}</span>
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

        {/* Statistiques rapides */}
        {characters.length > 0 && (() => {
          const avgLevel = Math.round(characters.reduce((s, c) => s + c.level, 0) / characters.length)
          return (
            <div className="flex flex-wrap gap-3">
              <span className="text-xs bg-stone-900 border border-stone-800 rounded-full px-3 py-1 text-stone-400">
                ⚔ {characters.length} personnage{characters.length > 1 ? 's' : ''} · Niv. moyen {avgLevel}
              </span>
            </div>
          )
        })()}

        {/* Calendrier de campagne */}
        {(campaign.game_calendar?.date || campaign.game_calendar?.weather || campaign.game_calendar?.notes) && (
          <section>
            <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-3">Calendrier</h2>
            <div className="bg-stone-900 border border-stone-800 rounded-xl px-5 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {campaign.game_calendar.date && (
                <div className="flex items-center gap-2">
                  <span className="text-stone-500 text-xs">📅</span>
                  <span className="text-white text-sm font-medium">{campaign.game_calendar.date}</span>
                  {campaign.game_calendar.time && (
                    <span className="text-stone-400 text-xs capitalize">· {campaign.game_calendar.time}</span>
                  )}
                </div>
              )}
              {campaign.game_calendar.weather && (
                <div className="flex items-center gap-2">
                  <span className="text-stone-500 text-xs">🌤</span>
                  <span className="text-stone-300 text-sm">{campaign.game_calendar.weather}</span>
                </div>
              )}
              {campaign.game_calendar.notes && (
                <span className="text-stone-500 text-xs italic w-full">{campaign.game_calendar.notes}</span>
              )}
            </div>
          </section>
        )}

        {/* Quêtes actives */}
        {(campaign.quests ?? []).filter(q => q.status === 'active').length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest">Quêtes en cours</h2>
              {(campaign.quests ?? []).filter(q => q.status === 'active').length > 3 && (
                <input
                  type="text"
                  value={activeQuestSearch}
                  onChange={e => setActiveQuestSearch(e.target.value)}
                  placeholder="Chercher…"
                  className="w-32 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(campaign.quests ?? []).filter(q => q.status === 'active' && (!activeQuestSearch || q.title.toLowerCase().includes(activeQuestSearch.toLowerCase()) || (q.giver ?? '').toLowerCase().includes(activeQuestSearch.toLowerCase()))).map(q => (
                <div key={q.id} className="bg-stone-900 border border-amber-900/40 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 text-sm shrink-0 mt-0.5">🟡</span>
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm leading-tight">{q.title}</p>
                      {q.giver && <p className="text-stone-500 text-xs mt-0.5">— {q.giver}</p>}
                      {q.description && <MarkdownText className="text-stone-400 text-xs mt-1.5">{q.description}</MarkdownText>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Historique des quêtes */}
        {(campaign.quests ?? []).filter(q => q.status === 'completed' || q.status === 'failed').length > 0 && (
          <QuestHistory quests={(campaign.quests ?? []).filter(q => q.status === 'completed' || q.status === 'failed')} />
        )}


        {/* Ce que les joueurs savent du passé de la campagne viendra de leur wiki,
            écrit pour eux. Les chapitres du MJ ne sont pas publiables : ils portent
            ses secrets. */}

        {/* Carte de campagne */}
        {campaign.campaign_map?.image_url && (
          <section>
            <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-3">Carte</h2>
            <div className="relative bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
              <div className="relative" style={{ userSelect: 'none' }}>
                <img
                  src={campaign.campaign_map.image_url}
                  alt="Carte de campagne"
                  className="w-full h-auto block"
                  onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
                />
                {campaign.campaign_map.pins.map(pin => {
                  const colorClasses: Record<string, string> = {
                    amber: 'bg-amber-500 border-amber-400',
                    red: 'bg-red-500 border-red-400',
                    blue: 'bg-blue-500 border-blue-400',
                    green: 'bg-emerald-500 border-emerald-400',
                    purple: 'bg-purple-500 border-purple-400',
                    sky: 'bg-sky-500 border-sky-400',
                  }
                  const textClasses: Record<string, string> = {
                    amber: 'bg-amber-900/90 border-amber-600/60 text-amber-200',
                    red: 'bg-red-900/90 border-red-600/60 text-red-200',
                    blue: 'bg-blue-900/90 border-blue-600/60 text-blue-200',
                    green: 'bg-emerald-900/90 border-emerald-600/60 text-emerald-200',
                    purple: 'bg-purple-900/90 border-purple-600/60 text-purple-200',
                    sky: 'bg-sky-900/90 border-sky-600/60 text-sky-200',
                  }
                  return (
                    <div
                      key={pin.id}
                      className="absolute pointer-events-none"
                      style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}
                    >
                      <span className={`block text-xs font-semibold whitespace-nowrap border rounded px-1.5 py-0.5 mb-0.5 ${textClasses[pin.color] ?? textClasses.amber}`}>
                        {pin.label}
                      </span>
                      <div className={`w-0.5 h-3 mx-auto rounded-full ${colorClasses[pin.color] ?? colorClasses.amber}`} />
                      <div className={`w-2 h-2 rounded-full border mx-auto ${colorClasses[pin.color] ?? colorClasses.amber}`} />
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* PNJ connus (alliés / neutres) */}
        {(campaign.npcs ?? []).filter(n => n.status === 'allié' || n.status === 'neutre').length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest">PNJ connus</h2>
              {(campaign.npcs ?? []).filter(n => n.status === 'allié' || n.status === 'neutre').length > 4 && (
                <input
                  type="text"
                  value={npcSearch}
                  onChange={e => setNpcSearch(e.target.value)}
                  placeholder="Chercher…"
                  className="w-32 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(campaign.npcs ?? [])
                .filter(n => (n.status === 'allié' || n.status === 'neutre') && (!npcSearch || n.name.toLowerCase().includes(npcSearch.toLowerCase()) || (n.role ?? '').toLowerCase().includes(npcSearch.toLowerCase())))
                .map((npc, i) => (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-base shrink-0 mt-0.5">
                        {npc.status === 'allié' ? '🟢' : '🟡'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm leading-tight">{npc.name}</p>
                        {npc.role && <p className="text-stone-400 text-xs mt-0.5">{npc.role}</p>}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {npc.location && <p className="text-stone-500 text-xs">📍 {npc.location}</p>}
                          {npc.faction && <p className="text-stone-500 text-xs">⚔ {npc.faction}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Lieux connus / explorés */}
        {(campaign.locations ?? []).filter(l => l.status === 'connu' || l.status === 'exploré').length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest">Lieux</h2>
              {(campaign.locations ?? []).filter(l => l.status === 'connu' || l.status === 'exploré').length > 4 && (
                <input
                  type="text"
                  value={locationSearchShared}
                  onChange={e => setLocationSearchShared(e.target.value)}
                  placeholder="Chercher…"
                  className="w-32 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(campaign.locations ?? [])
                .filter(l => (l.status === 'connu' || l.status === 'exploré') && (!locationSearchShared || l.name.toLowerCase().includes(locationSearchShared.toLowerCase()) || (l.type ?? '').toLowerCase().includes(locationSearchShared.toLowerCase())))
                .map((loc, i) => (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm leading-tight capitalize">{loc.name}</p>
                        <p className="text-stone-500 text-xs mt-0.5 capitalize">{loc.type}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium rounded-full px-2 py-0.5 border ${
                        loc.status === 'exploré'
                          ? 'bg-emerald-900/50 border-emerald-700/50 text-emerald-400'
                          : 'bg-amber-900/50 border-amber-700/50 text-amber-400'
                      }`}>
                        {loc.status === 'exploré' ? 'Exploré' : 'Connu'}
                      </span>
                    </div>
                    {loc.notes && <MarkdownText className="text-stone-400 text-xs mt-2 line-clamp-3">{loc.notes}</MarkdownText>}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Trésor commun */}
        {(campaign.party_treasury ?? []).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest">Trésor du groupe</h2>
              {(campaign.party_treasury ?? []).length > 4 && (
                <input
                  type="text"
                  value={treasurySearch}
                  onChange={e => setTreasurySearch(e.target.value)}
                  placeholder="Chercher…"
                  className="w-32 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
              )}
            </div>
            <div className="bg-stone-900 border border-stone-800 rounded-xl divide-y divide-stone-800">
              {(campaign.party_treasury as TreasureItem[]).filter(item => !treasurySearch || item.name.toLowerCase().includes(treasurySearch.toLowerCase()) || (item.notes ?? '').toLowerCase().includes(treasurySearch.toLowerCase())).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-stone-200 text-sm font-medium truncate">{item.name}</p>
                    {item.notes && <p className="text-stone-500 text-xs mt-0.5 truncate">{item.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {item.value_gp != null && (
                      <span className="text-amber-400 text-xs font-medium">{formatGold(item.value_gp)}</span>
                    )}
                    {item.quantity > 1 && <span className="text-stone-400 text-xs">×{item.quantity}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Factions */}
        {(campaign.factions ?? []).length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-stone-500 text-xs font-semibold uppercase tracking-widest">Factions</h2>
              {(campaign.factions ?? []).length > 3 && (
                <input
                  type="text"
                  value={factionSearch}
                  onChange={e => setFactionSearch(e.target.value)}
                  placeholder="Chercher…"
                  className="w-32 bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
                />
              )}
            </div>
            {(campaign.factions ?? []).length > 2 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(['all', 'allied', 'neutral', 'enemy'] as const).map(f => {
                  const facs = campaign.factions ?? []
                  const count = f === 'all' ? facs.length : f === 'allied' ? facs.filter(fa => fa.reputation >= 2).length : f === 'neutral' ? facs.filter(fa => fa.reputation >= -1 && fa.reputation < 2).length : facs.filter(fa => fa.reputation < -1).length
                  if (f !== 'all' && count === 0) return null
                  const label = f === 'all' ? `Toutes (${count})` : f === 'allied' ? `🟢 Alliées (${count})` : f === 'neutral' ? `🟡 Neutres (${count})` : `🔴 Ennemies (${count})`
                  return (
                    <button key={f} onClick={() => setFactionRepFilter(f)} className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${factionRepFilter === f ? 'bg-amber-900/60 border-amber-600/60 text-amber-300' : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'}`}>
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="space-y-2">
              {(campaign.factions ?? []).filter(faction =>
                (factionRepFilter === 'all' || (factionRepFilter === 'allied' && faction.reputation >= 2) || (factionRepFilter === 'neutral' && faction.reputation >= -1 && faction.reputation < 2) || (factionRepFilter === 'enemy' && faction.reputation < -1)) &&
                (!factionSearch || faction.name.toLowerCase().includes(factionSearch.toLowerCase()) || (faction.description ?? '').toLowerCase().includes(factionSearch.toLowerCase()))
              ).map((faction, i) => {
                const rep = faction.reputation
                const repLabel = rep >= 4 ? 'Vénéré' : rep >= 2 ? 'Allié' : rep >= 0 ? 'Neutre' : rep >= -2 ? 'Suspect' : 'Ennemi'
                const repColor = rep >= 2 ? 'text-emerald-400' : rep >= 0 ? 'text-stone-400' : rep >= -2 ? 'text-amber-400' : 'text-red-400'
                const repDotColor = rep >= 2 ? 'bg-emerald-500' : rep >= 0 ? 'bg-stone-500' : rep >= -2 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <div key={i} className="bg-stone-900 border border-stone-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${repDotColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{faction.name}</p>
                        {faction.description && <p className="text-stone-500 text-xs truncate">{faction.description}</p>}
                      </div>
                      <span className={`text-xs font-medium shrink-0 ${repColor}`}>{repLabel}</span>
                    </div>
                    <div className="mt-2 h-1 bg-stone-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${repDotColor}`} style={{ width: `${((rep + 5) / 10) * 100}%` }} />
                    </div>
                    {faction.notes && (
                      <>
                        <button
                          onClick={() => setExpandedFactionIdx(expandedFactionIdx === i ? null : i)}
                          className="text-stone-600 hover:text-stone-400 text-xs mt-2 transition-colors"
                        >
                          {expandedFactionIdx === i ? '▲ Masquer' : '▼ Notes'}
                        </button>
                        {expandedFactionIdx === i && (
                          <div className="mt-2 pt-2 border-t border-stone-800">
                            <MarkdownText className="text-stone-400 text-xs">{faction.notes}</MarkdownText>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
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
      <FloatingDiceRoller />
      <RulesCompendium />
    </div>
    </>
  )
}
