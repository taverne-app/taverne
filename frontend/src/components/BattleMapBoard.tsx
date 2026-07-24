import { useEffect, useRef, useState } from 'react'
import type { BattleMap, BattleToken, TokenColor, ActiveRef, BattleZone, ZoneShape } from '../api/campaigns'
import { zoneCovers, toCells, metersToCells, METERS_PER_CELL as M_PER_CELL } from '../lib/zoneGeometry'
import type { Combatant } from '../api/combatants'
import type { Character } from '../api/characters'
import { ImagePicker } from './ImagePicker'

const TOKEN_COLORS: TokenColor[] = ['red', 'amber', 'green', 'blue', 'purple', 'sky']

const DOT: Record<TokenColor, string> = {
  amber: 'bg-amber-500 border-amber-300',
  red: 'bg-red-500 border-red-300',
  blue: 'bg-blue-500 border-blue-300',
  green: 'bg-emerald-500 border-emerald-300',
  purple: 'bg-purple-500 border-purple-300',
  sky: 'bg-sky-500 border-sky-300',
}

// Diamètre des pions (px) au repos, quand il n'y a pas de grille pour donner l'échelle.
const SIZE_PX: Record<BattleToken['size'], number> = { sm: 24, md: 30, lg: 44 }
// Avec une grille, le pion se mesure en cases : Moyen occupe exactement une case (règles 5e
// loge P et M dans une case, G dans quatre). Le 0.92 laisse voir le trait de la grille
// sous le pion, sinon un M posé sur sa case a l'air de déborder.
const SIZE_CELLS: Record<BattleToken['size'], number> = { sm: 0.57, md: 0.85, lg: 1.7 }
const SIZE_LABEL: Record<BattleToken['size'], string> = { sm: 'P', md: 'M', lg: 'G' }

const BOARD_ASPECT = 16 / 10
// Plafond de colonnes = plancher de la taille de case. 60 ne suffisait pas à épouser
// les grilles fines de certaines cartes ; à 160, une case tombe sous les 8 px sur un
// plateau de 1200 px — en dessous, la trame devient un aplat gris et les pions se
// touchent, ce qui rend le plateau inutilisable bien avant d'être une limite technique.
const MAX_COLS = 160
const METERS_PER_CELL = 1.5   // une case de 1,5 m, comme la vitesse en mètres du jeu

export const EMPTY_BATTLE_MAP: BattleMap = { image_url: '', grid: null, tokens: [] }

function resolveLive(t: BattleToken, combatants: Combatant[], characters: Character[]) {
  if (t.ref_type === 'combatant') {
    const c = combatants.find(c => c.id === t.ref_id)
    if (!c) return { missing: true as const }
    return { name: c.name, hp: c.current_hp, maxHp: c.max_hp, enemy: c.faction === 'ennemi' }
  }
  if (t.ref_type === 'character') {
    const c = characters.find(c => c.id === t.ref_id)
    if (!c) return { missing: true as const }
    return { name: c.name, hp: c.combat.current_hp, maxHp: c.combat.max_hp, enemy: false }
  }
  return null
}

function hpBar(hp: number, maxHp: number) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const color = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
  return { pct, color }
}

interface Props {
  map: BattleMap | null
  combatants: Combatant[]
  characters: Character[]
  editable?: boolean
  onChange?: (map: BattleMap) => void
  activeRef?: ActiveRef | null
  /** Appelé au « Lancer » avec les cibles couvertes par le gabarit (ids de lignes). */
  onCastZone?: (rowIds: string[]) => void
  /** Contenu libre posé EN SURIMPRESSION sur l'image du plateau (ex. le titre de la page). */
  overlay?: React.ReactNode
  /**
   * Mode « plateau plein écran » : la surface s'ajuste à la hauteur disponible (au
   * lieu d'occuper toute la largeur en 16/10), la barre d'outils reste en tête. On
   * conserve l'aspect 16/10 pour que les cases de la grille restent carrées.
   */
  fullscreen?: boolean
  /** Contrôles propres à la page, posés à droite de la barre de menus (plein écran). */
  toolbarExtra?: React.ReactNode
  /** Contrôle propre à la page, posé à gauche de « ＋ Pion » (plein écran). */
  toolbarLead?: React.ReactNode
  /**
   * Lieux de la campagne qui ont une carte (map_url) : proposés comme fond de plateau
   * pour « reprendre la carte du lieu du combat » sans re-téléverser l'image. Vide si
   * aucun lieu n'a de carte — le sélecteur disparaît alors.
   */
  locationMaps?: { name: string; map_url: string }[]
  /**
   * Appelé quand le MJ choisit un lieu dans le sélecteur de fond. La page persiste
   * ALORS le lieu ET son image en une seule écriture ; sans ce rappel, seule l'image
   * change (useImage). Distinct de onChange pour que le nom du lieu soit mémorisé.
   */
  onPickLocationMap?: (loc: { name: string; map_url: string }) => void
  /**
   * Clé de persistance de la « caméra » (zoom + cadrage) de ce plateau, PAR APPAREIL :
   * fournie, le zoom et la position de défilement sont mémorisés en localStorage et
   * restaurés au remontage (navigation, rechargement). C'est un confort de visualisation
   * local — jamais diffusé aux autres. Absente → caméra non mémorisée.
   */
  cameraKey?: string | number
}


const ZONE_LABEL: Record<ZoneShape, string> = {
  sphere: '⭕ Sphère', cone: '🔺 Cône', line: '📏 Ligne', cube: '⬛ Cube',
}

const ZONE_FILL: Record<string, string> = {
  red: 'rgba(239,68,68,.30)', amber: 'rgba(245,158,11,.30)', green: 'rgba(16,185,129,.30)',
  blue: 'rgba(59,130,246,.30)', purple: 'rgba(168,85,247,.30)', sky: 'rgba(56,189,248,.30)',
}
const ZONE_STROKE: Record<string, string> = {
  red: '#ef4444', amber: '#f59e0b', green: '#10b981',
  blue: '#3b82f6', purple: '#a855f7', sky: '#38bdf8',
}

