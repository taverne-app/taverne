import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedCampaign } from '../api/share'
import type { Campaign, BattleMap } from '../api/campaigns'
import type { Combatant } from '../api/combatants'
import type { Character } from '../api/characters'
import { createPublicEcho, REALTIME_CONFIGURED } from '../lib/echo'
import { SharedSidebar } from '../components/SharedSidebar'
import { BattleMapBoard } from '../components/BattleMapBoard'
import { PlayerCombatDock } from '../components/PlayerCombatDock'

const CONDITIONS_FR: Record<string, string> = {
  blinded: 'Aveuglé', charmed: 'Charmé', deafened: 'Assourdi',
  exhaustion: 'Épuisé', frightened: 'Effrayé', grappled: 'Agrippé',
  incapacitated: 'Hors combat', invisible: 'Invisible', paralyzed: 'Paralysé',
  petrified: 'Pétrifié', poisoned: 'Empoisonné', prone: 'À terre',
  restrained: 'Entravé', stunned: 'Étourdi', unconscious: 'Inconscient',
}

function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}

type LiveState = { active_kind: string | null; active_id: number | null; round: number }

export function LiveCombatPage() {
  const { token } = useParams<{ token: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [battleMap, setBattleMap] = useState<BattleMap | null>(null)
  const [liveState, setLiveState] = useState<LiveState>({ active_kind: null, active_id: null, round: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!token) return
    getSharedCampaign(token)
      .then(c => {
        setCampaign(c)
        setCharacters(c.characters ?? [])
        setCombatants((c as Campaign & { combatants?: Combatant[] }).combatants ?? [])
        setBattleMap(c.battle_map ?? null)
        // Le tour en cours vient de la campagne : l'écho ne renseigne que les pages
        // déjà ouvertes au moment où le MJ change de tour.
        setLiveState({
          active_kind: c.combat_active_kind ?? null,
          active_id: c.combat_active_id ?? null,
          round: c.combat_round ?? 1,
        })
      })
      .catch(() => setError('Campagne introuvable ou lien révoqué.'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token || !REALTIME_CONFIGURED) return
    const echo = createPublicEcho()

    // L'indicateur « En direct » suit l'état réel de la connexion WebSocket,
    // pas la réception d'un premier événement.
    const connection = (echo.connector as { pusher?: { connection?: { bind: (e: string, cb: () => void) => void; state?: string } } }).pusher?.connection
    if (connection) {
      connection.bind('connected', () => setConnected(true))
      connection.bind('connecting', () => setConnected(false))
      connection.bind('unavailable', () => setConnected(false))
      connection.bind('failed', () => setConnected(false))
      connection.bind('disconnected', () => setConnected(false))
      if (connection.state === 'connected') setConnected(true)
    }

    echo.channel(`campaign-share.${token}`)
      .listen('.combat.turn-updated', (e: LiveState) => {
        setLiveState(e)
      })
      .listen('.combatant.updated', (e: { combatant: Combatant }) => {
        // Upsert : met à jour un combattant existant, ou l'ajoute s'il vient
        // d'être créé pendant que la page est ouverte (ajout à chaud).
        setCombatants(prev => prev.some(c => c.id === e.combatant.id)
          ? prev.map(c => c.id === e.combatant.id ? e.combatant : c)
          : [...prev, e.combatant])
      })
      .listen('.combatant.removed', (e: { id: number }) => {
        setCombatants(prev => prev.filter(c => c.id !== e.id))
      })
      .listen('.character.updated', (e: { character: Character }) => {
        setCharacters(prev => prev.some(c => c.id === e.character.id)
          ? prev.map(c => c.id === e.character.id ? e.character : c)
          : [...prev, e.character])
      })
      .listen('.campaign.battle-map-updated', (e: { battle_map: BattleMap | null; combat_location?: string | null }) => {
        setBattleMap(e.battle_map)
        setCampaign(prev => prev ? { ...prev, combat_location: e.combat_location ?? null } : prev)
      })
    return () => { echo.leave(`campaign-share.${token}`); echo.disconnect() }
  }, [token])

  const rows = useMemo(() => {
    const charRows = characters
      .filter(c => c.combat.initiative_roll !== null)
      .map(c => ({
        key: `character-${c.id}`,
        kind: 'character' as const,
        id: c.id,
        name: c.name,
        subtitle: `${c.race} · ${c.character_class} Niv.${c.level}`,
        portrait: c.portrait_url,
        hp: c.combat.current_hp,
        maxHp: c.combat.max_hp,
        ac: c.combat.armor_class as number | null,
        init: c.combat.initiative_roll as number,
        conditions: c.state.conditions,
        isDying: c.combat.current_hp <= 0,
        isEnemy: false,
      }))
    const cbRows = combatants
      .filter(c => c.initiative_roll !== null)
      .map(c => ({
        key: `combatant-${c.id}`,
        kind: 'combatant' as const,
        id: c.id,
        name: c.name,
        subtitle: c.faction === 'allié' ? 'Allié' : c.faction === 'neutre' ? 'Neutre' : 'Ennemi',
        portrait: null,
        hp: c.current_hp,
        maxHp: c.max_hp,
        ac: c.armor_class,
        init: c.initiative_roll as number,
        conditions: c.conditions,
        isDying: c.current_hp <= 0,
        isEnemy: c.faction === 'ennemi',
      }))
    return [...charRows, ...cbRows].sort((a, b) => b.init - a.init)
  }, [characters, combatants])

  const isActive = (kind: string, id: number) =>
    liveState.active_kind === kind && liveState.active_id === id

  // Même bascule que la console MJ : avec une image de plateau, la carte EST la page
  // (plein écran, ruban en bas). Sans image, rien à afficher en grand — on garde la
  // liste qui défile, seule vue lisible des combattants.
  const hasBattleImage = !!battleMap?.image_url

  if (loading) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <p className="text-stone-400 text-sm">Chargement…</p>
    </div>
  )
  if (error) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <p className="text-red-400 text-sm">{error}</p>
    </div>
  )
  if (!campaign) return null

  return (
    <>
    <SharedSidebar campaignShareToken={token} />
    {/* En plein écran, la hauteur est bornée au viewport et c'est le plateau qui prend
        la place restante : `min-h-screen` laisserait la page défiler sous le ruban. */}
    <div className={`ml-14 bg-stone-950 text-white ${hasBattleImage ? 'h-[100dvh] flex flex-col overflow-hidden' : 'min-h-screen'}`}>
      <header className={`shrink-0 border-b border-stone-800 bg-stone-950/90 backdrop-blur-sm px-4 py-3 ${hasBattleImage ? '' : 'sticky top-0 z-10'}`}>
        <div className={`${hasBattleImage ? '' : 'max-w-lg'} mx-auto flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-amber-400 font-bold shrink-0">⚔</span>
            <h1 className="font-semibold text-white truncate">{campaign.name}</h1>
            {campaign.combat_location && (
              <span className="shrink-0 text-xs bg-stone-800 border border-stone-700 text-amber-300/90 rounded-full px-2.5 py-0.5" title="Lieu du combat">
                📍 {campaign.combat_location}
              </span>
            )}
            {liveState.active_kind && (
              <span className="shrink-0 text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded-full px-2.5 py-0.5">
                Round {liveState.round}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {REALTIME_CONFIGURED && (
              <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-stone-600'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-stone-600'}`} />
                {connected ? 'En direct' : 'Attente…'}
              </div>
            )}
            <span className="text-stone-600 text-xs hidden sm:block">Vue joueurs</span>
          </div>
        </div>
      </header>

      {/* Plateau plein écran. `pb-44` réserve la place de la barre du bas (ruban + dock),
          qui est `fixed` et recouvrirait sinon le bas de la carte. */}
      {hasBattleImage && (
        <div className="flex-1 min-h-0 px-3 sm:px-4 pt-3 pb-44">
          <BattleMapBoard
            map={battleMap}
            combatants={combatants}
            characters={characters}
            fullscreen
            cameraKey={token ? `share:${token}` : undefined}
            activeRef={liveState.active_kind && liveState.active_id ? { kind: liveState.active_kind as 'combatant' | 'character', id: liveState.active_id } : null}
          />
        </div>
      )}

      {/* Vue sans plateau : la liste verticale reste la seule façon de voir le combat.
          Avec un plateau, c'est le ruban du bas qui joue ce rôle — pas les deux. */}
      {!hasBattleImage && (
      <main className="max-w-lg mx-auto px-4 py-6 pb-52 space-y-6">
        {battleMap && battleMap.tokens.length > 0 && (
          <BattleMapBoard
            map={battleMap}
            combatants={combatants}
            characters={characters}
            activeRef={liveState.active_kind && liveState.active_id ? { kind: liveState.active_kind as 'combatant' | 'character', id: liveState.active_id } : null}
          />
        )}

        {rows.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-700 text-5xl mb-4">⚔</p>
            <p className="text-stone-400 text-base font-medium">Combat pas encore commencé</p>
            <p className="text-stone-600 text-sm mt-1">Les participants apparaîtront ici une fois les initiatives lancées.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, idx) => {
              const active = isActive(row.kind, row.id)
              const hpPct = row.maxHp > 0 ? Math.max(0, Math.min(100, (row.hp / row.maxHp) * 100)) : 0
              return (
                <div
                  key={row.key}
                  className={`rounded-xl border transition-all duration-300 ${
                    active
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-900/10'
                      : 'bg-stone-900 border-stone-800'
                  }`}
                >
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-5 text-center shrink-0 ${active ? 'text-amber-400' : 'text-stone-600'}`}>
                        {idx + 1}
                      </span>

                      {row.portrait ? (
                        <img
                          src={row.portrait}
                          alt={row.name}
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-stone-700"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold border ${
                          active
                            ? 'bg-amber-900/40 border-amber-600/50 text-amber-300'
                            : row.isEnemy
                              ? 'bg-red-900/30 border-red-800/50 text-red-500'
                              : 'bg-stone-800 border-stone-700 text-stone-400'
                        }`}>
                          {row.name[0]?.toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {active && <span className="text-amber-400 text-xs shrink-0">▶</span>}
                          <span className={`font-semibold truncate ${
                            active ? 'text-amber-200' : row.isDying ? 'text-red-400' : 'text-white'
                          }`}>{row.name}</span>
                          {row.isDying && !row.isEnemy && (
                            <span className="shrink-0 text-xs bg-red-900/30 border border-red-800/50 text-red-400 rounded px-1.5 py-0.5">À terre</span>
                          )}
                        </div>
                        <p className="text-stone-500 text-xs truncate">{row.subtitle}</p>
                      </div>

                      <div className="shrink-0 text-right">
                        {row.isEnemy ? (
                          <span className="text-stone-700 text-sm font-mono">? PV</span>
                        ) : (
                          <>
                            <span className={`text-sm font-bold ${row.isDying ? 'text-red-400' : 'text-white'}`}>{row.hp}</span>
                            <span className="text-stone-500 text-xs ml-0.5">/{row.maxHp}</span>
                          </>
                        )}
                        {row.ac !== null && (
                          <p className="text-stone-500 text-xs">CA {row.ac}</p>
                        )}
                      </div>
                    </div>

                    {!row.isEnemy && (
                      <div className="mt-2 ml-[68px] h-1.5 bg-stone-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${hpColor(row.hp, row.maxHp)}`}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                    )}

                    {row.conditions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 ml-[68px]">
                        {row.conditions.map(c => (
                          <span key={c} className="text-xs bg-purple-900/60 border border-purple-700/50 text-purple-300 rounded px-1.5 py-0.5">
                            {CONDITIONS_FR[c] ?? c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
      )}

      {/* ─────────── Barre du bas : ruban d'initiative puis dock du joueur ───────────
          Une SEULE barre `fixed` pour les deux : empilés dans des conteneurs séparés,
          le second passerait sous le premier. `left-14` = largeur de la barre latérale,
          qu'un `left-0` ferait recouvrir. */}
      <div className="fixed bottom-0 left-14 right-0 z-30 border-t border-amber-700/40 bg-stone-900/95 backdrop-blur shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
        {rows.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="shrink-0 text-stone-600 text-[10px] uppercase tracking-widest pr-1">Ordre</span>
            <div className="flex-1 min-w-0 overflow-x-auto flex gap-1.5">
              {rows.map(row => {
                const active = isActive(row.kind, row.id)
                const pct = row.maxHp > 0 ? Math.max(0, Math.min(100, (row.hp / row.maxHp) * 100)) : 0
                return (
                  <div
                    key={row.key}
                    className={`w-24 shrink-0 rounded-lg border px-2 py-1 transition-colors ${
                      active ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/40' : 'bg-stone-800/70 border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${
                        row.isEnemy ? 'bg-red-900/50 border-red-700/50 text-red-300'
                          : row.kind === 'character' ? 'bg-sky-900/50 border-sky-700/50 text-sky-300'
                          : 'bg-stone-700 border-stone-600 text-stone-300'
                      }`}>{row.init}</span>
                      <span className={`text-xs font-medium truncate ${active ? 'text-amber-200' : 'text-stone-200'}`}>{row.name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 h-3">
                      {/* Vue joueurs : les PV des ennemis restent cachés, comme dans la
                          liste verticale. Ne jamais afficher `row.hp` pour un ennemi. */}
                      {row.isEnemy ? (
                        <span className="text-[9px] text-stone-600">PV ?</span>
                      ) : (
                        <>
                          <div className="flex-1 h-1 bg-stone-700 rounded-full overflow-hidden">
                            <div className={`h-full ${hpColor(row.hp, row.maxHp)}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-[9px] tabular-nums ${row.isDying ? 'text-red-400' : 'text-stone-500'}`}>{row.hp}</span>
                        </>
                      )}
                    </div>
                    {row.conditions.length > 0 && (
                      <p className="mt-0.5 text-[9px] text-purple-400/80 truncate">
                        {row.conditions.map(c => CONDITIONS_FR[c] ?? c).join(', ')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {liveState.active_kind && (
              <span className="shrink-0 text-stone-500 text-xs tabular-nums">R{liveState.round}</span>
            )}
          </div>
        )}

        {token && (
          <PlayerCombatDock
            campaignToken={token}
            activeKind={liveState.active_kind}
            activeId={liveState.active_id}
            // Les PV encaissés ici doivent se voir dans le ruban sans attendre l'écho,
            // qui peut ne pas être configuré (auto-hébergement sans Reverb).
            onCharacterChange={updated => setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c))}
          />
        )}
      </div>
    </div>
    </>
  )
}
