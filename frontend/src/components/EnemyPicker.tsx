import { useMemo, useState } from 'react'
import type { EncounterEntry, SavedEncounter, CustomMonster } from '../api/campaigns'
import { MONSTERS } from '../data/monsters'
import { computeEncounterDifficulty, difficultyColor } from '../data/encounter_difficulty'

interface Props {
  value: EncounterEntry[]
  onChange: (next: EncounterEntry[]) => void
  /** Bestiaire propre à la campagne — il s'ajoute au SRD et le remplace en cas d'homonyme. */
  customMonsters: CustomMonster[]
  /** Rencontres déjà sauvegardées, proposées comme raccourci de remplissage. */
  savedEncounters: SavedEncounter[]
  /** Niveaux des personnages, pour situer la difficulté. Vide = pas d'estimation. */
  partyLevels: number[]
}

/**
 * Choix des créatures d'une scène de combat, dans le bestiaire de la campagne.
 *
 * Remplace la saisie libre du nom d'une rencontre : ce qui est choisi ici monte
 * réellement le combat, alors qu'un nom tapé à la main ne correspondait à une
 * rencontre sauvegardée que par chance. Les créatures personnalisées passent avant
 * celles du SRD — un MJ qui a retouché un gobelin veut le sien.
 */
export function EnemyPicker({ value, onChange, customMonsters, savedEncounters, partyLevels }: Props) {
  const [search, setSearch] = useState('')

  const bestiary = useMemo(() => {
    const custom = customMonsters.map(m => ({ name: m.name, cr: m.cr, custom: true }))
    const customNames = new Set(custom.map(m => m.name.toLowerCase()))
    const srd = MONSTERS
      .filter(m => !customNames.has(m.name.toLowerCase()))
      .map(m => ({ name: m.name, cr: m.cr, custom: false }))
    return [...custom, ...srd]
  }, [customMonsters])

  const chosen = new Set(value.map(e => e.monster_name.toLowerCase()))
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    return bestiary
      .filter(m => m.name.toLowerCase().includes(q) && !chosen.has(m.name.toLowerCase()))
      .slice(0, 8)
    // `chosen` dérive de `value` : le recalculer à chaque frappe coûte moins qu'une
    // dépendance sur un Set reconstruit à chaque rendu.
  }, [search, bestiary, value]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = value.reduce((n, e) => n + e.count, 0)
  const difficulty = computeEncounterDifficulty(value, partyLevels)

  function add(name: string, cr: string) {
    onChange([...value, { monster_name: name, count: 1, ...(cr ? { cr } : {}) }])
    setSearch('')
  }
  function setCount(idx: number, count: number) {
    if (count < 1) return
    onChange(value.map((e, i) => (i === idx ? { ...e, count } : e)))
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }
  /** Le raccourci ajoute aux créatures déjà présentes, il ne les remplace pas. */
  function importEncounter(enc: SavedEncounter) {
    const merged = [...value]
    for (const entry of enc.entries) {
      const existing = merged.findIndex(e => e.monster_name.toLowerCase() === entry.monster_name.toLowerCase())
      if (existing >= 0) merged[existing] = { ...merged[existing], count: merged[existing].count + entry.count }
      else merged.push({ ...entry })
    }
    onChange(merged)
  }

  return (
    <div className="border border-stone-700 rounded-lg p-2.5 space-y-2 bg-stone-900/40">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-stone-400 text-xs font-semibold">⚔ Ennemis</span>
        {total > 0 && <span className="text-stone-600 text-xs">{total} créature{total > 1 ? 's' : ''}</span>}
        {difficulty && (
          <span className={`text-xs font-semibold ${difficultyColor(difficulty)}`} title="Difficulté estimée pour le groupe">
            {difficulty}
          </span>
        )}
      </div>

      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((entry, idx) => (
            <div key={`${entry.monster_name}-${idx}`} className="flex items-center gap-2 bg-stone-800/70 border border-stone-700 rounded px-2 py-1">
              <button
                onClick={() => setCount(idx, entry.count - 1)}
                disabled={entry.count <= 1}
                className="text-stone-500 hover:text-stone-200 text-xs leading-none px-1 disabled:opacity-30 transition-colors"
                title="Un de moins"
              >−</button>
              <span className="text-stone-300 text-xs font-semibold w-5 text-center tabular-nums">{entry.count}</span>
              <button
                onClick={() => setCount(idx, entry.count + 1)}
                className="text-stone-500 hover:text-stone-200 text-xs leading-none px-1 transition-colors"
                title="Un de plus"
              >+</button>
              <span className="text-stone-200 text-xs flex-1 min-w-0 truncate">{entry.monster_name}</span>
              {entry.cr && <span className="text-stone-600 text-xs shrink-0">FP {entry.cr}</span>}
              <button
                onClick={() => remove(idx)}
                className="text-stone-700 hover:text-red-400 text-sm leading-none shrink-0 transition-colors"
                title="Retirer"
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Ajouter une créature du bestiaire…"
          className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-stone-200 text-xs placeholder-stone-600 focus:outline-none focus:border-sky-500 transition-colors"
        />
        {suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-stone-900 border border-stone-700 rounded-lg shadow-xl overflow-hidden">
            {suggestions.map(m => (
              <button
                key={m.name}
                onClick={() => add(m.name, m.cr)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-stone-800 transition-colors"
              >
                <span className="text-stone-200 text-xs flex-1 min-w-0 truncate">{m.name}</span>
                {m.custom && <span className="text-violet-400 text-[10px] shrink-0" title="Bestiaire de la campagne">perso</span>}
                <span className="text-stone-600 text-xs shrink-0">FP {m.cr}</span>
              </button>
            ))}
          </div>
        )}
        {search.trim().length >= 2 && suggestions.length === 0 && (
          <p className="text-stone-600 text-[11px] mt-1">Aucune créature de ce nom dans le bestiaire.</p>
        )}
      </div>

      {savedEncounters.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-stone-600 text-[11px]">Depuis une rencontre :</span>
          {savedEncounters.map((enc, i) => (
            <button
              key={`${enc.name}-${i}`}
              onClick={() => importEncounter(enc)}
              title={enc.entries.map(e => `${e.count}× ${e.monster_name}`).join(', ')}
              className="text-[11px] rounded px-1.5 py-0.5 border border-stone-700 text-stone-400 hover:text-sky-300 hover:border-sky-700 transition-colors"
            >+ {enc.name}</button>
          ))}
        </div>
      )}
    </div>
  )
}
