/**
 * Tout ce qui compte en pièces d'or, au même endroit.
 *
 * La valeur d'un objet — coffre du groupe comme inventaire d'un personnage — est un
 * nombre de po, ou `null` quand l'objet n'a pas de prix. Avant, c'était un texte libre
 * (« 500 po », « inestimable ») : rien n'était additionnable.
 */

/** Taux de change D&D 5e vers la pièce d'or. */
export const COIN_RATES = { pp: 10, po: 1, pe: 0.5, pa: 0.1, pc: 0.01 } as const

export interface Coins {
  pp: number
  po: number
  pe: number
  pa: number
  pc: number
}

/** Une bourse, convertie en po. */
export function coinsToGold(c: Coins): number {
  return c.pp * COIN_RATES.pp + c.po * COIN_RATES.po + c.pe * COIN_RATES.pe
    + c.pa * COIN_RATES.pa + c.pc * COIN_RATES.pc
}

/** Un objet valorisé, quel que soit l'endroit où il se trouve. */
export interface Valued {
  quantity: number
  value_gp: number | null
}

/** Valeur totale d'une ligne : la valeur unitaire × la quantité. Sans prix, zéro. */
export function lineGold(item: Valued): number {
  return (item.value_gp ?? 0) * item.quantity
}

/** Valeur totale d'une liste d'objets. */
export function itemsGold(items: Valued[]): number {
  return items.reduce((sum, i) => sum + lineGold(i), 0)
}

/** « 1 500 po ». Chaîne vide si l'objet n'a pas de valeur chiffrée. */
export function formatGold(gp: number | null): string {
  return gp == null ? '' : `${formatGoldNumber(gp)} po`
}

/** Le nombre seul, formaté à la française. */
export function formatGoldNumber(gp: number): string {
  return gp.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}
