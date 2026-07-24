export type CasterType = 'full' | 'half' | 'third' | 'none'

export const CASTER_TYPE: Record<string, CasterType> = {
  barde: 'full', clerc: 'full', druide: 'full', sorcier: 'full', magicien: 'full',
  bard: 'full', cleric: 'full', druid: 'full', sorcerer: 'full', wizard: 'full',
  occultiste: 'full', warlock: 'full',
  paladin: 'half', rôdeur: 'half', ranger: 'half',
  guerrier: 'third', fighter: 'third',
  roublard: 'third', rogue: 'third',
}

const normClass = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export function getCasterLevel(className: string, level: number): number {
  const type = CASTER_TYPE[normClass(className)]
    ?? CASTER_TYPE[className.toLowerCase()]
    ?? 'none'
  if (type === 'full') return level
  if (type === 'half') return Math.floor(level / 2)
  if (type === 'third') return Math.floor(level / 3)
  return 0
}

// Classes qui PRÉPARENT leurs sorts chaque jour, par opposition à celles qui les
// « connaissent » définitivement (ensorceleur, barde, occultiste, rôdeur) et n'ont
// donc aucun plafond de préparation. La valeur dit quelle part du niveau de classe
// entre dans « niveau + mod. » : plein pour les lanceurs complets, la moitié pour les
// demi-lanceurs (paladin arrondit à l'inférieur, artificier au supérieur).
const PREPARED_CASTERS: Record<string, 'full' | 'half-down' | 'half-up'> = {
  magicien: 'full', wizard: 'full',
  clerc: 'full', cleric: 'full',
  druide: 'full', druid: 'full',
  paladin: 'half-down',
  artificier: 'half-up', artificer: 'half-up',
}

function preparedClassLevel(className: string, level: number): number {
  const kind = PREPARED_CASTERS[normClass(className)] ?? PREPARED_CASTERS[className.toLowerCase()]
  if (!kind) return 0
  if (kind === 'full') return level
  if (kind === 'half-down') return Math.floor(level / 2)
  return Math.ceil(level / 2)
}

/**
 * Nombre de sorts de niveau ≥ 1 qu'un personnage peut préparer, ou `null` s'il ne
 * possède aucune classe qui prépare (les tours de magie, eux, ne se préparent jamais).
 * Règle 5e : niveau de la classe + mod. d'incantation, minimum 1 par classe. On somme
 * sur les classes qui préparent — cas rare du multiclassage ; le modèle ne stocke qu'un
 * seul modificateur d'incantation, on l'applique donc à chaque part.
 */
export function maxPreparedSpells(
  primaryClass: string, primaryLevel: number,
  secondaryClass: string | null, secondaryLevel: number | null,
  castingModifier: number,
): number | null {
  const parts = [
    preparedClassLevel(primaryClass, primaryLevel),
    secondaryClass ? preparedClassLevel(secondaryClass, secondaryLevel ?? 0) : 0,
  ].filter(classLevel => classLevel > 0)
  if (parts.length === 0) return null
  return parts.reduce((sum, classLevel) => sum + Math.max(1, classLevel + castingModifier), 0)
}

// Total caster level → slots par niveau de sort (index 0 = niveau 1)
export const MULTICLASS_SLOTS: Record<number, number[]> = {
  1:  [2],
  2:  [3],
  3:  [4, 2],
  4:  [4, 3],
  5:  [4, 3, 2],
  6:  [4, 3, 3],
  7:  [4, 3, 3, 1],
  8:  [4, 3, 3, 2],
  9:  [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1],
  13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1],
  16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
}

export function computeMulticlassSlots(
  primaryClass: string, primaryLevel: number,
  secondaryClass: string, secondaryLevel: number,
): number[] | null {
  const casterLevel = getCasterLevel(primaryClass, primaryLevel) + getCasterLevel(secondaryClass, secondaryLevel)
  if (casterLevel < 1) return null
  return MULTICLASS_SLOTS[Math.min(casterLevel, 20)] ?? null
}