/** Dessine un gabarit dans le repère des cases (une case = une unité du viewBox). */
function ZoneShapeSvg({ zone, grid, draft, highlight }: { zone: BattleZone; grid: { cols: number; rows: number }; draft: boolean; highlight?: boolean }) {
  const o = toCells(zone.x, zone.y, grid)
  const size = metersToCells(zone.size)
  const fill = ZONE_FILL[zone.color ?? 'red'] ?? ZONE_FILL.red
  const stroke = ZONE_STROKE[zone.color ?? 'red'] ?? ZONE_STROKE.red
  // L'aperçu est en pointillés : le MJ voit tout de suite ce qui est diffusé ou non.
  const common = {
    fill,
    stroke,
    strokeWidth: highlight ? 0.3 : 0.12,
    strokeDasharray: draft ? '0.4 0.3' : undefined,
    opacity: draft ? 0.85 : 1,
  }
  const rad = ((zone.angle ?? 0) * Math.PI) / 180

  if (zone.shape === 'sphere') {
    return <circle cx={o.cx} cy={o.cy} r={size} {...common} />
  }
  if (zone.shape === 'cube') {
    const half = size / 2
    return <rect x={o.cx - half} y={o.cy - half} width={size} height={size} {...common} />
  }
  if (zone.shape === 'cone') {
    // Cône de la 5e : aussi large que long à son extrémité → demi-angle atan(1/2).
    const half = Math.atan(0.5)
    const p1 = [o.cx + size * Math.cos(rad - half), o.cy + size * Math.sin(rad - half)]
    const p2 = [o.cx + size * Math.cos(rad + half), o.cy + size * Math.sin(rad + half)]
    return <polygon points={`${o.cx},${o.cy} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} {...common} />
  }
  // Ligne : rectangle orienté partant de l'origine.
  const hw = metersToCells(zone.width ?? M_PER_CELL) / 2
  const ux = Math.cos(rad), uy = Math.sin(rad)
  const px = -uy, py = ux // perpendiculaire
  const pts = [
    [o.cx + px * hw, o.cy + py * hw],
    [o.cx + ux * size + px * hw, o.cy + uy * size + py * hw],
    [o.cx + ux * size - px * hw, o.cy + uy * size - py * hw],
    [o.cx - px * hw, o.cy - py * hw],
  ]
  return <polygon points={pts.map(p => `${p[0]},${p[1]}`).join(' ')} {...common} />
}

export function BattleMapBoard({ map, combatants, characters, editable = false, onChange, activeRef = null, onCastZone, overlay, fullscreen = false, toolbarExtra, toolbarLead, locationMaps = [], onPickLocationMap, cameraKey }: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null)
  const [boardW, setBoardW] = useState(0)
  const [work, setWork] = useState<BattleMap>(map ?? EMPTY_BATTLE_MAP)
  const [dragId, setDragId] = useState<string | null>(null)
  const movedRef = useRef(false)
  const dragFromRef = useRef<{ x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [measure, setMeasure] = useState<{ x: number; y: number; cells: number } | null>(null)
  // Préfixe des clés localStorage de la caméra (zoom + cadrage), par appareil.
  const camKey = cameraKey != null ? `taverne:battlecam:${cameraKey}` : null

  // Zoom plein écran (× la taille qui tient dans l'écran) ; au-delà de 1, le plateau
  // déborde et la zone défile (comme un +/− de carte). Les pions se dimensionnent sur
  // la largeur RÉELLE du plateau, donc le glisser-déposer reste juste à tout zoom.
  // Initialisé depuis le zoom mémorisé pour cet appareil, s'il existe.
  const [zoom, setZoom] = useState(() => {
    if (!camKey) return 1
    try {
      const v = parseFloat(localStorage.getItem(`${camKey}:zoom`) ?? '')
      return isFinite(v) && v >= 1 && v <= 4 ? v : 1
    } catch { return 1 }
  })

  /**
   * Gabarit en cours de visée. Il reste LOCAL : tant que le MJ n'a pas cliqué
   * « Lancer », rien n'est écrit dans battle_map, donc rien n'est diffusé — les
   * joueurs ne voient pas la visée hésiter.
   */
  const [zoneDraft, setZoneDraft] = useState<BattleZone | null>(null)
  /** Zone survolée dans la liste — mise en évidence sur le plateau. */
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  /** Menu ouvert dans la barre d'outils épurée du mode plein écran. */
  const [menu, setMenu] = useState<null | 'map' | 'pion' | 'zone'>(null)
  /** Outil ✋ : caler la grille sur celle de l'image de fond. */
  const [gridPan, setGridPan] = useState(false)
  const panRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    if (dragId) return
    setWork(map ?? EMPTY_BATTLE_MAP)
    setImgError(false)
  }, [map, dragId])

  // Plein écran : on mesure la zone disponible pour y inscrire un plateau 16/10 qui
  // remplit la hauteur SANS déborder en largeur — sinon la surface, en `w-full`,
  // dépasserait l'écran en hauteur et le ruban des personnages la masquerait.
  useEffect(() => {
    if (!fullscreen) return
    const el = fitRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0].contentRect
      setFit({ w: r.width, h: r.height })
    })
    ro.observe(el)
    const r = el.getBoundingClientRect()
    setFit({ w: r.width, h: r.height })
    return () => ro.disconnect()
  }, [fullscreen])

  // Largeur rendue du plateau, seule façon de traduire une case de grille en pixels
  // (la grille est définie en nombre de colonnes, pas en px). Mesurée sur l'élément
  // plutôt que calculée : elle vaut `fittedW * zoom` en plein écran, mais 100 % du
  // conteneur hors plein écran, et le responsive la fait bouger sans changer d'état.
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setBoardW(entries[0].contentRect.width))
    ro.observe(el)
    setBoardW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  // Shift + molette = défilement HORIZONTAL (convention des outils graphiques). Listener
  // natif non-passif : c'est la seule façon d'appeler preventDefault sur la molette et
  // d'empêcher le défilement vertical de doubler le geste. Si le navigateur a déjà
  // converti le geste (deltaY=0, deltaX≠0), on le laisse faire.
  useEffect(() => {
    if (!fullscreen) return
    const el = fitRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey || e.deltaY === 0) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [fullscreen])

  // Mémorise le zoom courant pour cet appareil, à chaque changement.
  useEffect(() => {
    if (!camKey) return
    try { localStorage.setItem(`${camKey}:zoom`, String(zoom)) } catch { /* quota/refus : tant pis */ }
  }, [camKey, zoom])

  // Sauvegarde le cadrage en FRACTIONS du défilement possible (0→1), pas en pixels : une
  // fraction survit à un changement de taille d'écran ou de zoom, contrairement à un
  // scrollLeft absolu. Throttlé à une image pour ne pas marteler localStorage.
  const scrollSaveRef = useRef(false)
  const saveScroll = () => {
    if (!camKey || scrollSaveRef.current) return
    scrollSaveRef.current = true
    requestAnimationFrame(() => {
      scrollSaveRef.current = false
      const el = fitRef.current
      if (!el) return
      const mx = el.scrollWidth - el.clientWidth
      const my = el.scrollHeight - el.clientHeight
      try {
        localStorage.setItem(`${camKey}:sx`, mx > 0 ? String(el.scrollLeft / mx) : '0')
        localStorage.setItem(`${camKey}:sy`, my > 0 ? String(el.scrollTop / my) : '0')
      } catch { /* quota/refus : tant pis */ }
    })
  }

  // Largeur d'un plateau 16/10 qui tient dans la zone : bornée par la hauteur.
  const fittedW = fullscreen && fit ? Math.max(0, Math.min(fit.w, fit.h * BOARD_ASPECT)) : 0

  // Restaure le cadrage mémorisé une fois la surface dimensionnée (fittedW connu) et à
  // chaque changement de zoom, pour garder le même centre relatif. En rAF : le DOM doit
  // avoir la nouvelle largeur (fittedW * zoom) avant qu'on puisse fixer le défilement.
  useEffect(() => {
    if (!camKey || !fullscreen || !fittedW) return
    const el = fitRef.current
    if (!el) return
    const raf = requestAnimationFrame(() => {
      const mx = el.scrollWidth - el.clientWidth
      const my = el.scrollHeight - el.clientHeight
      try {
        const fx = parseFloat(localStorage.getItem(`${camKey}:sx`) ?? '')
        const fy = parseFloat(localStorage.getItem(`${camKey}:sy`) ?? '')
        if (isFinite(fx) && mx > 0) el.scrollLeft = fx * mx
        if (isFinite(fy) && my > 0) el.scrollTop = fy * my
      } catch { /* rien à restaurer */ }
    })
    return () => cancelAnimationFrame(raf)
  }, [camKey, fullscreen, fittedW, zoom])

  const grid = work.grid
  const commit = (next: BattleMap) => { setWork(next); onChange?.(next) }

  /** Applique une image (uploadée, choisie en bibliothèque, ou collée) comme fond du plateau. */
  const useImage = (url: string) => {
    setImgError(false)
    commit({ ...work, image_url: url })
  }

  // Décalage de la grille (% du plateau). Absent sur les cartes d'avant l'outil de
  // calage : 0 y restitue exactement l'ancien comportement.
  const gridOff = { x: grid?.offset_x ?? 0, y: grid?.offset_y ?? 0 }

  function snap(x: number, y: number) {
    if (!grid) return { x, y }
    const cellW = 100 / grid.cols, cellH = 100 / grid.rows
    // On raisonne dans le repère de la grille (image décalée), puis on revient dans
    // celui du plateau. Le calage peut pousser des cases hors du plateau, d'où des
    // index qui débordent [0, cols[ : on les borne sur le plateau, pas sur la grille.
    const col = Math.floor((x - gridOff.x) / cellW)
    const row = Math.floor((y - gridOff.y) / cellH)
    return {
      x: Math.max(0, Math.min(100, (col + 0.5) * cellW + gridOff.x)),
      y: Math.max(0, Math.min(100, (row + 0.5) * cellH + gridOff.y)),
      col,
      row,
    }
  }

  function pointFromEvent(e: React.PointerEvent) {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }

  function onTokenDown(e: React.PointerEvent, id: string) {
    if (!editable) return
    e.preventDefault()
    boardRef.current?.setPointerCapture(e.pointerId)
    setDragId(id)
    movedRef.current = false
    const from = work.tokens.find(t => t.id === id)
    dragFromRef.current = from ? { x: from.x, y: from.y } : null   // origin, for the distance readout
  }

  function onBoardMove(e: React.PointerEvent) {
    if (!dragId) return
    movedRef.current = true
    const raw = pointFromEvent(e)
    const snapped = snap(raw.x, raw.y)
    setWork(w => ({ ...w, tokens: w.tokens.map(t => t.id === dragId ? { ...t, x: snapped.x, y: snapped.y } : t) }))
    const origin = dragFromRef.current
    if (grid && origin) {
      const cellW = 100 / grid.cols, cellH = 100 / grid.rows
      const dc = Math.abs(Math.floor(snapped.x / cellW) - Math.floor(origin.x / cellW))
      const dr = Math.abs(Math.floor(snapped.y / cellH) - Math.floor(origin.y / cellH))
      setMeasure({ x: snapped.x, y: snapped.y, cells: Math.max(dc, dr) })
    }
  }

  function onBoardUp(e: React.PointerEvent) {
    if (!dragId) return
    boardRef.current?.releasePointerCapture(e.pointerId)
    if (movedRef.current) commit(work)
    else setSelected(s => s === dragId ? null : dragId)
    setDragId(null)
    setMeasure(null)
    dragFromRef.current = null
  }

  function addToken(partial: Partial<BattleToken> & Pick<BattleToken, 'label'>) {
    const base = snap(50, 50)
    const token: BattleToken = {
      id: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ref_type: null, ref_id: null, x: base.x, y: base.y, color: 'red', size: 'md',
      ...partial,
    }
    commit({ ...work, tokens: [...work.tokens, token] })
    setSelected(token.id)
    setAdding(false)
  }

  function patchToken(id: string, patch: Partial<BattleToken>) {
    commit({ ...work, tokens: work.tokens.map(t => t.id === id ? { ...t, ...patch } : t) })
  }

  function removeToken(id: string) {
    commit({ ...work, tokens: work.tokens.filter(t => t.id !== id) })
    setSelected(null)
  }

  function toggleGrid() {
    if (grid) commit({ ...work, grid: null })
    else commit({ ...work, grid: { cols: 24, rows: Math.round(24 / BOARD_ASPECT) } })
  }

  /**
   * Taille de case, exprimée en nombre de colonnes. Volontairement CONTINUE (au
   * centième) : la grille dessinée sur une image ne tombe presque jamais sur un
   * compte entier de colonnes, et un pas entier condamnait le calage à dériver au
   * bout de la carte. `rows` n'est plus arrondi non plus, sinon les cases cessent
   * d'être carrées et le pion « une case » ne colle plus.
   */
  function setCols(cols: number) {
    const c = Math.max(4, Math.min(MAX_COLS, Math.round(cols * 100) / 100))
    commit({ ...work, grid: { ...grid, cols: c, rows: c / BOARD_ASPECT } })
  }

  /**
   * Glisser de l'outil ✋. Le décalage est accumulé sur la position d'origine du
   * geste (et non delta par delta) : sinon les arrondis du `wrap` s'additionneraient
   * et la grille filerait sous le curseur.
   */
  function onPanDown(e: React.PointerEvent) {
    if (!gridPan || !grid) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    panRef.current = { px: e.clientX, py: e.clientY, ox: gridOff.x, oy: gridOff.y }
  }

  function onPanMove(e: React.PointerEvent) {
    const p = panRef.current
    const rect = boardRef.current?.getBoundingClientRect()
    if (!p || !rect || !grid) return
    setGridOffset(
      p.ox + ((e.clientX - p.px) / rect.width) * 100,
      p.oy + ((e.clientY - p.py) / rect.height) * 100,
    )
  }

  function onPanUp() { panRef.current = null }

  /** Décale la grille pour la faire coïncider avec celle de l'image (outil ✋). */
  function setGridOffset(x: number, y: number) {
    if (!grid) return
    // Un décalage d'une case entière redonne la même grille : on le ramène dans
    // [0, taille de case[ pour que « recentrer » reste atteignable et que la valeur
    // stockée ne parte pas à la dérive à force de glisser.
    const cellW = 100 / grid.cols, cellH = 100 / grid.rows
    const wrap = (v: number, c: number) => ((v % c) + c) % c
    commit({ ...work, grid: { ...grid, offset_x: wrap(x, cellW), offset_y: wrap(y, cellH) } })
  }

  // Outil ✋ : la molette règle la taille des cases. Listener natif non-passif, seule
  // façon d'empêcher la page de défiler sous le geste. Monté seulement pendant le
  // calage, pour ne pas voler la molette au reste du temps.
  useEffect(() => {
    if (!gridPan || !grid) return
    const el = boardRef.current
    if (!el) return
    // Pas PROPORTIONNEL (4 %) et non fixe : le même cran doit valoir un petit
    // ajustement à 20 colonnes et un vrai déplacement à 150, sinon atteindre les
    // grilles fines demanderait des centaines de crans. Les boutons ±, eux, gardent
    // un pas fixe pour le réglage au poil près.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setCols(grid.cols * (e.deltaY > 0 ? 1.04 : 1 / 1.04))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [gridPan, grid?.cols])

  const placedRefs = new Set(work.tokens.filter(t => t.ref_id != null).map(t => `${t.ref_type}-${t.ref_id}`))
  const availableCombatants = combatants.filter(c => !placedRefs.has(`combatant-${c.id}`))
  const availableCharacters = characters.filter(c => !placedRefs.has(`character-${c.id}`))
  const selectedToken = editable ? work.tokens.find(t => t.id === selected) ?? null : null

  const zones = work.zones ?? []

  /** Tailles par défaut, en mètres — les classiques de la 5e. */
  const ZONE_DEFAULTS: Record<ZoneShape, { size: number; width?: number }> = {
    sphere: { size: 6 },              // boule de feu : rayon 6 m
    cone:   { size: 4.5 },            // mains brûlantes : 4,5 m
    line:   { size: 30, width: 1.5 }, // éclair : 30 m x 1,5 m
    cube:   { size: 4.5 },
  }

  function startZone(shape: ZoneShape) {
    setZoneDraft({
      id: `zone-${Date.now()}`,
      shape,
      x: 50, y: 50,
      angle: 0,
      color: 'red',
      ...ZONE_DEFAULTS[shape],
    })
  }

  /** Lignes (personnages/combattants) couvertes par le gabarit. */
  function coveredRowIds(zone: BattleZone): string[] {
    if (!grid) return []
    return work.tokens
      .filter(t => t.ref_type && t.ref_id != null)
      .filter(t => zoneCovers(zone, toCells(t.x, t.y, grid), grid))
      .map(t => `${t.ref_type}-${t.ref_id}`)
  }

  /** Révèle le gabarit aux joueurs ET renvoie les cibles à l'outil Zone. */
  function castZone() {
    if (!zoneDraft) return
    commit({ ...work, zones: [...zones, zoneDraft] })
    onCastZone?.(coveredRowIds(zoneDraft))
    setZoneDraft(null)
  }


  // Contrôles réutilisés à la fois par la barre classique (in-flow) et par les menus
  // épurés du plein écran, pour ne pas dupliquer la logique de grille et de pions.
  const gridToggleBtn = (
    <button
      onClick={toggleGrid}
      className={`text-sm font-medium rounded-lg px-3 py-2 border transition-colors ${grid ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'}`}
    >▦ Grille {grid ? 'activée' : 'désactivée'}</button>
  )
  const gridSizeCtl = grid ? (
    <div className="flex items-center gap-1 text-xs text-stone-400">
      <button
        onClick={() => setGridPan(v => !v)}
        title="Caler la grille sur celle de l’image : glissez la carte pour la déplacer, molette pour la taille des cases"
        className={`h-8 px-2 rounded border transition-colors ${gridPan ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-stone-800 border-stone-700 hover:text-white'}`}
      >✋ Caler</button>
      <button onClick={() => setCols(grid.cols - 0.25)} title="Cases plus grandes (réglage fin)" className="w-6 h-8 bg-stone-800 border border-stone-700 rounded hover:text-white">−</button>
      <span className="w-12 text-center tabular-nums" title={`${grid.cols} colonnes — molette sur la carte pour dégrossir`}>{grid.cols.toFixed(2)}</span>
      <button onClick={() => setCols(grid.cols + 0.25)} title="Cases plus petites (réglage fin)" className="w-6 h-8 bg-stone-800 border border-stone-700 rounded hover:text-white">+</button>
      {gridPan && (gridOff.x !== 0 || gridOff.y !== 0) && (
        <button
          onClick={() => commit({ ...work, grid: { ...grid, offset_x: 0, offset_y: 0 } })}
          title="Remettre la grille au coin de la carte"
          className="h-8 px-2 bg-stone-800 border border-stone-700 rounded hover:text-white"
        >⟲</button>
      )}
    </div>
  ) : null

  // Reprendre la carte d'un lieu de la campagne comme fond de plateau : plus rapide que
  // de re-téléverser l'image du donjon qu'on a déjà renseignée dans la section Monde.
  // La valeur reste toujours vide (c'est une action, pas un état) pour rester utilisable
  // même si l'image actuelle vient déjà d'un lieu.
  const locationMapPicker = locationMaps.length > 0 ? (
    <select
      value=""
      onChange={e => {
        const loc = locationMaps.find(l => l.name === e.target.value)
        if (!loc) return
        // La page mémorise le lieu + son image ; sinon on se contente de l'image.
        if (onPickLocationMap) onPickLocationMap(loc)
        else useImage(loc.map_url)
      }}
      title="Reprendre la carte d’un lieu (section Monde) comme fond de plateau"
      className="text-sm bg-stone-800 border border-stone-700 text-stone-300 rounded-lg px-2 py-2 hover:text-white transition-colors"
    >
      <option value="">📍 Lieu…</option>
      {locationMaps.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
    </select>
  ) : null
  const tokenListItems = (
    <>
      <button onClick={() => addToken({ label: 'Pion', color: 'amber' })} className="w-full text-left text-sm text-stone-300 hover:bg-stone-800 rounded px-2 py-1.5">🎯 Pion libre</button>
      {availableCombatants.length > 0 && <p className="text-stone-600 text-[10px] uppercase tracking-widest px-2 pt-2 pb-1">Combattants</p>}
      {availableCombatants.map(c => (
        <button key={`cb-${c.id}`} onClick={() => addToken({ label: c.name, ref_type: 'combatant', ref_id: c.id, color: c.faction === 'ennemi' ? 'red' : c.faction === 'allié' ? 'green' : 'amber' })} className="w-full text-left text-sm text-stone-300 hover:bg-stone-800 rounded px-2 py-1.5 truncate">{c.faction === 'ennemi' ? '🔴' : c.faction === 'allié' ? '🟢' : '🟡'} {c.name}</button>
      ))}
      {availableCharacters.length > 0 && <p className="text-stone-600 text-[10px] uppercase tracking-widest px-2 pt-2 pb-1">Personnages</p>}
      {availableCharacters.map(c => (
        <button key={`ch-${c.id}`} onClick={() => addToken({ label: c.name, ref_type: 'character', ref_id: c.id, color: 'blue' })} className="w-full text-left text-sm text-stone-300 hover:bg-stone-800 rounded px-2 py-1.5 truncate">🔵 {c.name}</button>
      ))}
    </>
  )
  const menuBtnCls = (active: boolean) =>
    `text-sm font-medium rounded-lg px-3 py-1.5 border transition-colors ${active ? 'bg-stone-700 border-stone-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-300 hover:text-white hover:border-stone-500'}`

  return (
    <div className={fullscreen ? 'flex flex-col h-full min-h-0 gap-2' : 'space-y-3'}>
      {/* Barre classique (in-flow) : URL + upload + grille + pion, tout visible. */}
      {editable && !fullscreen && (
        <ImagePicker
          value={work.image_url ?? ''}
          onChange={useImage}
          placeholder="URL de l'image de fond (donjon, carte…)"
        >
          {locationMapPicker}
          {gridToggleBtn}
          {gridSizeCtl}
          <div className="relative">
            <button
              onClick={() => setAdding(v => !v)}
              className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg px-3 py-2 transition-colors"
            >+ Pion</button>
            {adding && (
              <div className="absolute right-0 mt-1 z-20 w-56 max-h-72 overflow-y-auto bg-stone-900 border border-stone-700 rounded-lg shadow-xl p-1">
                {tokenListItems}
              </div>
            )}
          </div>
        </ImagePicker>
      )}

      {/* Barre épurée (plein écran) : des MENUS, comme les outils de rédaction. */}
      {editable && fullscreen && (
        <div className="order-1 relative shrink-0 flex flex-wrap items-center gap-1 gap-y-1.5">
          <button onClick={() => setMenu(m => m === 'map' ? null : 'map')} className={menuBtnCls(menu === 'map')}>🗺 Map</button>
          {toolbarLead}
          <button onClick={() => setMenu(m => m === 'pion' ? null : 'pion')} className={menuBtnCls(menu === 'pion')}>＋ Pion</button>
          <button onClick={() => setMenu(m => m === 'zone' ? null : 'zone')} className={menuBtnCls(menu === 'zone')}>🔥 Zone</button>

          {toolbarExtra && <div className="ml-auto flex items-center gap-2">{toolbarExtra}</div>}

          {menu && <div className="fixed inset-0 z-20" onClick={() => setMenu(null)} />}

          {menu === 'map' && (
            <div className="absolute left-0 top-full mt-1 z-30 w-[min(92vw,34rem)] max-h-[70vh] overflow-y-auto bg-stone-900 border border-stone-700 rounded-lg shadow-xl p-3">
              <ImagePicker value={work.image_url ?? ''} onChange={useImage} placeholder="URL de l'image de fond (donjon, carte…)">
                {locationMapPicker}
                {gridToggleBtn}
                {gridSizeCtl}
              </ImagePicker>
            </div>
          )}

          {menu === 'pion' && (
            <div className="absolute left-0 top-full mt-1 z-30 w-64 max-h-[70vh] overflow-y-auto bg-stone-900 border border-stone-700 rounded-lg shadow-xl p-1">
              {tokenListItems}
            </div>
          )}

          {menu === 'zone' && (
            <div className="absolute left-0 top-full mt-1 z-30 w-72 bg-stone-900 border border-stone-700 rounded-lg shadow-xl p-2">
              {!grid ? (
                <p className="text-stone-500 text-xs px-1 py-1">Activez la grille (menu Map) : sans elle, aucune échelle en mètres.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['sphere', '⭕ Sphère'],
                    ['cone', '🔺 Cône'],
                    ['line', '📏 Ligne'],
                    ['cube', '⬛ Cube'],
                  ] as [ZoneShape, string][]).map(([shape, label]) => (
                    <button
                      key={shape}
                      onClick={() => { startZone(shape); setMenu(null) }}
                      className={`text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${
                        zoneDraft?.shape === shape
                          ? 'bg-red-700/40 border-red-500 text-red-300'
                          : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-red-600/50 hover:text-red-400'
                      }`}
                    >{label}</button>
                  ))}
                  {zones.length > 1 && (
                    <button onClick={() => commit({ ...work, zones: [] })} className="text-xs text-stone-500 hover:text-stone-300 transition-colors w-full text-left pt-1">Tout effacer</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Zone de la carte : parent de positionnement (pour les boutons de zoom) →
          conteneur de défilement → boîte de centrage → plateau. `min-w/h-full` sur la
          boîte de centrage garde le plateau atteignable au défilement une fois zoomé. */}
      <div className={fullscreen ? 'order-3 flex-1 min-h-0 relative' : 'contents'}>
      <div ref={fitRef} onScroll={fullscreen ? saveScroll : undefined} className={fullscreen ? 'absolute inset-0 overflow-auto' : 'contents'}>
      {/* Centré au repos ; aligné en haut-à-gauche dès qu'on zoome, car le centrage
          flex rendrait le débordement gauche/haut inatteignable au défilement. */}
      <div className={fullscreen ? `min-w-full min-h-full flex ${zoom > 1 ? 'items-start justify-start' : 'items-center justify-center'}` : 'contents'}>
      <div
        ref={boardRef}
        onPointerMove={onBoardMove}
        onPointerUp={onBoardUp}
        onPointerDown={e => {
          // Tant qu'un gabarit est en visée, cliquer le plateau le déplace.
          if (!zoneDraft || !boardRef.current) return
          const r = boardRef.current.getBoundingClientRect()
          setZoneDraft({
            ...zoneDraft,
            x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
            y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
          })
        }}
        className={`relative overflow-hidden select-none shrink-0 ${fullscreen ? '' : 'w-full rounded-xl border border-stone-800 bg-stone-900'} ${dragId ? 'cursor-grabbing' : ''}`}
        style={fullscreen ? { aspectRatio: '16 / 10', width: fittedW ? `${fittedW * zoom}px` : '100%' } : { aspectRatio: '16 / 10' }}
      >
        {work.image_url && !imgError && (
          <img
            src={work.image_url}
            alt=""
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        )}
        {overlay}
        {imgError ? (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <p className="text-stone-700 text-sm text-center">Image introuvable — vérifiez l’URL.</p>
          </div>
        ) : !work.image_url && !grid && work.tokens.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <p className="text-stone-700 text-sm text-center">
              {editable ? 'Collez une URL d’image ou activez la grille pour commencer.' : 'Aucune carte pour l’instant.'}
            </p>
          </div>
        )}

        {/* Grille en PIXELS et non en % : un `background-position` en pourcentage se
            mesure sur (conteneur − motif) et non sur le conteneur, donc il ne sait pas
            décaler une trame répétée. En px, la case est carrée par construction et le
            calage est exact. */}
        {grid && boardW > 0 && (() => {
          const cellPx = boardW / grid.cols
          const boardH = boardW / BOARD_ASPECT
          return (
            <div
              className={`absolute inset-0 ${gridPan ? 'cursor-grab active:cursor-grabbing z-[4]' : 'pointer-events-none'}`}
              onPointerDown={onPanDown}
              onPointerMove={onPanMove}
              onPointerUp={onPanUp}
              onPointerCancel={onPanUp}
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,.14) 0 1px, transparent 1px),' +
                  'linear-gradient(to bottom, rgba(255,255,255,.14) 0 1px, transparent 1px)',
                backgroundSize: `${cellPx}px ${cellPx}px`,
                backgroundPosition: `${(gridOff.x / 100) * boardW}px ${(gridOff.y / 100) * boardH}px`,
              }}
            />
          )
        })()}

        {/* Zones de sort — dessinées dans le repère des CASES : le viewBox suit la
            grille (qui épouse l'aspect du plateau), donc un cercle reste un cercle. */}
        {grid && (zones.length > 0 || zoneDraft) && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${grid.cols} ${grid.rows}`}
            preserveAspectRatio="none"
          >
            {[...zones.map(z => ({ z, draft: false })), ...(zoneDraft ? [{ z: zoneDraft, draft: true }] : [])].map(({ z, draft }) => (
              <ZoneShapeSvg key={z.id} zone={z} grid={grid} draft={draft} highlight={hoveredZone === z.id} />
            ))}
          </svg>
        )}

        {work.tokens.map(t => {
          if (t.hidden && !editable) return null                    // DM-only tokens stay hidden from players
          const live = resolveLive(t, combatants, characters)
          if (live && 'missing' in live && !editable) return null
          const stale = !!(live && 'missing' in live)
          const name = live && !('missing' in live) ? live.name : t.label
          // Avec une grille, le pion se cale sur la case : c'est elle qui porte
          // l'échelle (1,5 m), donc un M vaut une case quel que soit le zoom ou le
          // nombre de colonnes. Sans grille, plus rien ne donne l'échelle : on
          // retombe sur un diamètre fixe, seulement mis à l'échelle du zoom.
          const px = grid && boardW
            ? Math.max(8, Math.round((boardW / grid.cols) * SIZE_CELLS[t.size]))
            : Math.round(SIZE_PX[t.size] * zoom)
          const isSel = editable && selected === t.id
          const isActive = !!(activeRef && t.ref_type === activeRef.kind && t.ref_id === activeRef.id)
          const bar = live && !('missing' in live) ? hpBar(live.hp, live.maxHp) : null
          const enemy = live && !('missing' in live) ? live.enemy : false
          return (
            <div
              key={t.id}
              onPointerDown={e => onTokenDown(e, t.id)}
              className={`absolute flex flex-col items-center ${editable ? 'cursor-grab touch-none' : 'pointer-events-none'} ${t.hidden ? 'opacity-45' : ''}`}
              style={{ left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%, -50%)', zIndex: isActive ? 3 : 2 }}
            >
              <div
                className={`rounded-full border-2 flex items-center justify-center font-bold text-white shadow-md ${stale ? 'bg-stone-600 border-stone-400 opacity-60' : DOT[t.color]} ${isActive ? 'ring-4 ring-amber-400/80 animate-pulse' : isSel ? 'ring-2 ring-white ring-offset-1 ring-offset-stone-900' : ''}`}
                style={{ width: px, height: px, fontSize: Math.max(10, px * 0.42) }}
                title={t.hidden ? `${name} (caché)` : name}
              >
                {stale ? '?' : (name[0]?.toUpperCase() ?? '•')}
              </div>
              <span className="mt-0.5 max-w-[90px] truncate text-[10px] font-medium text-stone-200 bg-stone-950/70 rounded px-1 leading-tight">
                {t.hidden && '🕶 '}{name}
              </span>
              {bar && !enemy && (
                <div className="mt-0.5 h-1 rounded-full overflow-hidden bg-stone-800" style={{ width: Math.max(24, px * 0.8) }}>
                  <div className={`h-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                </div>
              )}
            </div>
          )
        })}

        {measure && measure.cells > 0 && (
          <div
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-full -mt-6 bg-amber-500 text-black text-xs font-bold rounded px-1.5 py-0.5 shadow"
            style={{ left: `${measure.x}%`, top: `${measure.y}%` }}
          >
            {measure.cells} {measure.cells > 1 ? 'cases' : 'case'} · {(measure.cells * METERS_PER_CELL).toLocaleString('fr-FR')} m
          </div>
        )}
      </div>
      </div>
      </div>
        {/* Boutons de zoom (comme une carte en ligne). Hors du conteneur qui défile,
            donc toujours visibles. */}
        {fullscreen && (
          <div className="absolute top-3 right-3 z-[5] flex flex-col rounded-lg overflow-hidden border border-stone-700 shadow-lg bg-stone-900/90 backdrop-blur">
            <button
              onClick={() => setZoom(z => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
              title="Zoom avant"
              className="w-9 h-9 flex items-center justify-center text-stone-200 hover:bg-stone-700 text-xl leading-none transition-colors"
            >+</button>
            <div className="h-px bg-stone-700" />
            <button
              onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
              title="Zoom arrière"
              className="w-9 h-9 flex items-center justify-center text-stone-200 hover:bg-stone-700 text-xl leading-none transition-colors disabled:opacity-40"
              disabled={zoom <= 1}
            >−</button>
            {zoom > 1 && (
              <>
                <div className="h-px bg-stone-700" />
                <button
                  onClick={() => setZoom(1)}
                  title="Réinitialiser le zoom"
                  className="w-9 h-8 flex items-center justify-center text-stone-400 hover:bg-stone-700 text-[10px] font-semibold transition-colors"
                >{Math.round(zoom * 100)}%</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Gabarits de sorts — nécessitent la grille : c'est elle qui donne l'échelle en mètres. */}
      {editable && (
        <div className="order-4 space-y-2">
          {/* En plein écran, les formes vivent dans le menu « Zone » ; ici on ne garde
              que les pastilles et le panneau de visée (retour visuel de l'action). */}
          {!fullscreen && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-stone-600 text-[10px] uppercase tracking-widest pr-1">Zone de sort</span>
            {!grid ? (
              <span className="text-stone-600 text-xs">Activez la grille : sans elle, aucune échelle en mètres.</span>
            ) : (
              <>
                {([
                  ['sphere', '⭕ Sphère'],
                  ['cone', '🔺 Cône'],
                  ['line', '📏 Ligne'],
                  ['cube', '⬛ Cube'],
                ] as [ZoneShape, string][]).map(([shape, label]) => (
                  <button
                    key={shape}
                    onClick={() => startZone(shape)}
                    className={`text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${
                      zoneDraft?.shape === shape
                        ? 'bg-red-700/40 border-red-500 text-red-300'
                        : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-red-600/50 hover:text-red-400'
                    }`}
                  >{label}</button>
                ))}
                {zones.length > 1 && (
                  <button
                    onClick={() => commit({ ...work, zones: [] })}
                    className="text-xs text-stone-500 hover:text-stone-300 transition-colors ml-auto"
                  >Tout effacer</button>
                )}
              </>
            )}
          </div>
          )}

          {/* Une pastille par zone posée : cliquer sur le plateau serait ambigu dès que
              deux zones se chevauchent. Le survol met la zone en évidence. */}
          {zones.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {zones.map(z => (
                <span
                  key={z.id}
                  onMouseEnter={() => setHoveredZone(z.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  className={`flex items-center gap-1 text-xs rounded-lg border px-2 py-0.5 transition-colors ${
                    hoveredZone === z.id
                      ? 'bg-red-700/40 border-red-500 text-red-200'
                      : 'bg-stone-800 border-stone-700 text-stone-400'
                  }`}
                >
                  {ZONE_LABEL[z.shape]} {z.size.toLocaleString('fr-FR')} m
                  <button
                    onClick={() => commit({ ...work, zones: zones.filter(x => x.id !== z.id) })}
                    title="Effacer cette zone"
                    className="text-stone-500 hover:text-red-300 transition-colors ml-0.5"
                  >×</button>
                </span>
              ))}
            </div>
          )}

          {zoneDraft && grid && (
            <div className="bg-red-950/20 border border-red-800/40 rounded-lg px-3 py-2 flex items-center gap-3 flex-wrap">
              <span className="text-red-400 text-xs font-semibold shrink-0">
                Cliquez le plateau pour viser
              </span>
              <label className="flex items-center gap-1.5 text-xs text-stone-400">
                {zoneDraft.shape === 'sphere' ? 'Rayon' : zoneDraft.shape === 'cube' ? 'Côté' : 'Longueur'}
                <input
                  type="number" min={1.5} step={1.5} value={zoneDraft.size}
                  onChange={e => setZoneDraft({ ...zoneDraft, size: Math.max(1.5, parseFloat(e.target.value) || 1.5) })}
                  className="w-16 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                /> m
              </label>
              {zoneDraft.shape === 'line' && (
                <label className="flex items-center gap-1.5 text-xs text-stone-400">
                  Largeur
                  <input
                    type="number" min={1.5} step={1.5} value={zoneDraft.width ?? 1.5}
                    onChange={e => setZoneDraft({ ...zoneDraft, width: Math.max(1.5, parseFloat(e.target.value) || 1.5) })}
                    className="w-16 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  /> m
                </label>
              )}
              {(zoneDraft.shape === 'cone' || zoneDraft.shape === 'line') && (
                <label className="flex items-center gap-1.5 text-xs text-stone-400">
                  Orientation
                  <input
                    type="range" min={0} max={359} value={zoneDraft.angle ?? 0}
                    onChange={e => setZoneDraft({ ...zoneDraft, angle: parseInt(e.target.value, 10) })}
                    className="w-28 accent-red-500"
                  />
                  <span className="tabular-nums w-9 text-right">{zoneDraft.angle ?? 0}°</span>
                </label>
              )}
              <span className="text-stone-500 text-xs">
                {coveredRowIds(zoneDraft).length} cible{coveredRowIds(zoneDraft).length > 1 ? 's' : ''}
              </span>
              <button
                onClick={castZone}
                className="bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded-lg px-3 py-1 transition-colors ml-auto"
                title="Révèle la zone aux joueurs et sélectionne les cibles dans l'outil Zone"
              >🔥 Lancer</button>
              <button onClick={() => setZoneDraft(null)} className="text-stone-500 hover:text-stone-300 text-xs">Annuler</button>
            </div>
          )}
        </div>
      )}

      {editable && selectedToken && (
        <div className="order-2 shrink-0 flex flex-wrap items-center gap-3 bg-stone-800/60 border border-stone-700 rounded-lg px-3 py-2">
          <span className="text-stone-300 text-sm font-medium truncate max-w-[140px]">{selectedToken.label}</span>
          <div className="flex items-center gap-1">
            {TOKEN_COLORS.map(col => (
              <button key={col} onClick={() => patchToken(selectedToken.id, { color: col })} className={`w-5 h-5 rounded-full border-2 ${DOT[col]} ${selectedToken.color === col ? 'ring-2 ring-white' : ''}`} title={col} />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {(['sm', 'md', 'lg'] as const).map(sz => (
              <button key={sz} onClick={() => patchToken(selectedToken.id, { size: sz })} className={`text-xs w-7 py-1 rounded transition-colors ${selectedToken.size === sz ? 'bg-amber-500 text-black font-semibold' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}`} title={sz === 'sm' ? 'Petit' : sz === 'md' ? 'Moyen' : 'Grand'}>{SIZE_LABEL[sz]}</button>
            ))}
          </div>
          <button
            onClick={() => patchToken(selectedToken.id, { hidden: !selectedToken.hidden })}
            className={`text-xs px-2 py-1 rounded border transition-colors ${selectedToken.hidden ? 'bg-violet-500/20 border-violet-500/50 text-violet-300' : 'bg-stone-700 border-stone-600 text-stone-300 hover:text-white'}`}
            title="Cacher aux joueurs"
          >{selectedToken.hidden ? '🕶 Caché' : '👁 Visible'}</button>
          {selectedToken.ref_type === null && (
            <input
              value={selectedToken.label}
              onChange={e => patchToken(selectedToken.id, { label: e.target.value })}
              className="bg-stone-900 border border-stone-700 rounded px-2 py-1 text-stone-200 text-xs w-28 focus:outline-none focus:border-amber-500"
              placeholder="Nom du pion"
            />
          )}
          <button onClick={() => removeToken(selectedToken.id)} className="ml-auto text-red-400 hover:text-red-300 text-xs font-semibold transition-colors">Retirer</button>
        </div>
      )}
    </div>
  )
}
