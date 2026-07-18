/**
 * Lecture d'une notation de dégâts (« 2d6+1 ») vers un jet lançable.
 *
 * Les bornes ci-dessous ne sont pas décoratives : elles recopient la validation de
 * ShareController::rollDice. Proposer un dé qu'elle refuse donnerait un bouton qui
 * répond 422 — autant ne pas le proposer.
 */

/** Faces acceptées par l'API. Un d3 ou un d7 seraient rejetés côté serveur. */
const ALLOWED_SIDES = [4, 6, 8, 10, 12, 20, 100]

export interface DamageRoll {
  count: number
  sides: number
  modifier: number
}

/**
 * « 2d6+1 », « 1d8 + 3 », « d4 » → de quoi lancer. `null` si ce n'est pas lisible.
 *
 * On renvoie `null` plutôt que de deviner : l'appelant doit alors afficher les dés
 * sans bouton. Un bouton qui ne fait rien au clic est pire qu'une étiquette qui
 * n'invite pas à cliquer. Les formes composées (« 1d6+1d4 ») tombent ici — elles
 * restent lisibles à l'écran, à lancer à la main.
 */
export function parseDamageDice(dice: string | null | undefined): DamageRoll | null {
  if (!dice) return null

  const m = dice.replace(/\s+/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i)
  if (!m) return null

  const count = m[1] ? parseInt(m[1], 10) : 1
  const sides = parseInt(m[2], 10)
  const modifier = m[3] ? parseInt(m[3], 10) : 0

  if (!ALLOWED_SIDES.includes(sides)) return null
  if (count < 1 || count > 20) return null
  if (modifier < -20 || modifier > 30) return null

  return { count, sides, modifier }
}
