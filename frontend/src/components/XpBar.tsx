import { canLevelUp, xpForNextLevel } from '../data/xp'

/**
 * Jauge de progression vers le niveau suivant.
 *
 * La barre se remplit entre le seuil du niveau ACTUEL et celui du suivant — pas
 * depuis zéro : à 2 700 XP au niveau 4, on démarre le niveau, la barre est vide.
 * Au niveau 20 il n'y a plus de palier : la barre est pleine.
 */
export function XpBar({
  level,
  xp,
  compact = false,
}: {
  level: number
  xp: number
  /** Version resserrée pour les cartes : pas de libellé sous la barre. */
  compact?: boolean
}) {
  const nextXp = xpForNextLevel(level)
  const prevXp = xpForNextLevel(level - 1) ?? 0
  const pct = nextXp
    ? Math.min(1, Math.max(0, (xp - prevXp) / (nextXp - prevXp)))
    : 1
  const ready = canLevelUp(level, xp)

  return (
    <div className={compact ? 'mt-2' : 'mt-1'}>
      <div className="flex justify-between text-xs text-stone-400 mb-1">
        <span>XP</span>
        <span className="flex items-center gap-1.5">
          {ready && (
            <span className="text-amber-400 font-semibold">↑ Niv. {level + 1}</span>
          )}
          <span>
            {xp.toLocaleString('fr-FR')}
            {nextXp && <span className="text-stone-600"> / {nextXp.toLocaleString('fr-FR')}</span>}
          </span>
        </span>
      </div>
      <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ready ? 'bg-amber-400 animate-pulse' : 'bg-amber-600'}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {!compact && nextXp && (
        <p className="text-stone-600 text-[10px] mt-0.5 text-right">
          {ready
            ? `Niveau ${level + 1} disponible`
            : `${(nextXp - xp).toLocaleString('fr-FR')} XP avant le niveau ${level + 1}`}
        </p>
      )}
    </div>
  )
}
