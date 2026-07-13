import type { Character } from '../api/characters'

/**
 * Statistiques du groupe. Elles vivaient dans l'onglet « Journal » de la campagne,
 * mais ne parlent que des personnages — leur place est en bas de la page Personnages.
 *
 * Le nombre de séances, lui, a été abandonné : il n'apprenait rien.
 */
export function PartyStats({ characters }: { characters: Character[] }) {
  if (characters.length === 0) return null

  const totalHp    = characters.reduce((s, c) => s + c.combat.current_hp, 0)
  const totalMaxHp = characters.reduce((s, c) => s + c.combat.max_hp, 0)
  const avgLevel   = (characters.reduce((s, c) => s + c.level, 0) / characters.length).toFixed(1)
  const totalXp    = characters.reduce((s, c) => s + c.experience_points, 0)
  const dying      = characters.filter(c => c.combat.current_hp <= 0).length
  const hpPct      = totalMaxHp > 0 ? Math.round((totalHp / totalMaxHp) * 100) : null

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
      <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">Statistiques du groupe</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-stone-800 rounded-lg p-3 text-center">
          <p className="text-stone-500 text-xs mb-1">Personnages</p>
          <p className="text-white font-bold text-xl">{characters.length}</p>
        </div>
        <div className="bg-stone-800 rounded-lg p-3 text-center">
          <p className="text-stone-500 text-xs mb-1">Niveau moyen</p>
          <p className="text-white font-bold text-xl">{avgLevel}</p>
        </div>
        {hpPct != null && (
          <div className="bg-stone-800 rounded-lg p-3 text-center">
            <p className="text-stone-500 text-xs mb-1">PV groupe</p>
            <p className={`font-bold text-xl ${dying > 0 ? 'text-red-400' : hpPct > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {hpPct}%
            </p>
            <p className="text-stone-600 text-xs">{totalHp}/{totalMaxHp}</p>
          </div>
        )}
        <div className="bg-stone-800 rounded-lg p-3 text-center">
          <p className="text-stone-500 text-xs mb-1">XP total</p>
          <p className="text-white font-bold text-xl">{totalXp.toLocaleString('fr-FR')}</p>
        </div>
      </div>
      {dying > 0 && (
        <p className="text-red-400 text-xs mt-2 text-center">
          {dying} personnage{dying > 1 ? 's' : ''} à terre
        </p>
      )}
    </div>
  )
}
