import { useState } from 'react'
import { updateIdentity, type Character } from '../api/characters'
import type { TreasureItem } from '../api/campaigns'
import { coinsToGold, itemsGold, formatGoldNumber } from '../lib/gold'
import { useToast } from '../contexts/ToastContext'

/**
 * Statistiques du groupe, et distribution d'XP.
 *
 * Elles vivaient dans l'onglet « Journal » de la campagne, et la distribution d'XP
 * dans le tableau de bord de la page Session. Les deux ne parlent que des
 * personnages : leur place est en bas de la page Personnages.
 *
 * L'ordre des tuiles n'est pas anodin : « Niveau moyen » est collé à « XP total »,
 * parce que c'est la même notion vue de deux façons — et c'est sous l'XP qu'on
 * en distribue.
 */
export function PartyStats({
  characters,
  setCharacters,
  treasury = [],
}: {
  characters: Character[]
  setCharacters: (updater: (prev: Character[]) => Character[]) => void
  /** Le coffre du groupe : sa valeur entre dans l'or total. */
  treasury?: TreasureItem[]
}) {
  const toast = useToast()
  const [xpInput, setXpInput] = useState('')
  const [saving, setSaving] = useState(false)

  if (characters.length === 0) return null

  const totalHp    = characters.reduce((s, c) => s + c.combat.current_hp, 0)
  const totalMaxHp = characters.reduce((s, c) => s + c.combat.max_hp, 0)
  const avgLevel   = (characters.reduce((s, c) => s + c.level, 0) / characters.length).toFixed(1)
  const totalXp    = characters.reduce((s, c) => s + c.experience_points, 0)
  const dying      = characters.filter(c => c.combat.current_hp <= 0).length
  const hpPct      = totalMaxHp > 0 ? Math.round((totalHp / totalMaxHp) * 100) : null

  /**
   * Or total : les bourses des personnages, le coffre du groupe, et l'équipement porté.
   *
   * Les trois entrent depuis que toutes les valeurs sont des nombres de po et non plus
   * des textes libres. Un objet sans valeur chiffrée compte pour zéro : il ne fausse rien.
   * Le détail est affiché sous le total, pour qu'on sache d'où vient le chiffre — un
   * équipement coûteux n'est pas de l'argent liquide.
   */
  const purseGold = characters.reduce((sum, c) => sum + coinsToGold(c.currency), 0)
  const chestGold = itemsGold(treasury)
  const gearGold  = characters.reduce((sum, c) => sum + itemsGold(c.inventory?.items ?? []), 0)
  const totalGold = purseGold + chestGold + gearGold
  const gold = formatGoldNumber

  /**
   * Chaque personnage reçoit le montant PLEIN — l'XP d'une rencontre n'est pas
   * divisée par le nombre de PJ, c'est la règle 5e (le partage est déjà fait
   * dans le calcul de l'XP de rencontre).
   */
  async function handleAwardXp() {
    const amount = parseInt(xpInput, 10)
    if (isNaN(amount) || amount === 0) return

    setSaving(true)
    try {
      const updated = await Promise.all(
        characters.map(c => updateIdentity(c.id, {
          experience_points: Math.max(0, c.experience_points + amount),
        })),
      )
      setCharacters(() => updated)
      setXpInput('')
      toast.success(
        amount > 0
          ? `+${amount.toLocaleString('fr-FR')} XP pour chaque personnage.`
          : `${amount.toLocaleString('fr-FR')} XP pour chaque personnage.`,
      )
    } catch {
      toast.error("L'XP n'a pas pu être distribuée. Rechargez la page.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
      <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">Statistiques du groupe</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-stone-800 rounded-lg p-3 text-center flex flex-col justify-center">
          <p className="text-stone-500 text-xs mb-1">Personnages</p>
          <p className="text-white font-bold text-xl">{characters.length}</p>
        </div>

        {hpPct != null && (
          <div className="bg-stone-800 rounded-lg p-3 text-center flex flex-col justify-center">
            <p className="text-stone-500 text-xs mb-1">PV groupe</p>
            <p className={`font-bold text-xl ${dying > 0 ? 'text-red-400' : hpPct > 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {hpPct}%
            </p>
            <p className="text-stone-600 text-xs">{totalHp}/{totalMaxHp}</p>
          </div>
        )}

        <div className="bg-stone-800 rounded-lg p-3 text-center flex flex-col justify-center">
          <p className="text-stone-500 text-xs mb-1">Niveau moyen</p>
          <p className="text-white font-bold text-xl">{avgLevel}</p>
        </div>

        <div className="bg-stone-800 rounded-lg p-3 text-center flex flex-col justify-center">
          <p className="text-stone-500 text-xs mb-1">Or total</p>
          <p className="text-amber-400 font-bold text-xl">{gold(totalGold)}</p>
          {/* Les parts sont formatées comme le total : arrondies séparément, elles
              ne se sommeraient plus (173,5 + 3 532,5 donnerait « 174 + 3533 = 3707 »). */}
          <p
            className="text-stone-600 text-xs"
            title={`Bourses ${gold(purseGold)} po · Coffre ${gold(chestGold)} po · Équipement ${gold(gearGold)} po`}
          >
            po · {[
              `${gold(purseGold)} bourses`,
              chestGold > 0 ? `${gold(chestGold)} coffre` : null,
              gearGold > 0 ? `${gold(gearGold)} équip.` : null,
            ].filter(Boolean).join(' + ')}
          </p>
        </div>

        <div className="bg-stone-800 rounded-lg p-3 text-center flex flex-col justify-between">
          <p className="text-stone-500 text-xs mb-1">XP total</p>
          <p className="text-white font-bold text-xl">{totalXp.toLocaleString('fr-FR')}</p>

          {/* Distribution : le montant saisi va à CHACUN, tel quel. */}
          <div className="mt-2 pt-2 border-t border-stone-700 flex items-center gap-1">
            <input
              type="number"
              value={xpInput}
              onChange={e => setXpInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAwardXp() }}
              placeholder="XP à chacun"
              disabled={saving}
              className="w-full min-w-0 bg-stone-900 border border-stone-700 rounded px-2 py-1 text-white text-xs text-center placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleAwardXp}
              disabled={saving || !xpInput.trim()}
              title="Ajouter ce montant d'XP à chaque personnage"
              className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded px-2 py-1 transition-colors disabled:opacity-40"
            >
              {saving ? '…' : '+'}
            </button>
          </div>
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
