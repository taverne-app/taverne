import { useState, useMemo } from 'react'
import { SRD_SPELLS, SPELL_META, SCHOOL_LABELS, SCHOOL_COLORS, type SpellSchool } from '../data/spells'

interface Props {
  onClose: () => void
}

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const SCHOOLS = Object.keys(SCHOOL_LABELS) as SpellSchool[]

export function SpellCompendiumModal({ onClose }: Props) {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState<number | 'all'>('all')
  const [schoolFilter, setSchoolFilter] = useState<SpellSchool | 'all'>('all')
  const [concFilter, setConcFilter] = useState<boolean | 'all'>('all')

  const results = useMemo(() => {
    const q = search.toLowerCase()
    return SRD_SPELLS.filter(([name, level]) => {
      if (levelFilter !== 'all' && level !== levelFilter) return false
      if (q && !name.toLowerCase().includes(q)) return false
      const meta = SPELL_META[name]
      if (!meta) return schoolFilter === 'all' && concFilter === 'all'
      if (schoolFilter !== 'all' && meta.school !== schoolFilter) return false
      if (concFilter !== 'all' && meta.concentration !== concFilter) return false
      return true
    })
  }, [search, levelFilter, schoolFilter, concFilter])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-700">
          <h2 className="text-amber-300 font-semibold text-base">📚 Compendium de sorts</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-lg leading-none">✕</button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-stone-800 space-y-2">
          <input
            type="text"
            placeholder="Rechercher un sort…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-600"
          />
          <div className="flex flex-wrap gap-2">
            {/* Level filter */}
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-xs text-stone-300 focus:outline-none"
            >
              <option value="all">Tous niveaux</option>
              {LEVELS.map(l => (
                <option key={l} value={l}>{l === 0 ? 'Tour de magie' : `Niveau ${l}`}</option>
              ))}
            </select>
            {/* School filter */}
            <select
              value={schoolFilter}
              onChange={e => setSchoolFilter(e.target.value as SpellSchool | 'all')}
              className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-xs text-stone-300 focus:outline-none"
            >
              <option value="all">Toutes écoles</option>
              {SCHOOLS.map(s => (
                <option key={s} value={s}>{SCHOOL_LABELS[s]}</option>
              ))}
            </select>
            {/* Concentration filter */}
            <select
              value={concFilter === 'all' ? 'all' : concFilter ? 'yes' : 'no'}
              onChange={e => setConcFilter(e.target.value === 'all' ? 'all' : e.target.value === 'yes')}
              className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-xs text-stone-300 focus:outline-none"
            >
              <option value="all">Concentration : tous</option>
              <option value="yes">Concentration requise</option>
              <option value="no">Sans concentration</option>
            </select>
            <span className="text-stone-500 text-xs self-center ml-auto">{results.length} sort{results.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 divide-y divide-stone-800">
          {results.length === 0 ? (
            <p className="text-center text-stone-500 text-sm py-10">Aucun sort trouvé.</p>
          ) : (
            results.map(([name, level]) => {
              const meta = SPELL_META[name]
              return (
                <div key={name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-800/50">
                  <span className="text-stone-200 text-sm flex-1">{name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {meta && (
                      <span className={`text-xs font-medium ${SCHOOL_COLORS[meta.school]}`}>
                        {SCHOOL_LABELS[meta.school]}
                      </span>
                    )}
                    {meta?.concentration && (
                      <span className="text-xs text-yellow-500" title="Concentration">C</span>
                    )}
                    <span className="text-xs text-stone-500 w-16 text-right">
                      {level === 0 ? 'Tour de magie' : `Niv. ${level}`}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
