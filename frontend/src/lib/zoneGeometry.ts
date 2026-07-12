import type { BattleZone } from '../api/campaigns'

/** Une case de 1,50 m, comme l'échelle de déplacement du jeu. */
export const METERS_PER_CELL = 1.5

/**
 * Point exprimé en CASES (et non en %).
 *
 * Les coordonnées du plateau sont en pourcentage, mais l'axe X et l'axe Y n'ont pas
 * la même échelle en pixels. Raisonner en % donnerait des « cercles » ovales et des
 * distances fausses. La grille (cols × rows) suit l'aspect du plateau, donc une case
 * est carrée : c'est le seul repère où une distance a un sens.
 */
export interface CellPoint {
  cx: number
  cy: number
}

export interface Grid {
  cols: number
  rows: number
}

export function toCells(xPercent: number, yPercent: number, grid: Grid): CellPoint {
  return {
    cx: (xPercent / 100) * grid.cols,
    cy: (yPercent / 100) * grid.rows,
  }
}

export const metersToCells = (meters: number) => meters / METERS_PER_CELL

/**
 * Demi-angle d'un cône de la 5e.
 *
 * Un cône est aussi large que long à son extrémité : la demi-largeur vaut donc la
 * moitié de la distance, d'où atan(1/2) ≈ 26,57°.
 */
const CONE_HALF_ANGLE = Math.atan(0.5)

/**
 * Un point (en cases) est-il couvert par la zone ?
 *
 * `zone.x/y` sont en % : on les convertit ici pour rester dans le repère « cases ».
 */
export function zoneCovers(zone: BattleZone, point: CellPoint, grid: Grid): boolean {
  const origin = toCells(zone.x, zone.y, grid)
  const dx = point.cx - origin.cx
  const dy = point.cy - origin.cy
  const size = metersToCells(zone.size)

  switch (zone.shape) {
    case 'sphere':
      return Math.hypot(dx, dy) <= size

    case 'cube': {
      // `size` est le CÔTÉ du cube, centré sur le point posé.
      const half = size / 2
      return Math.abs(dx) <= half && Math.abs(dy) <= half
    }

    case 'cone': {
      const distance = Math.hypot(dx, dy)
      if (distance > size || distance === 0) return distance === 0
      const direction = ((zone.angle ?? 0) * Math.PI) / 180
      // Écart angulaire entre la direction du cône et celle du point, ramené à [0, π].
      let delta = Math.atan2(dy, dx) - direction
      delta = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)))
      return delta <= CONE_HALF_ANGLE
    }

    case 'line': {
      const direction = ((zone.angle ?? 0) * Math.PI) / 180
      const ux = Math.cos(direction)
      const uy = Math.sin(direction)
      // Projection le long de la ligne, puis écart perpendiculaire.
      const along = dx * ux + dy * uy
      const across = Math.abs(-dx * uy + dy * ux)
      const halfWidth = metersToCells(zone.width ?? METERS_PER_CELL) / 2
      return along >= 0 && along <= size && across <= halfWidth
    }
  }
}
