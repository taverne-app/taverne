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

// Off-grid: fixed pixels. On-grid: a fraction of a cell (Moyen ≈ 1 case, Grand ≈ 2).
const SIZE_PX: Record<BattleToken['size'], number> = { sm: 30, md: 42, lg: 58 }
const SIZE_CELLS: Record<BattleToken['size'], number> = { sm: 0.7, md: 0.95, lg: 1.9 }
const SIZE_LABEL: Record<BattleToken['size'], string> = { sm: 'P', md: 'M', lg: 'G' }

const BOARD_ASPECT = 16 / 10
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

export function BattleMapBoard({ map, combatants, characters, editable = false, onChange, activeRef = null, onCastZone }: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [work, setWork] = useState<BattleMap>(map ?? EMPTY_BATTLE_MAP)
  const [dragId, setDragId] = useState<string | null>(null)
  const movedRef = useRef(false)
  const dragFromRef = useRef<{ x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [boardW, setBoardW] = useState(0)
  const [measure, setMeasure] = useState<{ x: number; y: number; cells: number } | null>(null)

  /**
   * Gabarit en cours de visée. Il reste LOCAL : tant que le MJ n'a pas cliqué
   * « Lancer », rien n'est écrit dans battle_map, donc rien n'est diffusé — les
   * joueurs ne voient pas la visée hésiter.
   */
  const [zoneDraft, setZoneDraft] = useState<BattleZone | null>(null)
  /** Zone survolée dans la liste — mise en évidence sur le plateau. */
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)

  useEffect(() => {
    if (dragId) return
    setWork(map ?? EMPTY_BATTLE_MAP)
    setImgError(false)
  }, [map, dragId])

  // Board pixel width — needed to size tokens proportionally to grid cells.
  useEffect(() => {
    const el = boardRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setBoardW(entries[0].contentRect.width))
    ro.observe(el)
    setBoardW(el.getBoundingClientRect().width)
    return () => ro.disconnect()
  }, [])

  const grid = work.grid
  const commit = (next: BattleMap) => { setWork(next); onChange?.(next) }

  /** Applique une image (uploadée, choisie en bibliothèque, ou collée) comme fond du plateau. */
  const useImage = (url: string) => {
    setImgError(false)
    commit({ ...work, image_url: url })
  }

  function snap(x: number, y: number) {
    if (!grid) return { x, y }
    const cellW = 100 / grid.cols, cellH = 100 / grid.rows
    const col = Math.max(0, Math.min(grid.cols - 1, Math.floor(x / cellW)))
    const row = Math.max(0, Math.min(grid.rows - 1, Math.floor(y / cellH)))
    return { x: (col + 0.5) * cellW, y: (row + 0.5) * cellH, col, row }
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

  function setCols(cols: number) {
    const c = Math.max(4, Math.min(60, cols))
    commit({ ...work, grid: { cols: c, rows: Math.max(1, Math.round(c / BOARD_ASPECT)) } })
  }

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

  const cellPx = grid && boardW ? boardW / grid.cols : 0

  return (
    <div className="space-y-3">
      {editable && (
        <ImagePicker
          value={work.image_url ?? ''}
          onChange={useImage}
          placeholder="URL de l'image de fond (donjon, carte…)"
        >
          <button
            onClick={toggleGrid}
            className={`text-sm font-medium rounded-lg px-3 py-2 border transition-colors ${grid ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'}`}
          >▦ Grille</button>
          {grid && (
            <div className="flex items-center gap-1 text-xs text-stone-400">
              <button onClick={() => setCols(grid.cols - 2)} className="w-6 h-8 bg-stone-800 border border-stone-700 rounded hover:text-white">−</button>
              <span className="w-14 text-center tabular-nums">{grid.cols}×{grid.rows}</span>
              <button onClick={() => setCols(grid.cols + 2)} className="w-6 h-8 bg-stone-800 border border-stone-700 rounded hover:text-white">+</button>
            </div>
          )}
          <div className="relative">
            <button
              onClick={() => setAdding(v => !v)}
              className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-lg px-3 py-2 transition-colors"
            >+ Pion</button>
            {adding && (
              <div className="absolute right-0 mt-1 z-20 w-56 max-h-72 overflow-y-auto bg-stone-900 border border-stone-700 rounded-lg shadow-xl p-1">
                <button onClick={() => addToken({ label: 'Pion', color: 'amber' })} className="w-full text-left text-sm text-stone-300 hover:bg-stone-800 rounded px-2 py-1.5">🎯 Pion libre</button>
                {availableCombatants.length > 0 && <p className="text-stone-600 text-[10px] uppercase tracking-widest px-2 pt-2 pb-1">Combattants</p>}
                {availableCombatants.map(c => (
                  <button key={`cb-${c.id}`} onClick={() => addToken({ label: c.name, ref_type: 'combatant', ref_id: c.id, color: c.faction === 'ennemi' ? 'red' : c.faction === 'allié' ? 'green' : 'amber' })} className="w-full text-left text-sm text-stone-300 hover:bg-stone-800 rounded px-2 py-1.5 truncate">{c.faction === 'ennemi' ? '🔴' : c.faction === 'allié' ? '🟢' : '🟡'} {c.name}</button>
                ))}
                {availableCharacters.length > 0 && <p className="text-stone-600 text-[10px] uppercase tracking-widest px-2 pt-2 pb-1">Personnages</p>}
                {availableCharacters.map(c => (
                  <button key={`ch-${c.id}`} onClick={() => addToken({ label: c.name, ref_type: 'character', ref_id: c.id, color: 'blue' })} className="w-full text-left text-sm text-stone-300 hover:bg-stone-800 rounded px-2 py-1.5 truncate">🔵 {c.name}</button>
                ))}
              </div>
            )}
          </div>
        </ImagePicker>
      )}

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
        className={`relative w-full overflow-hidden rounded-xl border border-stone-800 bg-stone-900 select-none ${dragId ? 'cursor-grabbing' : ''}`}
        style={{ aspectRatio: '16 / 10' }}
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

        {grid && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                `repeating-linear-gradient(to right, rgba(255,255,255,.14) 0 1px, transparent 1px ${100 / grid.cols}%),` +
                `repeating-linear-gradient(to bottom, rgba(255,255,255,.14) 0 1px, transparent 1px ${100 / grid.rows}%)`,
            }}
          />
        )}

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
          const px = cellPx ? Math.round(SIZE_CELLS[t.size] * cellPx) : SIZE_PX[t.size]
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

      {/* Gabarits de sorts — nécessitent la grille : c'est elle qui donne l'échelle en mètres. */}
      {editable && (
        <div className="space-y-2">
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
        <div className="flex flex-wrap items-center gap-3 bg-stone-800/60 border border-stone-700 rounded-lg px-3 py-2">
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
