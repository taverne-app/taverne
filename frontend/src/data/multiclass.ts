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
