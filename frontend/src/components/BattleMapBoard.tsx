import { useEffect, useRef, useState } from 'react'
import type { BattleMap, BattleToken, TokenColor } from '../api/campaigns'
import type { Combatant } from '../api/combatants'
import type { Character } from '../api/characters'

const TOKEN_COLORS: TokenColor[] = ['red', 'amber', 'green', 'blue', 'purple', 'sky']

const DOT: Record<TokenColor, string> = {
  amber: 'bg-amber-500 border-amber-300',
  red: 'bg-red-500 border-red-300',
  blue: 'bg-blue-500 border-blue-300',
  green: 'bg-emerald-500 border-emerald-300',
  purple: 'bg-purple-500 border-purple-300',
  sky: 'bg-sky-500 border-sky-300',
}

const SIZE_PX: Record<BattleToken['size'], number> = { sm: 30, md: 42, lg: 58 }

export const EMPTY_BATTLE_MAP: BattleMap = { image_url: '', grid: null, tokens: [] }

/** Live name + HP for a token that mirrors a combatant/character; null for a free token. */
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
}

export function BattleMapBoard({ map, combatants, characters, editable = false, onChange }: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [work, setWork] = useState<BattleMap>(map ?? EMPTY_BATTLE_MAP)
  const [dragId, setDragId] = useState<string | null>(null)
  const movedRef = useRef(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [urlDraft, setUrlDraft] = useState(map?.image_url ?? '')
  const [adding, setAdding] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Keep in sync with the source of truth (live broadcasts on the player side,
  // refetches on the DM side) — but never stomp a drag in progress.
  useEffect(() => {
    if (dragId) return
    setWork(map ?? EMPTY_BATTLE_MAP)
    setUrlDraft(map?.image_url ?? '')
    setImgError(false)
  }, [map, dragId])

  const commit = (next: BattleMap) => { setWork(next); onChange?.(next) }

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
  }

  function onBoardMove(e: React.PointerEvent) {
    if (!dragId) return
    movedRef.current = true
    const p = pointFromEvent(e)
    setWork(w => ({ ...w, tokens: w.tokens.map(t => t.id === dragId ? { ...t, x: p.x, y: p.y } : t) }))
  }

  function onBoardUp(e: React.PointerEvent) {
    if (!dragId) return
    boardRef.current?.releasePointerCapture(e.pointerId)
    if (movedRef.current) {
      commit(work)               // position changed → persist + broadcast
    } else {
      setSelected(s => s === dragId ? null : dragId)  // a tap selects
    }
    setDragId(null)
  }

  function addToken(partial: Partial<BattleToken> & Pick<BattleToken, 'label'>) {
    const token: BattleToken = {
      id: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ref_type: null, ref_id: null, x: 50, y: 50, color: 'red', size: 'md',
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

  // Combatants/characters not yet placed — the "add" menu only offers new ones.
  const placedRefs = new Set(work.tokens.filter(t => t.ref_id != null).map(t => `${t.ref_type}-${t.ref_id}`))
  const availableCombatants = combatants.filter(c => !placedRefs.has(`combatant-${c.id}`))
  const availableCharacters = characters.filter(c => !placedRefs.has(`character-${c.id}`))

  const selectedToken = editable ? work.tokens.find(t => t.id === selected) ?? null : null

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={e => setUrlDraft(e.target.value)}
            onBlur={() => { if (urlDraft.trim() !== (work.image_url ?? '')) commit({ ...work, image_url: urlDraft.trim() }) }}
            placeholder="URL de l'image de fond (donjon, carte…)"
            className="flex-1 min-w-[200px] bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
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
        </div>
      )}

      <div
        ref={boardRef}
        onPointerMove={onBoardMove}
        onPointerUp={onBoardUp}
        className={`relative w-full overflow-hidden rounded-xl border border-stone-800 bg-stone-900 select-none ${dragId ? 'cursor-grabbing' : ''}`}
        style={{ aspectRatio: '16 / 10' }}
      >
        {/* The board keeps a fixed aspect regardless of the image: a slow or
            broken URL must never collapse it and strand the tokens. */}
        {work.image_url && !imgError && (
          <img
            src={work.image_url}
            alt=""
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        )}
        {(!work.image_url || imgError) && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <p className="text-stone-700 text-sm text-center">
              {imgError ? 'Image introuvable — vérifiez l’URL.' : editable ? 'Collez une URL d’image pour poser le décor.' : 'Aucune carte pour l’instant.'}
            </p>
          </div>
        )}

        {work.tokens.map(t => {
          const live = resolveLive(t, combatants, characters)
          if (live && 'missing' in live && !editable) return null   // hide stale refs from players
          const stale = !!(live && 'missing' in live)
          const name = live && !('missing' in live) ? live.name : t.label
          const px = SIZE_PX[t.size]
          const isSel = editable && selected === t.id
          const bar = live && !('missing' in live) ? hpBar(live.hp, live.maxHp) : null
          const enemy = live && !('missing' in live) ? live.enemy : false
          return (
            <div
              key={t.id}
              onPointerDown={e => onTokenDown(e, t.id)}
              className={`absolute flex flex-col items-center ${editable ? 'cursor-grab touch-none' : 'pointer-events-none'}`}
              style={{ left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%, -50%)' }}
            >
              <div
                className={`rounded-full border-2 flex items-center justify-center font-bold text-white shadow-md ${stale ? 'bg-stone-600 border-stone-400 opacity-60' : DOT[t.color]} ${isSel ? 'ring-2 ring-white ring-offset-1 ring-offset-stone-900' : ''}`}
                style={{ width: px, height: px, fontSize: px * 0.42 }}
                title={name}
              >
                {stale ? '?' : (name[0]?.toUpperCase() ?? '•')}
              </div>
              <span className="mt-0.5 max-w-[80px] truncate text-[10px] font-medium text-stone-200 bg-stone-950/70 rounded px-1 leading-tight">{name}</span>
              {bar && !enemy && (
                <div className="mt-0.5 h-1 w-9 bg-stone-800 rounded-full overflow-hidden">
                  <div className={`h-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

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
              <button key={sz} onClick={() => patchToken(selectedToken.id, { size: sz })} className={`text-xs px-2 py-1 rounded transition-colors ${selectedToken.size === sz ? 'bg-amber-500 text-black font-semibold' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}`}>{sz.toUpperCase()}</button>
            ))}
          </div>
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
