import { useEffect, useRef, useState } from 'react'

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

function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

export function FloatingDiceRoller() {
  const [open, setOpen]       = useState(false)
  const [sides, setSides]     = useState<typeof DICE[number]>(20)
  const [count, setCount]     = useState(1)
  const [modInput, setModInput] = useState('')
  const [adv, setAdv]         = useState<'none' | 'adv' | 'dis'>('none')
  const [history, setHistory] = useState<RollResult[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

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
              <div className="flex items-center gap-1">
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
            <div className="flex-1 flex items-center gap-1.5">
              <span className="text-stone-500 text-xs">mod</span>
              <input
                type="number"
                value={modInput}
                onChange={e => setModInput(e.target.value)}
                placeholder="0"
                className="flex-1 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

          {/* History */}
          {history.length > 1 && (
            <div className="space-y-0.5 border-t border-stone-800 pt-2">
              {history.slice(1, 6).map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-stone-600">{r.expr}</span>
                  <span className="text-stone-500 font-semibold">{r.total}</span>
                </div>
              ))}
            </div>
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
