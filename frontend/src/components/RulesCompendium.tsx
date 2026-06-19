import { useEffect, useRef, useState } from 'react'
import { RULES, RULE_CATEGORIES } from '../data/rules'

export function RulesCompendium() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOutside)
    }
  }, [open])

  const filtered = RULES.filter(r => {
    if (category !== 'all' && r.category !== category) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.name.toLowerCase().includes(q) || r.body.toLowerCase().includes(q)
  })

  return (
    <div className="fixed bottom-24 right-4 z-40" ref={panelRef}>
      {open && (
        <div className="mb-2 w-80 sm:w-96 bg-stone-900 border border-stone-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
          {/* Header */}
          <div className="px-4 py-3 border-b border-stone-800 flex items-center justify-between shrink-0">
            <h2 className="text-stone-200 font-semibold text-sm">Référence de règles</h2>
            <button onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-300 text-lg leading-none transition-colors">×</button>
          </div>

          {/* Search + category */}
          <div className="px-4 py-2 border-b border-stone-800 space-y-2 shrink-0">
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
            />
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setCategory('all')}
                className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${
                  category === 'all'
                    ? 'bg-sky-700/50 border-sky-600 text-sky-200'
                    : 'border-stone-700 text-stone-500 hover:text-stone-300'
                }`}
              >
                Tout
              </button>
              {RULE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${
                    category === cat.id
                      ? 'bg-sky-700/50 border-sky-600 text-sky-200'
                      : 'border-stone-700 text-stone-500 hover:text-stone-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="overflow-y-auto flex-1 divide-y divide-stone-800/60">
            {filtered.length === 0 ? (
              <p className="text-stone-600 text-sm text-center py-8">Aucun résultat.</p>
            ) : filtered.map(rule => (
              <div key={rule.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-stone-100 text-sm font-semibold">{rule.name}</p>
                  <span className={`shrink-0 text-xs rounded px-1.5 py-0.5 border ${
                    rule.category === 'action'     ? 'bg-amber-900/40 border-amber-700/50 text-amber-400' :
                    rule.category === 'condition'  ? 'bg-purple-900/40 border-purple-700/50 text-purple-300' :
                    rule.category === 'exhaustion' ? 'bg-red-900/40 border-red-700/50 text-red-300' :
                                                     'bg-sky-900/40 border-sky-700/50 text-sky-300'
                  }`}>
                    {RULE_CATEGORIES.find(c => c.id === rule.category)?.label ?? rule.category}
                  </span>
                </div>
                <p className="text-stone-400 text-xs leading-relaxed whitespace-pre-line">{rule.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl transition-all ${
          open
            ? 'bg-sky-600 text-white shadow-sky-900/50'
            : 'bg-stone-800 border border-stone-700 text-stone-400 hover:bg-stone-700 hover:text-sky-400'
        }`}
        title="Référence de règles"
      >
        📖
      </button>
    </div>
  )
}
