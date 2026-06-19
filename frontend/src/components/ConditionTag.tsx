import { useState, useRef, useEffect } from 'react'
import { CONDITIONS_FR, CONDITIONS_RULES } from '../data/conditions'

interface Props {
  condition: string
  active?: boolean
  duration?: number
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export function ConditionTag({ condition, active = false, duration, onClick, disabled, className }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const label = CONDITIONS_FR[condition] ?? condition
  const rules = CONDITIONS_RULES[condition]

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  return (
    <div ref={ref} className="relative inline-flex items-center gap-0.5">
      <button
        onClick={onClick}
        disabled={disabled}
        className={className ?? `rounded px-2 py-1 text-xs font-medium border transition-colors ${
          active
            ? 'bg-purple-600 border-purple-500 text-white'
            : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'
        }`}
      >
        {label}
        {active && duration != null && duration > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-purple-400 text-purple-950 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {duration}
          </span>
        )}
      </button>
      {rules && (
        <button
          onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          tabIndex={-1}
          className={`text-[10px] leading-none transition-colors shrink-0 ${
            open ? 'text-violet-300' : 'text-stone-600 hover:text-stone-400'
          }`}
          title="Voir la règle"
        >
          ⓘ
        </button>
      )}
      {open && rules && (
        <div className="absolute bottom-full left-0 mb-1.5 z-50 w-64 bg-stone-800 border border-stone-600 rounded-xl shadow-2xl p-3">
          <p className="text-violet-300 text-xs font-semibold mb-2">{label}</p>
          <ul className="space-y-1">
            {rules.map((line, i) => (
              <li key={i} className="text-stone-300 text-xs flex gap-1.5">
                <span className="text-stone-600 shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
