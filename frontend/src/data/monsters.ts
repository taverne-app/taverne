export interface MonsterTemplate {
  name: string
  cr: string
  ac: number
  hp_dice: number
  hp_sides: number
  hp_bonus: number
  hp_avg: number
  initiative_mod: number
}

export const MONSTERS: MonsterTemplate[] = [
  // CR 0
  { name: 'Roturier',          cr: '0',    ac: 10, hp_dice:  1, hp_sides:  8, hp_bonus:   0, hp_avg:  4,  initiative_mod:  0 },
  { name: 'Rat',               cr: '0',    ac: 10, hp_dice:  1, hp_sides:  4, hp_bonus:  -1, hp_avg:  1,  initiative_mod:  2 },
  // CR 1/8
  { name: 'Bandit',            cr: '1/8',  ac: 12, hp_dice:  2, hp_sides:  8, hp_bonus:   2, hp_avg: 11,  initiative_mod:  1 },
  { name: 'Cultiste',          cr: '1/8',  ac: 12, hp_dice:  2, hp_sides:  8, hp_bonus:   0, hp_avg:  9,  initiative_mod:  1 },
  { name: 'Garde',             cr: '1/8',  ac: 16, hp_dice:  2, hp_sides:  8, hp_bonus:   2, hp_avg: 11,  initiative_mod:  1 },
  { name: 'Kobold',            cr: '1/8',  ac: 12, hp_dice:  2, hp_sides:  6, hp_bonus:  -2, hp_avg:  5,  initiative_mod:  2 },
  // CR 1/4
  { name: 'Gobelin',           cr: '1/4',  ac: 15, hp_dice:  2, hp_sides:  6, hp_bonus:   0, hp_avg:  7,  initiative_mod:  2 },
  { name: 'Squelette',         cr: '1/4',  ac: 13, hp_dice:  2, hp_sides:  8, hp_bonus:   4, hp_avg: 13,  initiative_mod:  2 },
  { name: 'Loup',              cr: '1/4',  ac: 13, hp_dice:  2, hp_sides:  8, hp_bonus:   2, hp_avg: 11,  initiative_mod:  2 },
  { name: 'Zombie',            cr: '1/4',  ac:  8, hp_dice:  3, hp_sides:  8, hp_bonus:   9, hp_avg: 22,  initiative_mod: -2 },
  { name: 'Kobold ailé',       cr: '1/4',  ac: 13, hp_dice:  2, hp_sides:  6, hp_bonus:   0, hp_avg:  7,  initiative_mod:  2 },
  // CR 1/2
  { name: 'Gnoll',             cr: '1/2',  ac: 15, hp_dice:  5, hp_sides:  8, hp_bonus:   0, hp_avg: 22,  initiative_mod:  1 },
  { name: 'Hobgobelin',        cr: '1/2',  ac: 18, hp_dice:  2, hp_sides:  8, hp_bonus:   2, hp_avg: 11,  initiative_mod:  1 },
  { name: 'Orc',               cr: '1/2',  ac: 13, hp_dice:  2, hp_sides:  8, hp_bonus:   6, hp_avg: 15,  initiative_mod:  1 },
  { name: 'Eclaireur',         cr: '1/2',  ac: 13, hp_dice:  3, hp_sides:  8, hp_bonus:   3, hp_avg: 16,  initiative_mod:  3 },
  { name: 'Ombre',             cr: '1/2',  ac: 12, hp_dice:  3, hp_sides:  8, hp_bonus:   3, hp_avg: 16,  initiative_mod:  2 },
  { name: 'Brute',             cr: '1/2',  ac: 11, hp_dice:  5, hp_sides:  8, hp_bonus:  10, hp_avg: 32,  initiative_mod:  0 },
  // CR 1
  { name: 'Bugbear',           cr: '1',    ac: 16, hp_dice:  5, hp_sides:  8, hp_bonus:   5, hp_avg: 27,  initiative_mod:  2 },
  { name: 'Loup géant',        cr: '1',    ac: 14, hp_dice:  5, hp_sides: 10, hp_bonus:  10, hp_avg: 37,  initiative_mod:  2 },
  { name: 'Goule',             cr: '1',    ac: 12, hp_dice:  5, hp_sides:  8, hp_bonus:   0, hp_avg: 22,  initiative_mod:  2 },
  { name: 'Harpie',            cr: '1',    ac: 11, hp_dice:  7, hp_sides:  8, hp_bonus:   7, hp_avg: 38,  initiative_mod:  1 },
  { name: 'Araignée géante',   cr: '1',    ac: 14, hp_dice:  4, hp_sides: 10, hp_bonus:   4, hp_avg: 26,  initiative_mod:  3 },
  { name: 'Spectre',           cr: '1',    ac: 12, hp_dice:  5, hp_sides:  8, hp_bonus:   0, hp_avg: 22,  initiative_mod:  2 },
  // CR 2
  { name: 'Berserker',         cr: '2',    ac: 13, hp_dice:  9, hp_sides:  8, hp_bonus:  27, hp_avg: 67,  initiative_mod:  1 },
  { name: 'Ettercap',          cr: '2',    ac: 13, hp_dice:  8, hp_sides:  8, hp_bonus:   8, hp_avg: 44,  initiative_mod:  2 },
  { name: 'Gargouille',        cr: '2',    ac: 15, hp_dice:  7, hp_sides:  8, hp_bonus:  21, hp_avg: 52,  initiative_mod:  0 },
  { name: 'Ghast',             cr: '2',    ac: 13, hp_dice:  8, hp_sides:  8, hp_bonus:   0, hp_avg: 36,  initiative_mod:  3 },
  { name: 'Ogre',              cr: '2',    ac: 11, hp_dice:  7, hp_sides: 10, hp_bonus:  21, hp_avg: 59,  initiative_mod: -1 },
  { name: 'Prêtre',            cr: '2',    ac: 13, hp_dice:  5, hp_sides:  8, hp_bonus:   5, hp_avg: 27,  initiative_mod:  0 },
  { name: 'Nuée de rats',      cr: '2',    ac: 10, hp_dice:  7, hp_sides:  8, hp_bonus:  -7, hp_avg: 24,  initiative_mod:  2 },
  // CR 3
  { name: 'Doppelganger',      cr: '3',    ac: 14, hp_dice:  8, hp_sides:  8, hp_bonus:  16, hp_avg: 52,  initiative_mod:  3 },
  { name: 'Sorcière verte',    cr: '3',    ac: 17, hp_dice: 11, hp_sides:  8, hp_bonus:  33, hp_avg: 82,  initiative_mod:  1 },
  { name: 'Chevalier',         cr: '3',    ac: 18, hp_dice:  8, hp_sides:  8, hp_bonus:  16, hp_avg: 52,  initiative_mod:  0 },
  { name: 'Manticore',         cr: '3',    ac: 14, hp_dice:  8, hp_sides: 10, hp_bonus:  24, hp_avg: 68,  initiative_mod:  0 },
  { name: 'Minotaure',         cr: '3',    ac: 14, hp_dice:  9, hp_sides: 10, hp_bonus:  27, hp_avg: 76,  initiative_mod:  0 },
  { name: 'Rejeton de vampire', cr: '3',   ac: 15, hp_dice: 11, hp_sides:  8, hp_bonus:  33, hp_avg: 82,  initiative_mod:  3 },
  { name: 'Revenant',          cr: '3',    ac: 14, hp_dice:  6, hp_sides:  8, hp_bonus:  18, hp_avg: 45,  initiative_mod:  1 },
  { name: 'Loup-garou',        cr: '3',    ac: 12, hp_dice:  9, hp_sides:  8, hp_bonus:  18, hp_avg: 58,  initiative_mod:  1 },
  // CR 4
  { name: 'Banshee',           cr: '4',    ac: 12, hp_dice: 13, hp_sides:  8, hp_bonus:   0, hp_avg: 58,  initiative_mod:  2 },
  { name: 'Ettin',             cr: '4',    ac: 12, hp_dice: 10, hp_sides: 10, hp_bonus:  30, hp_avg: 85,  initiative_mod: -1 },
  { name: 'Fantôme',           cr: '4',    ac: 11, hp_dice: 10, hp_sides:  8, hp_bonus:   0, hp_avg: 45,  initiative_mod:  3 },
  { name: 'Sanglier-garou',    cr: '4',    ac: 10, hp_dice: 12, hp_sides:  8, hp_bonus:  24, hp_avg: 78,  initiative_mod:  0 },
  // CR 5
  { name: 'Troll',             cr: '5',    ac: 15, hp_dice:  8, hp_sides: 10, hp_bonus:  40, hp_avg: 84,  initiative_mod:  1 },
  { name: 'Licorne',           cr: '5',    ac: 12, hp_dice:  9, hp_sides: 10, hp_bonus:  18, hp_avg: 67,  initiative_mod:  3 },
  { name: 'Vampire',           cr: '5',    ac: 16, hp_dice: 17, hp_sides:  8, hp_bonus:  68, hp_avg: 144, initiative_mod:  4 },
  // CR 6
  { name: 'Méduse',            cr: '6',    ac: 15, hp_dice: 17, hp_sides:  8, hp_bonus:  51, hp_avg: 127, initiative_mod:  2 },
  { name: 'Vouivre',           cr: '6',    ac: 13, hp_dice: 13, hp_sides: 10, hp_bonus:  39, hp_avg: 110, initiative_mod:  2 },
  // CR 7
  { name: 'Oni',               cr: '7',    ac: 16, hp_dice: 13, hp_sides: 10, hp_bonus:  39, hp_avg: 110, initiative_mod:  2 },
  { name: 'Géant de pierre',   cr: '7',    ac: 17, hp_dice: 12, hp_sides: 12, hp_bonus:  60, hp_avg: 126, initiative_mod: -1 },
  // CR 8
  { name: 'Géant des glaces',  cr: '8',    ac: 15, hp_dice: 12, hp_sides: 12, hp_bonus:  60, hp_avg: 138, initiative_mod: -1 },
  // CR 9
  { name: 'Géant du feu',      cr: '9',    ac: 18, hp_dice: 13, hp_sides: 12, hp_bonus:  78, hp_avg: 162, initiative_mod: -1 },
  // CR 10
  { name: 'Aboleth',           cr: '10',   ac: 17, hp_dice: 18, hp_sides: 10, hp_bonus:  36, hp_avg: 135, initiative_mod: -1 },
  // CR 13
  { name: 'Dragon rouge (adulte)', cr: '13', ac: 19, hp_dice: 19, hp_sides: 12, hp_bonus: 133, hp_avg: 256, initiative_mod: 0 },
  { name: 'Géant des tempêtes',    cr: '13', ac: 16, hp_dice: 20, hp_sides: 12, hp_bonus: 100, hp_avg: 230, initiative_mod: 2 },
]

export function rollMonsterHp(m: MonsterTemplate): number {
  let total = m.hp_bonus
  for (let i = 0; i < m.hp_dice; i++) {
    total += Math.floor(Math.random() * m.hp_sides) + 1
  }
  return Math.max(1, total)
}
