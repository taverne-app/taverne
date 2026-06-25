import { CR_XP } from './monsters'

export const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
   1: [25,  50,   75,   100],
   2: [50,  100,  150,  200],
   3: [75,  150,  225,  400],
   4: [125, 250,  375,  500],
   5: [250, 500,  750,  1100],
   6: [300, 600,  900,  1400],
   7: [350, 750,  1100, 1700],
   8: [450, 900,  1400, 2100],
   9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800],
  11: [800, 1600, 2400, 3600],
  12: [1000,2000, 3000, 4500],
  13: [1100,2200, 3400, 5100],
  14: [1250,2500, 3800, 5700],
  15: [1400,2800, 4300, 6400],
  16: [1600,3200, 4800, 7200],
  17: [2000,3900, 5900, 8800],
  18: [2100,4200, 6300, 9500],
  19: [2400,4900, 7300, 10900],
  20: [2800,5700, 8500, 12700],
}

export function encounterMultiplier(count: number): number {
  if (count <= 1) return 1
  if (count === 2) return 1.5
  if (count <= 6) return 2
  if (count <= 10) return 2.5
  if (count <= 14) return 3
  return 4
}

export function encounterDifficultyLabel(adjustedXp: number, thresholds: [number, number, number, number]): string {
  if (adjustedXp >= thresholds[3]) return 'Mortelle'
  if (adjustedXp >= thresholds[2]) return 'Difficile'
  if (adjustedXp >= thresholds[1]) return 'Moyen'
  if (adjustedXp >= thresholds[0]) return 'Facile'
  return 'Triviale'
}

export function difficultyColor(label: string): string {
  if (label === 'Mortelle')  return 'text-red-400'
  if (label === 'Difficile') return 'text-orange-400'
  if (label === 'Moyen')     return 'text-amber-400'
  if (label === 'Facile')    return 'text-emerald-400'
  return 'text-stone-400'
}

export function difficultyBg(label: string): string {
  if (label === 'Mortelle')  return 'bg-red-900/30 border-red-700/40'
  if (label === 'Difficile') return 'bg-orange-900/30 border-orange-700/40'
  if (label === 'Moyen')     return 'bg-amber-900/30 border-amber-700/40'
  if (label === 'Facile')    return 'bg-emerald-900/30 border-emerald-700/40'
  return 'bg-stone-800/60 border-stone-700/40'
}

export function computeEncounterDifficulty(
  entries: { cr?: string; count: number }[],
  partyLevels: number[],
): string | null {
  if (entries.length === 0 || partyLevels.length === 0) return null
  if (!entries.some(e => e.cr)) return null

  const partyThresholds: [number, number, number, number] = [0, 0, 0, 0]
  for (const lvl of partyLevels) {
    const t = XP_THRESHOLDS[Math.min(Math.max(lvl, 1), 20)] ?? XP_THRESHOLDS[1]
    partyThresholds[0] += t[0]
    partyThresholds[1] += t[1]
    partyThresholds[2] += t[2]
    partyThresholds[3] += t[3]
  }

  const totalCount = entries.reduce((s, e) => s + e.count, 0)
  const mult = encounterMultiplier(totalCount)
  const baseXp = entries.reduce((s, e) => {
    if (!e.cr) return s
    return s + (CR_XP[e.cr] ?? 0) * e.count
  }, 0)
  const adjustedXp = Math.round(baseXp * mult)

  return encounterDifficultyLabel(adjustedXp, partyThresholds)
}
