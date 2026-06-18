// XP requis pour atteindre chaque niveau (index = niveau cible, valeur = XP nécessaire)
export const XP_FOR_LEVEL: Record<number, number> = {
  2: 300, 3: 900, 4: 2700, 5: 6500, 6: 14000, 7: 23000, 8: 34000,
  9: 48000, 10: 64000, 11: 85000, 12: 100000, 13: 120000, 14: 140000,
  15: 165000, 16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000,
}

export function canLevelUp(level: number, xp: number): boolean {
  const needed = XP_FOR_LEVEL[level + 1]
  return needed !== undefined && xp >= needed
}

export function xpForNextLevel(level: number): number | null {
  return XP_FOR_LEVEL[level + 1] ?? null
}
