export interface MonsterTemplate {
  name: string
  cr: string
  ac: number
  hp_dice: number
  hp_sides: number
  hp_bonus: number
  hp_avg: number
  initiative_mod: number
  xp: number
}

export const CR_XP: Record<string, number> = {
  '0':    10,
  '1/8':  25,
  '1/4':  50,
  '1/2': 100,
  '1':   200,
  '2':   450,
  '3':   700,
  '4':  1100,
  '5':  1800,
  '6':  2300,
  '7':  2900,
  '8':  3900,
  '9':  5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
}

export function crToXp(cr: string): number {
  return CR_XP[cr] ?? 0
}

export const MONSTERS: MonsterTemplate[] = [
  // CR 0
  { name: 'Roturier',          cr: '0',    ac: 10, hp_dice:  1, hp_sides:  8, hp_bonus:   0, hp_avg:  4,  initiative_mod:  0, xp:    10 },
  { name: 'Rat',               cr: '0',    ac: 10, hp_dice:  1, hp_sides:  4, hp_bonus:  -1, hp_avg:  1,  initiative_mod:  2, xp:    10 },
  // CR 1/8
  { name: 'Bandit',            cr: '1/8',  ac: 12, hp_dice:  2, hp_sides:  8, hp_bonus:   2, hp_avg: 11,  initiative_mod:  1, xp:    25 },
  { name: 'Cultiste',          cr: '1/8',  ac: 12, hp_dice:  2, hp_sides:  8, hp_bonus:   0, hp_avg:  9,  initiative_mod:  1, xp:    25 },
  { name: 'Garde',             cr: '1/8',  ac: 16, hp_dice:  2, hp_sides:  8, hp_bonus:   2, hp_avg: 11,  initiative_mod:  1, xp:    25 },
  { name: 'Kobold',            cr: '1/8',  ac: 12, hp_dice:  2, hp_sides:  6, hp_bonus:  -2, hp_avg:  5,  initiative_mod:  2, xp:    25 },
  // CR 1/4
  { name: 'Gobelin',           cr: '1/4',  ac: 15, hp_dice:  2, hp_sides:  6, hp_bonus:   0, hp_avg:  7,  initiative_mod:  2, xp:    50 },
  { name: 'Squelette',         cr: '1/4',  ac: 13, hp_dice:  2, hp_sides:  8, hp_bonus:   4, hp_avg: 13,  initiative_mod:  2, xp:    50 },
  { name: 'Loup',              cr: '1/4',  ac: 13, hp_dice:  2, hp_sides:  8, hp_bonus:   2, hp_avg: 11,  initiative_mod:  2, xp:    50 },
  { name: 'Zombie',            cr: '1/4',  ac:  8, hp_dice:  3, hp_sides:  8, hp_bonus:   9, hp_avg: 22,  initiative_mod: -2, xp:    50 },
  { name: 'Kobold ailé',       cr: '1/4',  ac: 13, hp_dice:  2, hp_sides:  6, hp_bonus:   0, hp_avg:  7,  initiative_mod:  2, xp:    50 },
  // CR 1/2
  { name: 'Gnoll',             cr: '1/2',  ac: 15, hp_dice:  5, hp_sides:  8, hp_bonus:   0, hp_avg: 22,  initiative_mod:  1, xp:   100 },
  { name: 'Hobgobelin',        cr: '1/2',  ac: 18, hp_dice:  2, hp_sides:  8, hp_bonus:   2, hp_avg: 11,  initiative_mod:  1, xp:   100 },
  { name: 'Orc',               cr: '1/2',  ac: 13, hp_dice:  2, hp_sides:  8, hp_bonus:   6, hp_avg: 15,  initiative_mod:  1, xp:   100 },
  { name: 'Eclaireur',         cr: '1/2',  ac: 13, hp_dice:  3, hp_sides:  8, hp_bonus:   3, hp_avg: 16,  initiative_mod:  3, xp:   100 },
  { name: 'Ombre',             cr: '1/2',  ac: 12, hp_dice:  3, hp_sides:  8, hp_bonus:   3, hp_avg: 16,  initiative_mod:  2, xp:   100 },
  { name: 'Brute',             cr: '1/2',  ac: 11, hp_dice:  5, hp_sides:  8, hp_bonus:  10, hp_avg: 32,  initiative_mod:  0, xp:   100 },
  // CR 1
  { name: 'Bugbear',           cr: '1',    ac: 16, hp_dice:  5, hp_sides:  8, hp_bonus:   5, hp_avg: 27,  initiative_mod:  2, xp:   200 },
  { name: 'Loup géant',        cr: '1',    ac: 14, hp_dice:  5, hp_sides: 10, hp_bonus:  10, hp_avg: 37,  initiative_mod:  2, xp:   200 },
  { name: 'Goule',             cr: '1',    ac: 12, hp_dice:  5, hp_sides:  8, hp_bonus:   0, hp_avg: 22,  initiative_mod:  2, xp:   200 },
  { name: 'Harpie',            cr: '1',    ac: 11, hp_dice:  7, hp_sides:  8, hp_bonus:   7, hp_avg: 38,  initiative_mod:  1, xp:   200 },
  { name: 'Araignée géante',   cr: '1',    ac: 14, hp_dice:  4, hp_sides: 10, hp_bonus:   4, hp_avg: 26,  initiative_mod:  3, xp:   200 },
  { name: 'Spectre',           cr: '1',    ac: 12, hp_dice:  5, hp_sides:  8, hp_bonus:   0, hp_avg: 22,  initiative_mod:  2, xp:   200 },
  // CR 2
  { name: 'Berserker',         cr: '2',    ac: 13, hp_dice:  9, hp_sides:  8, hp_bonus:  27, hp_avg: 67,  initiative_mod:  1, xp:   450 },
  { name: 'Ettercap',          cr: '2',    ac: 13, hp_dice:  8, hp_sides:  8, hp_bonus:   8, hp_avg: 44,  initiative_mod:  2, xp:   450 },
  { name: 'Gargouille',        cr: '2',    ac: 15, hp_dice:  7, hp_sides:  8, hp_bonus:  21, hp_avg: 52,  initiative_mod:  0, xp:   450 },
  { name: 'Ghast',             cr: '2',    ac: 13, hp_dice:  8, hp_sides:  8, hp_bonus:   0, hp_avg: 36,  initiative_mod:  3, xp:   450 },
  { name: 'Ogre',              cr: '2',    ac: 11, hp_dice:  7, hp_sides: 10, hp_bonus:  21, hp_avg: 59,  initiative_mod: -1, xp:   450 },
  { name: 'Prêtre',            cr: '2',    ac: 13, hp_dice:  5, hp_sides:  8, hp_bonus:   5, hp_avg: 27,  initiative_mod:  0, xp:   450 },
  { name: 'Nuée de rats',      cr: '2',    ac: 10, hp_dice:  7, hp_sides:  8, hp_bonus:  -7, hp_avg: 24,  initiative_mod:  2, xp:   450 },
  // CR 3
  { name: 'Doppelganger',      cr: '3',    ac: 14, hp_dice:  8, hp_sides:  8, hp_bonus:  16, hp_avg: 52,  initiative_mod:  3, xp:   700 },
  { name: 'Sorcière verte',    cr: '3',    ac: 17, hp_dice: 11, hp_sides:  8, hp_bonus:  33, hp_avg: 82,  initiative_mod:  1, xp:   700 },
  { name: 'Chevalier',         cr: '3',    ac: 18, hp_dice:  8, hp_sides:  8, hp_bonus:  16, hp_avg: 52,  initiative_mod:  0, xp:   700 },
  { name: 'Manticore',         cr: '3',    ac: 14, hp_dice:  8, hp_sides: 10, hp_bonus:  24, hp_avg: 68,  initiative_mod:  0, xp:   700 },
  { name: 'Minotaure',         cr: '3',    ac: 14, hp_dice:  9, hp_sides: 10, hp_bonus:  27, hp_avg: 76,  initiative_mod:  0, xp:   700 },
  { name: 'Rejeton de vampire', cr: '3',   ac: 15, hp_dice: 11, hp_sides:  8, hp_bonus:  33, hp_avg: 82,  initiative_mod:  3, xp:   700 },
  { name: 'Revenant',          cr: '3',    ac: 14, hp_dice:  6, hp_sides:  8, hp_bonus:  18, hp_avg: 45,  initiative_mod:  1, xp:   700 },
  { name: 'Loup-garou',        cr: '3',    ac: 12, hp_dice:  9, hp_sides:  8, hp_bonus:  18, hp_avg: 58,  initiative_mod:  1, xp:   700 },
  // CR 4
  { name: 'Banshee',           cr: '4',    ac: 12, hp_dice: 13, hp_sides:  8, hp_bonus:   0, hp_avg: 58,  initiative_mod:  2, xp:  1100 },
  { name: 'Ettin',             cr: '4',    ac: 12, hp_dice: 10, hp_sides: 10, hp_bonus:  30, hp_avg: 85,  initiative_mod: -1, xp:  1100 },
  { name: 'Fantôme',           cr: '4',    ac: 11, hp_dice: 10, hp_sides:  8, hp_bonus:   0, hp_avg: 45,  initiative_mod:  3, xp:  1100 },
  { name: 'Sanglier-garou',    cr: '4',    ac: 10, hp_dice: 12, hp_sides:  8, hp_bonus:  24, hp_avg: 78,  initiative_mod:  0, xp:  1100 },
  // CR 5
  { name: 'Troll',             cr: '5',    ac: 15, hp_dice:  8, hp_sides: 10, hp_bonus:  40, hp_avg: 84,  initiative_mod:  1, xp:  1800 },
  { name: 'Licorne',           cr: '5',    ac: 12, hp_dice:  9, hp_sides: 10, hp_bonus:  18, hp_avg: 67,  initiative_mod:  3, xp:  1800 },
  { name: 'Vampire',           cr: '5',    ac: 16, hp_dice: 17, hp_sides:  8, hp_bonus:  68, hp_avg: 144, initiative_mod:  4, xp:  1800 },
  // CR 6
  { name: 'Méduse',            cr: '6',    ac: 15, hp_dice: 17, hp_sides:  8, hp_bonus:  51, hp_avg: 127, initiative_mod:  2, xp:  2300 },
  { name: 'Vouivre',           cr: '6',    ac: 13, hp_dice: 13, hp_sides: 10, hp_bonus:  39, hp_avg: 110, initiative_mod:  2, xp:  2300 },
  // CR 7
  { name: 'Oni',               cr: '7',    ac: 16, hp_dice: 13, hp_sides: 10, hp_bonus:  39, hp_avg: 110, initiative_mod:  2, xp:  2900 },
  { name: 'Géant de pierre',   cr: '7',    ac: 17, hp_dice: 12, hp_sides: 12, hp_bonus:  60, hp_avg: 126, initiative_mod: -1, xp:  2900 },
  // CR 8
  { name: 'Géant des glaces',  cr: '8',    ac: 15, hp_dice: 12, hp_sides: 12, hp_bonus:  60, hp_avg: 138, initiative_mod: -1, xp:  3900 },
  // CR 9
  { name: 'Géant du feu',      cr: '9',    ac: 18, hp_dice: 13, hp_sides: 12, hp_bonus:  78, hp_avg: 162, initiative_mod: -1, xp:  5000 },
  // CR 10
  { name: 'Aboleth',           cr: '10',   ac: 17, hp_dice: 18, hp_sides: 10, hp_bonus:  36, hp_avg: 135, initiative_mod: -1, xp:  5900 },
  // CR 13
  { name: 'Dragon rouge (adulte)', cr: '13', ac: 19, hp_dice: 19, hp_sides: 12, hp_bonus: 133, hp_avg: 256, initiative_mod: 0, xp: 10000 },
  { name: 'Géant des tempêtes',    cr: '13', ac: 16, hp_dice: 20, hp_sides: 12, hp_bonus: 100, hp_avg: 230, initiative_mod: 2, xp: 10000 },
]

