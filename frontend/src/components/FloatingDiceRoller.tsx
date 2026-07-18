import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { createEcho, createPublicEcho, REALTIME_CONFIGURED } from '../lib/echo'
import { getCampaignRolls } from '../api/campaigns'
import { getSharedCampaignRolls } from '../api/share'
import type { DiceRoll } from '../api/characters'

const DICE = [4, 6, 8, 10, 12, 20, 100] as const

interface RollResult {
  expr: string
  rolls: number[]
  modifier: number
  advantage: boolean
  disadvantage: boolean
  total: number
  sides: number
}

/**
 * Contexte campagne du lanceur : d'où viennent les jets de TOUTE la table.
 * `dm` passe par le canal privé authentifié, `share` par le canal public du lien.
 * Absent → le lanceur reste local (aucun historique commun).
 */
export type RollerCampaign =
  | { kind: 'dm'; id: number }
  | { kind: 'share'; token: string }

function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

export function FloatingDiceRoller({ campaign }: { campaign?: RollerCampaign }) {
  const [open, setOpen]       = useState(false)
  const [sides, setSides]     = useState<typeof DICE[number]>(20)
  const [count, setCount]     = useState(1)
  const [modInput, setModInput] = useState('')
  const [adv, setAdv]         = useState<'none' | 'adv' | 'dis'>('none')
  const [history, setHistory] = useState<RollResult[]>([])
  const [tableRolls, setTableRolls] = useState<DiceRoll[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const { token: authToken } = useAuth()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Historique de la table : on charge les 10 derniers à l'ouverture puis on suit en
  // direct. Le canal ne s'abonne que panneau ouvert, pour ne pas tenir un WebSocket
  // ouvert en permanence sur toutes les pages où flotte le bouton.
  useEffect(() => {
    if (!open || !campaign) return
    let cancelled = false

    const fetchInitial = campaign.kind === 'dm'
      ? getCampaignRolls(campaign.id)
      : getSharedCampaignRolls(campaign.token)
    fetchInitial.then(rolls => { if (!cancelled) setTableRolls(rolls) }).catch(() => { /* historique indisponible */ })

    if (!REALTIME_CONFIGURED) return () => { cancelled = true }
    // Le canal MJ est privé (authentifié) ; le canal joueurs est public.
    if (campaign.kind === 'dm' && !authToken) return () => { cancelled = true }
    const echo = campaign.kind === 'dm' ? createEcho(authToken!) : createPublicEcho()
    const channelName = campaign.kind === 'dm' ? `campaign.${campaign.id}` : `campaign-share.${campaign.token}`
    const channel = campaign.kind === 'dm' ? echo.private(channelName) : echo.channel(channelName)
    channel.listen('.dice.rolled', (e: DiceRoll) => {
      setTableRolls(prev => {
        // Un même jet ne peut arriver deux fois (timestamp + personnage identiques).
        if (prev.some(r => r.timestamp === e.timestamp && r.character_id === e.character_id)) return prev
        return [e, ...prev].slice(0, 10)
      })
    })

    return () => {
      cancelled = true
      echo.leave(channelName)
      echo.disconnect()
    }
  }, [open, campaign, authToken])

  function roll() {
    const mod = parseInt(modInput, 10) || 0
    const d = () => Math.floor(Math.random() * sides) + 1

    let rolls: number[]
    let total: number

    if (adv !== 'none') {
      rolls = [d(), d()]
      total = (adv === 'adv' ? Math.max(...rolls) : Math.min(...rolls)) + mod
    } else {
      rolls = Array.from({ length: count }, d)
      total = rolls.reduce((s, r) => s + r, 0) + mod
    }

    const expr = adv !== 'none'
      ? `2d${sides}${mod ? sign(mod) : ''} (${adv === 'adv' ? 'avantage' : 'désavantage'})`
      : `${count}d${sides}${mod ? sign(mod) : ''}`

    const result: RollResult = { expr, rolls, modifier: mod, advantage: adv === 'adv', disadvantage: adv === 'dis', total, sides }
    setHistory(h => [result, ...h].slice(0, 10))
  }

  const last = history[0] ?? null
  const isCrit = last && last.sides === 20 && last.rolls.some(r => r === 20) && adv !== 'dis'
  const isFumble = last && last.sides === 20 && last.rolls.every(r => r === 1)
  const mod = parseInt(modInput, 10) || 0
  const rollLabel = adv !== 'none' ? `2d${sides}${mod ? sign(mod) : ''}` : `${count}d${sides}${mod ? sign(mod) : ''}`

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50">
      {/* Panel */}
      {open && (
        <div className="absolute bottom-14 right-0 w-72 bg-stone-900 border border-stone-700 rounded-xl shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Lanceur de dés</h3>
            <button onClick={() => setOpen(false)} className="text-stone-600 hover:text-stone-400 text-lg leading-none">×</button>
          </div>

          {/* Dice grid */}
          <div className="grid grid-cols-7 gap-1">
            {DICE.map(d => (
              <button
                key={d}
                onClick={() => setSides(d)}
                className={`py-1.5 rounded text-xs font-bold transition-colors ${
                  sides === d
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-white'
                }`}
              >
                d{d}
              </button>
            ))}
          </div>

          {/* Count + Modifier row */}
          <div className="flex items-center gap-2">
            {adv === 'none' && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setCount(c => Math.max(1, c - 1))}
                  className="w-6 h-6 rounded bg-stone-800 text-stone-400 text-sm hover:bg-stone-700 transition-colors"
                >
                  −
                </button>
                <span className="text-white text-sm w-5 text-center font-semibold">{count}</span>
                <button
                  onClick={() => setCount(c => Math.min(20, c + 1))}
                  className="w-6 h-6 rounded bg-stone-800 text-stone-400 text-sm hover:bg-stone-700 transition-colors"
                >
                  +
                </button>
                <span className="text-stone-500 text-xs">dés</span>
              </div>
            )}
            {/* min-w-0 : sans lui, la largeur intrinsèque d'un input[number] l'empêche de
                rétrécir dans le flex et il déborde du panneau. */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="text-stone-500 text-xs shrink-0">mod</span>
              <input
                type="number"
                value={modInput}
                onChange={e => setModInput(e.target.value)}
                placeholder="0"
                className="w-full min-w-0 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {/* Adv / Dis */}
          <div className="flex gap-1">
            {(['none', 'adv', 'dis'] as const).map(a => (
              <button
                key={a}
                onClick={() => setAdv(a)}
                className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                  adv === a
                    ? a === 'adv'  ? 'bg-emerald-700 text-white'
                    : a === 'dis' ? 'bg-red-800 text-white'
                    : 'bg-stone-700 text-white'
                    : 'bg-stone-800 text-stone-500 hover:bg-stone-700 hover:text-stone-300'
                }`}
              >
                {a === 'none' ? 'Normal' : a === 'adv' ? 'Avantage' : 'Désavantage'}
              </button>
            ))}
          </div>

          {/* Roll button */}
          <button
            onClick={roll}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg py-2.5 text-sm transition-colors"
          >
            Lancer {rollLabel}
          </button>

          {/* Latest result */}
          {last && (
            <div className="bg-stone-800/60 rounded-lg px-3 py-2 text-center">
              <p className={`font-black text-3xl ${isFumble ? 'text-red-400' : isCrit ? 'text-amber-400' : 'text-white'}`}>
                {last.total}
              </p>
              <p className="text-stone-500 text-xs mt-0.5">
                [{last.rolls.join(' + ')}]{last.modifier ? ` ${sign(last.modifier)}` : ''}
                {isCrit && ' — Critique !'}
                {isFumble && ' — Fumble'}
              </p>
            </div>
          )}

          {/* Historique de la table : jets de tous les personnages, avec leur provenance. */}
          {campaign ? (
            <div className="border-t border-stone-800 pt-2">
              <p className="text-stone-600 text-[10px] uppercase tracking-widest mb-1">Derniers jets de la table</p>
              {tableRolls.length === 0 ? (
                <p className="text-stone-600 text-xs italic">Aucun jet pour l'instant.</p>
              ) : (
                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {tableRolls.map((r, i) => (
                    <div key={`${r.timestamp}-${r.character_id}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-stone-400 truncate">
                        <span className="text-stone-300">{r.label}</span>
                        <span className="text-stone-600"> — {r.character_name}</span>
                      </span>
                      <span className={`font-bold shrink-0 ${
                        r.advantage ? 'text-emerald-400' : r.disadvantage ? 'text-red-400' : 'text-stone-200'
                      }`}>{r.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Hors campagne : simple rappel de mes derniers lancers locaux. */
            history.length > 1 && (
              <div className="space-y-0.5 border-t border-stone-800 pt-2">
                {history.slice(1, 6).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-stone-600">{r.expr}</span>
                    <span className="text-stone-500 font-semibold">{r.total}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Lanceur de dés (toutes pages)"
        className={`w-12 h-12 rounded-full border shadow-lg text-xl transition-all ${
          open
            ? 'bg-amber-600 border-amber-500 text-white scale-105'
            : 'bg-stone-800 border-stone-600 text-stone-300 hover:bg-stone-700 hover:text-white hover:scale-105'
        }`}
      >
        ⚅
      </button>
    </div>
  )
}
