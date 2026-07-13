import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  longRest, shortRest, updateConditions, updateDeathSaves,
  updateExhaustion, updateHp, updateInspiration,
  type Character,
} from '../api/characters'
import { canLevelUp } from '../data/xp'
import { useToast } from '../contexts/ToastContext'
import { hpColor, CONDITIONS_FR } from '../pages/campaign/shared'

/**
 * Le tableau de bord de l'équipe : bascule Vue MJ / Cartes, repos de groupe, et
 * la Vue MJ elle-même (PV, jets contre la mort, états, épuisement, emplacements
 * de sorts — tout modifiable en place, sans ouvrir chaque fiche).
 *
 * Il vivait dans la page Session, où il faisait doublon avec la page Personnages.
 * Ce sont des gestes sur les personnages : leur place est ici.
 *
 * `children` porte la vue « Cartes » — celle de la page hôte, pour ne pas la dupliquer.
 */
export function PartyBoard({
  characters,
  setCharacters,
  children,
}: {
  characters: Character[]
  setCharacters: (updater: (prev: Character[]) => Character[]) => void
  children: ReactNode
}) {
  const toast = useToast()
  const [dmView, setDmView] = useState(false)
  const [restingAll, setRestingAll] = useState(false)
  const [restDone, setRestDone] = useState<'long' | 'short' | null>(null)
  const [hpEditCharId, setHpEditCharId] = useState<number | null>(null)
  const [hpDeltaValue, setHpDeltaValue] = useState(5)

  const replace = (updated: Character) =>
    setCharacters(prev => prev.map(c => (c.id === updated.id ? updated : c)))

  async function handleToggleInspiration(charId: number, current: boolean) {
    try {
      replace(await updateInspiration(charId, !current))
    } catch {
      toast.error("L'inspiration n'a pas pu être modifiée.")
    }
  }

  async function handleQuickHp(charId: number, amount: number, type: 'damage' | 'heal') {
    if (amount <= 0) return
    try {
      replace(await updateHp(charId, amount, type))
      setHpEditCharId(null)
    } catch {
      toast.error('Les PV n’ont pas pu être modifiés.')
    }
  }

  async function handleToggleDeathSave(charId: number, kind: 'success' | 'failure', current: number) {
    const char = characters.find(c => c.id === charId)
    if (!char) return
    const next = current >= 3 ? 0 : current + 1
    try {
      replace(await updateDeathSaves(
        charId,
        kind === 'success' ? next : char.state.death_saves_successes,
        kind === 'failure' ? next : char.state.death_saves_failures,
      ))
    } catch {
      toast.error("Le jet de sauvegarde n'a pas pu être enregistré.")
    }
  }

  async function handleAddCondition(charId: number, cond: string) {
    const char = characters.find(c => c.id === charId)
    if (!char || char.state.conditions.includes(cond)) return
    try {
      replace(await updateConditions(charId, [...char.state.conditions, cond]))
    } catch {
      toast.error("L'état n'a pas pu être ajouté.")
    }
  }

  async function handleRemoveCondition(charId: number, cond: string) {
    const char = characters.find(c => c.id === charId)
    if (!char) return
    try {
      replace(await updateConditions(charId, char.state.conditions.filter(c => c !== cond)))
    } catch {
      toast.error("L'état n'a pas pu être retiré.")
    }
  }

  async function handleChangeExhaustion(charId: number, delta: number) {
    const char = characters.find(c => c.id === charId)
    if (!char) return
    const next = Math.max(0, Math.min(6, char.state.exhaustion_level + delta))
    try {
      replace(await updateExhaustion(charId, next))
    } catch {
      toast.error("L'épuisement n'a pas pu être modifié.")
    }
  }

  /**
   * Repos de groupe. Un repos rate rarement, mais s'il rate à mi-chemin l'équipe se
   * retrouve dans un état bâtard : on recharge tout et on le dit, plutôt que de laisser
   * l'écran mentir.
   */
  async function handleGroupRest(kind: 'short' | 'long') {
    if (restingAll || characters.length === 0) return
    setRestingAll(true)
    try {
      const updated = kind === 'short'
        ? (await Promise.all(characters.map(c => shortRest(c.id, 1)))).map(r => r.character)
        : await Promise.all(characters.map(c => longRest(c.id)))
      setCharacters(() => updated)
      setRestDone(kind)
      setTimeout(() => setRestDone(null), 4000)
    } catch {
      toast.error("Le repos n'a pas pu être appliqué à toute l'équipe. Rechargez la page.")
    } finally {
      setRestingAll(false)
    }
  }

  return (
    <>
      {characters.length > 0 && (
        <div className="flex items-center justify-end gap-3 mb-3">
          <button
            onClick={() => setDmView(v => !v)}
            className={`text-xs font-medium transition-colors ${
              dmView ? 'text-violet-400 hover:text-violet-300' : 'text-stone-500 hover:text-violet-400'
            }`}
            title="Vue MJ — toutes les infos en tableau, modifiables en place"
          >
            {dmView ? '⊞ Cartes' : '☰ Vue MJ'}
          </button>
          <button
            onClick={() => handleGroupRest('short')}
            disabled={restingAll}
            className="text-stone-500 hover:text-sky-400 text-xs font-medium transition-colors disabled:opacity-40"
            title="Repos court — 1 dé de vie par personnage"
          >
            {restingAll ? '…' : restDone === 'short' ? '✓ Repos terminé' : '☀ Repos court'}
          </button>
          <button
            onClick={() => handleGroupRest('long')}
            disabled={restingAll}
            className="text-stone-500 hover:text-amber-400 text-xs font-medium transition-colors disabled:opacity-40"
            title="Repos long — appliqué à toute l'équipe"
          >
            {restingAll ? '…' : restDone === 'long' ? '✓ Repos terminé' : '🌙 Repos long'}
          </button>
        </div>
      )}

      {!dmView ? children : (
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-stone-800">
            {characters.map(c => {
              const hpPct = Math.max(0, Math.min(100, (c.combat.current_hp / c.combat.max_hp) * 100))
              const isDying = c.combat.current_hp <= 0
              const levelUp = canLevelUp(c.level, c.experience_points)
              return (
                <div key={c.id} className="px-4 py-3 hover:bg-stone-800/40 transition-colors relative group">
                  <Link to={`/characters/${c.id}`} className="absolute inset-0" aria-label={`Ouvrir la fiche de ${c.name}`} />
                  <div className="flex items-center gap-4 min-w-0">

                    <div className="w-44 shrink-0 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`font-semibold text-sm truncate ${isDying ? 'text-red-400' : 'text-white'}`}>
                          {c.name}
                        </span>
                        {levelUp && (
                          <span className="shrink-0 text-xs bg-amber-900/50 border border-amber-600/50 text-amber-400 rounded px-1 py-0.5 font-semibold">
                            ⬆ Niv
                          </span>
                        )}
                        <button
                          onClick={e => { e.preventDefault(); handleToggleInspiration(c.id, c.combat.inspiration) }}
                          title={c.combat.inspiration ? "Retirer l'inspiration" : "Accorder l'inspiration"}
                          className={`relative z-10 shrink-0 text-xs transition-colors ${c.combat.inspiration ? 'text-amber-400 hover:text-amber-300' : 'text-stone-700 hover:text-amber-500'}`}
                        >✦</button>
                      </div>
                      <p className="text-stone-500 text-xs truncate mt-0.5">
                        {c.character_class} Niv.{c.level} · CA {c.combat.armor_class}
                      </p>
                    </div>

                    {/* PV — cliquables pour soigner / blesser sans ouvrir la fiche */}
                    <div className="relative z-10 w-40 shrink-0">
                      <div className="flex items-center justify-between mb-1">
                        <button
                          onClick={e => { e.preventDefault(); setHpEditCharId(hpEditCharId === c.id ? null : c.id); setHpDeltaValue(5) }}
                          className={`text-sm font-bold transition-colors ${isDying ? 'text-red-400 hover:text-red-300' : 'text-white hover:text-amber-300'}`}
                          title="Cliquer pour modifier les PV"
                        >
                          {c.combat.current_hp}
                        </button>
                        <span className="text-stone-500 text-xs">/ {c.combat.max_hp}</span>
                        {c.combat.temporary_hp > 0 && (
                          <span className="text-sky-400 text-xs">+{c.combat.temporary_hp}</span>
                        )}
                      </div>
                      <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${hpColor(c.combat.current_hp, c.combat.max_hp)}`}
                          style={{ width: `${hpPct}%` }}
                        />
                      </div>
                      {hpEditCharId === c.id && (
                        <div className="mt-1.5 flex items-center gap-1">
                          <input
                            type="number"
                            value={hpDeltaValue}
                            onChange={e => setHpDeltaValue(Math.max(1, parseInt(e.target.value) || 1))}
                            min={1}
                            className="w-12 bg-stone-800 border border-stone-700 rounded px-1.5 py-0.5 text-white text-xs text-center focus:outline-none"
                            onClick={e => e.preventDefault()}
                          />
                          <button
                            onClick={e => { e.preventDefault(); handleQuickHp(c.id, hpDeltaValue, 'heal') }}
                            className="flex-1 bg-emerald-900/60 hover:bg-emerald-900/80 border border-emerald-800/50 text-emerald-400 text-xs font-bold rounded py-0.5 transition-colors"
                          >+</button>
                          <button
                            onClick={e => { e.preventDefault(); handleQuickHp(c.id, hpDeltaValue, 'damage') }}
                            className="flex-1 bg-red-900/40 hover:bg-red-900/60 border border-red-800/40 text-red-400 text-xs font-bold rounded py-0.5 transition-colors"
                          >−</button>
                        </div>
                      )}
                    </div>

                    {isDying && (
                      <div className="relative z-10 flex items-center gap-1 shrink-0" title="Jets de sauvegarde contre la mort (cycle 0→3→0)">
                        {[1, 2, 3].map(n => (
                          <button
                            key={`s${n}`}
                            onClick={e => { e.preventDefault(); handleToggleDeathSave(c.id, 'success', c.state.death_saves_successes) }}
                            className={`w-3.5 h-3.5 rounded-full border transition-colors ${n <= c.state.death_saves_successes ? 'bg-emerald-500 border-emerald-400 hover:bg-emerald-400' : 'border-stone-600 hover:border-emerald-500'}`}
                          />
                        ))}
                        <span className="text-stone-600 text-xs mx-0.5">/</span>
                        {[1, 2, 3].map(n => (
                          <button
                            key={`f${n}`}
                            onClick={e => { e.preventDefault(); handleToggleDeathSave(c.id, 'failure', c.state.death_saves_failures) }}
                            className={`w-3.5 h-3.5 rounded-full border transition-colors ${n <= c.state.death_saves_failures ? 'bg-red-500 border-red-400 hover:bg-red-400' : 'border-stone-600 hover:border-red-500'}`}
                          />
                        ))}
                      </div>
                    )}

                    <div className="relative z-10 flex flex-wrap gap-1 flex-1 min-w-0 items-center">
                      {c.state.conditions.map(cond => (
                        <button
                          key={cond}
                          onClick={e => { e.preventDefault(); handleRemoveCondition(c.id, cond) }}
                          title="Cliquer pour retirer"
                          className="text-xs bg-purple-900/50 border border-purple-700 text-purple-300 hover:bg-red-900/40 hover:border-red-700 hover:text-red-300 rounded px-1.5 py-0.5 transition-colors"
                        >
                          {CONDITIONS_FR[cond] ?? cond} ×
                        </button>
                      ))}
                      <select
                        value=""
                        onChange={e => { if (e.target.value) { handleAddCondition(c.id, e.target.value); e.target.value = '' } }}
                        onClick={e => e.preventDefault()}
                        className="text-xs bg-transparent border border-stone-700 text-stone-600 hover:text-stone-400 rounded px-1 py-0.5 focus:outline-none cursor-pointer transition-colors"
                        title="Ajouter un état"
                      >
                        <option value="">+ état</option>
                        {Object.entries(CONDITIONS_FR).filter(([k]) => !c.state.conditions.includes(k)).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>

                    <div className="hidden lg:flex flex-col items-center shrink-0 w-12" title="Perception passive">
                      <span className="text-stone-500 text-[10px] uppercase tracking-wide">PP</span>
                      <span className="text-stone-200 text-sm font-semibold">{c.passive_perception}</span>
                    </div>

                    <div className="hidden xl:flex flex-col gap-1 shrink-0 min-w-[120px]">
                      {c.state.concentrating_on && (
                        <span className="text-xs bg-violet-900/50 border border-violet-700/50 text-violet-300 rounded px-1.5 py-0.5 truncate max-w-[140px]" title={`◈ ${c.state.concentrating_on}`}>
                          ◈ {c.state.concentrating_on}
                        </span>
                      )}
                      <div className="relative z-10 flex items-center gap-1">
                        {c.state.exhaustion_level > 0 && (
                          <span className={`text-xs rounded px-1.5 py-0.5 border ${
                            c.state.exhaustion_level <= 2 ? 'bg-amber-900/40 border-amber-700/50 text-amber-400'
                              : c.state.exhaustion_level <= 4 ? 'bg-orange-900/40 border-orange-700/50 text-orange-400'
                              : 'bg-red-900/40 border-red-700/50 text-red-400'
                          }`}>
                            Épuis. {c.state.exhaustion_level}
                          </span>
                        )}
                        <button
                          onClick={e => { e.preventDefault(); handleChangeExhaustion(c.id, -1) }}
                          disabled={c.state.exhaustion_level <= 0}
                          title="Réduire l'épuisement"
                          className="text-stone-600 hover:text-stone-400 text-xs disabled:opacity-20 transition-colors"
                        >−</button>
                        <button
                          onClick={e => { e.preventDefault(); handleChangeExhaustion(c.id, +1) }}
                          disabled={c.state.exhaustion_level >= 6}
                          title="Augmenter l'épuisement"
                          className="text-stone-600 hover:text-amber-400 text-xs disabled:opacity-20 transition-colors"
                        >+</button>
                      </div>
                      {c.spellcasting.ability && Object.entries(c.spellcasting.slots)
                        .filter(([, s]) => s.max > 0)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .slice(0, 4)
                        .map(([lvl, slot]) => {
                          const available = slot.max - slot.used
                          return (
                            <div key={lvl} className="flex items-center gap-1">
                              <span className="text-stone-600 text-xs w-3">{lvl}</span>
                              <div className="flex gap-0.5">
                                {Array.from({ length: slot.max }, (_, i) => (
                                  <span
                                    key={i}
                                    className={`w-2.5 h-2.5 rounded-full border ${
                                      i < available ? 'bg-violet-500 border-violet-400' : 'bg-transparent border-stone-600'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                        })
                      }
                      {c.resources.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.resources.map((r, i) => (
                            <span key={i} className={`text-xs rounded px-1.5 py-0.5 border ${
                              r.current === 0
                                ? 'bg-stone-800 border-stone-700 text-stone-600'
                                : 'bg-stone-800 border-stone-600 text-stone-300'
                            }`}>
                              {r.name} {r.current}/{r.max}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="text-stone-700 group-hover:text-stone-500 text-sm transition-colors shrink-0 relative z-10">↗</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