export function rollMonsterHp(m: MonsterTemplate): number {
  let total = m.hp_bonus
  for (let i = 0; i < m.hp_dice; i++) {
    total += Math.floor(Math.random() * m.hp_sides) + 1
  }
  return Math.max(1, total)
}

// DMG "Monster Statistics by Challenge Rating"
const CR_ATTACK_BONUS: Record<string, number> = {
  '0': 3, '1/8': 3, '1/4': 3, '1/2': 3,
  '1': 3, '2': 4, '3': 4, '4': 5,
  '5': 6, '6': 6, '7': 6, '8': 7,
  '9': 7, '10': 7, '11': 8, '12': 8,
  '13': 8, '14': 8, '15': 8, '16': 9,
  '17': 9, '18': 9, '19': 10, '20': 10,
}

export function crToAttackBonus(cr: string): number {
  return CR_ATTACK_BONUS[cr] ?? 5
}

// Approximate damage dice per CR based on expected DPR (DMG table)
const CR_DAMAGE: Record<string, [number, number, number]> = {
  '0':   [1,  4,  0], '1/8': [1,  6,  1], '1/4': [1,  8,  2], '1/2': [1,  8,  3],
  '1':   [2,  6,  2], '2':   [2,  8,  3], '3':   [3,  6,  4], '4':   [3,  8,  4],
  '5':   [4,  6,  5], '6':   [4,  8,  5], '7':   [4, 10,  5], '8':   [5, 10,  5],
  '9':   [5, 10,  6], '10':  [6, 10,  6], '11':  [6, 10,  7], '12':  [7, 10,  7],
  '13':  [7, 10,  8], '14':  [8, 10,  8], '15':  [8, 10,  9], '16':  [9, 10,  9],
  '17':  [9, 10, 10], '18': [10, 10, 10], '19': [10, 10, 11], '20': [11, 10, 11],
}

export function crToDamageDice(cr: string): { count: number; sides: number; bonus: number } {
  const d = CR_DAMAGE[cr]
  return d ? { count: d[0], sides: d[1], bonus: d[2] } : { count: 1, sides: 6, bonus: 0 }
}
