import { useEffect, useMemo, useRef, useState } from 'react'
import { useTabNotify } from '../hooks/useTabNotify'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { scaleCantripDamage } from '../data/spells'
import { setInitiativeRoll, updateInspiration, updateConditions, updateIdentity, updateDeathSaves, useSpellSlot, updateHp, updateConcentration, shortRest, longRest, type Character, type DiceRoll, type AttackMacro, type Spell } from '../api/characters'
import { getCampaign, updateCampaign, broadcastCombatTurn, type Campaign, type SavedEncounter, type CustomMonster, type MonsterAttack, type BattleMap } from '../api/campaigns'
import { BattleMapBoard } from '../components/BattleMapBoard'
import {
  listCombatants,
  createCombatant,
  updateCombatantHp,
  updateCombatantInitiative,
  updateCombatantConditions,
  updateCombatantFaction,
  updateCombatantName,
  deleteCombatant,
  restoreCombatant,
  purgeTrashedCombatants,
  type Combatant,
  type CombatantFaction,
} from '../api/combatants'
import { createChapter } from '../api/chapters'
import { useAuth } from '../contexts/AuthContext'
import { useCampaigns } from '../contexts/CampaignContext'
import { useToast } from '../contexts/ToastContext'
import { ApiError } from '../api/client'
import { createEcho, REALTIME_CONFIGURED } from '../lib/echo'
import { MONSTERS, rollMonsterHp, crToAttackBonus, crToDamageDice, crToXp, CR_XP, type MonsterTemplate } from '../data/monsters'
import { canLevelUp } from '../data/xp'
import { CONDITIONS_FR } from '../data/conditions'
import { ConditionTag } from '../components/ConditionTag'
import { XP_THRESHOLDS, encounterMultiplier, encounterDifficultyLabel, difficultyColor, computeEncounterDifficulty } from '../data/encounter_difficulty'
import { MicButton } from '../components/MicButton'

// ── Helpers ───────────────────────────────────────────────────────────────────


function sign(n: number) {
  return n >= 0 ? `+${n}` : `${n}`
}

function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}

function parseDice(str: string): { count: number; sides: number; bonus: number } | null {
  const m = str.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i)
  if (!m) return null
  return { count: parseInt(m[1]), sides: parseInt(m[2]), bonus: parseInt(m[3] ?? '0') }
}

/** Dé affiché pour un sort : un sort mineur monte avec le niveau du personnage. */
function spellDice(character: Character, spell: { level: number; damage_dice?: string }): string {
  const base = spell.damage_dice ?? ''
  return spell.level === 0 ? scaleCantripDamage(base, character.level) : base
}

/**
 * Pastille de niveau d'un sort, comme sur la fiche : « TdM » pour un tour de magie,
 * « N1/N2… » sinon. Pour un sort à emplacement, on colle le nombre restant (·2) — en
 * rouge à sec, pour que le MJ voie d'un coup d'œil qui n'a plus de munition.
 */
function SpellLevelBadge({ character, level }: { character: Character; level: number }) {
  if (level === 0) {
    return <span title="Tour de magie (à volonté)" className="text-violet-500/70 ml-1">TdM</span>
  }
  const slot = character.spellcasting.slots[String(level)]
  const left = slot ? Math.max(0, slot.max - (slot.used ?? 0)) : null
  return (
    <span
      title={left === null
        ? `Niveau ${level}`
        : `Niveau ${level} · ${left}/${slot!.max} emplacement${slot!.max > 1 ? 's' : ''} restant${left > 1 ? 's' : ''}`}
      className="text-violet-500/70 ml-1"
    >
      N{level}
      {left !== null && <span className={left === 0 ? 'text-red-400/90' : 'text-violet-400/60'}>·{left}</span>}
    </span>
  )
}

/**
 * Emplacements de sort d'un personnage, en pastilles cliquables : pleines =
 * disponibles, vides = dépensés. Cliquer dépense (ou restaure) un emplacement.
 * Muet si le personnage n'a pas de caractéristique d'incantation ou aucun
 * emplacement — un simple lanceur de tours de magie n'en a pas.
 */
function SpellSlots({ character, onUse, className = '' }: { character: Character; onUse: (level: number, action: 'use' | 'restore') => void; className?: string }) {
  const entries = Object.entries(character.spellcasting.slots)
    .filter(([, slot]) => slot.max > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
  if (!character.spellcasting.ability || entries.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-0.5 ${className}`}>
      {entries.map(([lvl, slot]) => {
        const available = slot.max - slot.used
        return (
          <span key={lvl} className="flex items-center gap-1">
            <span className="text-stone-600 text-xs w-3">{lvl}</span>
            {Array.from({ length: slot.max }, (_, i) => (
              <button
                key={i}
                onClick={() => onUse(Number(lvl), i < available ? 'use' : 'restore')}
                title={i < available ? `Dépenser emplacement niv.${lvl}` : `Restaurer emplacement niv.${lvl}`}
                className={`w-3 h-3 rounded-full border transition-colors ${
                  i < available
                    ? 'bg-violet-500 border-violet-400 hover:bg-violet-400'
                    : 'bg-transparent border-stone-600 hover:border-violet-600'
                }`}
              />
            ))}
          </span>
        )
      })}
    </div>
  )
}

function rollMacro(character: Character, macro: AttackMacro, type: 'attack' | 'damage'): { label: string; total: number; detail: string } {
  if (type === 'attack') {
    const bonus = macro.attack_bonus ?? 0
    const roll = Math.floor(Math.random() * 20) + 1
    const total = roll + bonus
    const nat = roll === 20 ? ' (critique!)' : roll === 1 ? ' (échec crit.)' : ''
    return {
      label: `${character.name} — Attaque: ${macro.name}`,
      detail: `[${roll}]${bonus !== 0 ? ` ${bonus >= 0 ? '+' : ''}${bonus}` : ''}${nat}`,
      total,
    }
  }
  const parsed = parseDice(macro.damage_dice)
  if (!parsed) return { label: `${character.name} — Dégâts: ${macro.name}`, detail: '?', total: 0 }
  const rolls = Array.from({ length: parsed.count }, () => Math.floor(Math.random() * parsed.sides) + 1)
  const total = rolls.reduce((s, r) => s + r, 0) + parsed.bonus
  const detail = `[${rolls.join('+')}]${parsed.bonus !== 0 ? ` ${parsed.bonus >= 0 ? '+' : ''}${parsed.bonus}` : ''}`
  return { label: `${character.name} — Dégâts: ${macro.name}`, detail, total }
}

function rollSpell(character: Character, spell: Spell, type: 'attack' | 'damage'): { label: string; total: number; detail: string } {
  if (type === 'attack') {
    const bonus = character.spellcasting.attack_bonus
    const roll = Math.floor(Math.random() * 20) + 1
    const total = roll + bonus
    const nat = roll === 20 ? ' (critique!)' : roll === 1 ? ' (échec crit.)' : ''
    return {
      label: `${character.name} — Sort: ${spell.name}`,
      detail: `[${roll}]${bonus !== 0 ? ` ${bonus >= 0 ? '+' : ''}${bonus}` : ''}${nat}`,
      total,
    }
  }
  // Un sort mineur monte en puissance avec le niveau du personnage (5/11/17).
  const dice = spell.level === 0
    ? scaleCantripDamage(spell.damage_dice ?? '', character.level)
    : (spell.damage_dice ?? '')
  const parsed = parseDice(dice)
  if (!parsed) return { label: `${character.name} — Dégâts: ${spell.name}`, detail: '?', total: 0 }
  const rolls = Array.from({ length: parsed.count }, () => Math.floor(Math.random() * parsed.sides) + 1)
  const total = rolls.reduce((s, r) => s + r, 0) + parsed.bonus
  const detail = `[${rolls.join('+')}]${parsed.bonus !== 0 ? ` ${parsed.bonus >= 0 ? '+' : ''}${parsed.bonus}` : ''}`
  return { label: `${character.name} — Dégâts: ${spell.name}`, detail, total }
}

// ── Encounter builder helpers ─────────────────────────────────────────────────

// [easy, medium, hard, deadly] XP thresholds per character level

const CR_VALUES = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '30']
const CR_NUM: Record<string, number> = {
  '0': 0, '1/8': 0.125, '1/4': 0.25, '1/2': 0.5,
  '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  '11': 11, '12': 12, '13': 13, '14': 14, '15': 15, '16': 16, '17': 17, '18': 18, '19': 19, '20': 20,
  '21': 21, '22': 22, '23': 23, '24': 24, '25': 25, '30': 30,
}

// ── Unified row type ──────────────────────────────────────────────────────────

type CombatRow =
  | { kind: 'character'; initiativeRoll: number | null; data: Character }
  | { kind: 'combatant'; initiativeRoll: number | null; data: Combatant }

function rowId(row: CombatRow): string {
  return `${row.kind}-${row.data.id}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InitInput({
  value,
  mod,
  onSet,
}: {
  value: number | null
  mod: number
  onSet: (roll: number | null) => void
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : '')

  useEffect(() => {
    setDraft(value != null ? String(value) : '')
  }, [value])

  function commit() {
    const n = parseInt(draft, 10)
    onSet(isNaN(n) ? null : n)
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit() }}
        placeholder={sign(mod)}
        className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {value == null && (
        <span className="text-stone-600 text-xs">(mod {sign(mod)})</span>
      )}
    </div>
  )
}

// ── Combat summary modal ──────────────────────────────────────────────────────

type LootResult = { description: string; items: string[] }

function generateLoot(crList: number[]): LootResult {
  const totalCr = crList.reduce((s, c) => s + c, 0)
  const d = (n: number) => Math.floor(Math.random() * n) + 1
  if (totalCr <= 4) {
    const cp = d(6) * d(6) * 10
    const sp = d(3) * d(6) * 10
    const gp = d(4) <= 2 ? d(4) * 10 : 0
    const gems = d(6) <= 2 ? d(3) : 0
    const parts = [cp > 0 && `${cp} pc`, sp > 0 && `${sp} pa`, gp > 0 && `${gp} po`].filter(Boolean) as string[]
    const items = gems > 0 ? [`${gems} gemme${gems > 1 ? 's' : ''} semi-précieuse${gems > 1 ? 's' : ''} (10 po ch.)`] : []
    return { description: parts.join(', ') || '—', items }
  }
  if (totalCr <= 10) {
    const gp = d(6) * d(6) * 100
    const gems = d(4) <= 2 ? d(4) : 0
    const art = d(6) <= 2 ? d(2) : 0
    const items: string[] = []
    if (gems > 0) items.push(`${gems} gemme${gems > 1 ? 's' : ''} (50 po ch.)`)
    if (art > 0) items.push(`${art} objet${art > 1 ? 's' : ''} d'art (25 po ch.)`)
    return { description: `${gp} po`, items }
  }
  if (totalCr <= 16) {
    const gp = d(4) * d(6) * 1000
    const pp = d(6) * d(6) * 10
    const gems = d(4) + 1
    const items: string[] = [`${gems} gemme${gems > 1 ? 's' : ''} précieuse${gems > 1 ? 's' : ''} (500 po ch.)`]
    return { description: `${gp} po + ${pp} pp`, items }
  }
  const pp = d(6) * d(6) * 1000
  const gems = d(6) + 2
  return {
    description: `${pp} pp`,
    items: [`${gems} gemmes/objets précieux (1 000 po ch.)`, 'Objet magique potentiel (lancer sur table DMG)'],
  }
}

function CombatSummaryModal({ roundNumber, combatants, monsterMap, characters, campaignId, onClose, onReset, onDistributeXp }: {
  roundNumber: number
  combatants: Combatant[]
  monsterMap: Record<number, MonsterTemplate>
  characters: Character[]
  campaignId: number | null
  onClose: () => void
  onReset: () => void
  onDistributeXp?: (total: number) => Promise<{ share: number; levelUps: string[] } | void>
}) {
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [xpDistributed, setXpDistributed] = useState<{ share: number; levelUps: string[] } | null>(null)
  const [distributing, setDistributing] = useState(false)
  const [loot, setLoot] = useState<LootResult | null>(null)

  const defeated = combatants.filter(c => c.current_hp <= 0)
  const totalXp = defeated.reduce((sum, c) => {
    const tpl = monsterMap[c.id]
    return sum + (tpl ? crToXp(tpl.cr) : 0)
  }, 0)
  const shareXp = characters.length > 0 ? Math.floor(totalXp / characters.length) : 0

  async function handleExportToSession() {
    if (!campaignId) return
    setExporting(true)
    const today = new Date().toISOString().split('T')[0]
    const lines: string[] = [
      `Rounds : ${roundNumber}`,
      '',
    ]
    if (defeated.length > 0) {
      lines.push(`Ennemis vaincus (${defeated.length}) :`)
      defeated.forEach(c => {
        const xp = monsterMap[c.id] ? crToXp(monsterMap[c.id].cr) : 0
        lines.push(`- ${c.name}${xp > 0 ? ` — ${xp} XP` : ''}`)
      })
      if (totalXp > 0) {
        lines.push(`Total : ${totalXp} XP${characters.length > 1 ? ` (${shareXp}/joueur)` : ''}`)
      }
      lines.push('')
    }
    if (characters.length > 0) {
      lines.push('État du groupe :')
      characters.forEach(c => {
        lines.push(`- ${c.name} : ${c.combat.current_hp}/${c.combat.max_hp} PV`)
      })
    }
    try {
      // Un compte rendu de combat n'est pas à préparer : il arrive déjà joué.
      await createChapter(campaignId, {
        title: `Combat — ${today}`,
        notes: lines.join('\n'),
        done: true,
      })
      setExported(true)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-md shadow-2xl mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-700">
          <h2 className="text-amber-300 font-semibold text-base">⚔ Résumé du combat</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-lg leading-none">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-stone-400">Rounds joués</span>
            <span className="text-stone-200 font-semibold">{roundNumber}</span>
          </div>

          <div>
            <p className="text-stone-400 text-sm mb-1.5">Ennemis vaincus ({defeated.length})</p>
            {defeated.length === 0 ? (
              <p className="text-stone-600 text-xs italic">Aucun ennemi vaincu.</p>
            ) : (
              <ul className="space-y-1">
                {defeated.map(c => {
                  const tpl = monsterMap[c.id]
                  const xp = tpl ? crToXp(tpl.cr) : 0
                  return (
                    <li key={c.id} className="flex justify-between text-xs">
                      <span className="text-stone-300">{c.name}</span>
                      {xp > 0 && <span className="text-amber-400">{xp} XP</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {totalXp > 0 && (
            <div className="space-y-2">
              <div className="bg-stone-800 rounded-lg px-3 py-2 flex justify-between text-sm">
                <span className="text-stone-400">Total XP</span>
                <span className="text-amber-300 font-semibold">
                  {totalXp} XP{characters.length > 1 ? ` (${shareXp}/joueur)` : ''}
                </span>
              </div>
              {onDistributeXp && characters.length > 0 && (
                xpDistributed ? (
                  <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg px-3 py-2 text-center space-y-1">
                    <p className="text-emerald-400 font-semibold text-sm">✦ +{xpDistributed.share} XP distribués</p>
                    {xpDistributed.levelUps.length > 0 && (
                      <p className="text-amber-400 text-xs">⬆ Montée de niveau : {xpDistributed.levelUps.join(', ')}</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setDistributing(true)
                      const res = await onDistributeXp(totalXp)
                      if (res) setXpDistributed(res)
                      setDistributing(false)
                    }}
                    disabled={distributing}
                    className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg px-4 py-2 transition-colors"
                  >
                    {distributing ? '…' : `✦ Distribuer ${shareXp} XP / joueur`}
                  </button>
                )
              )}
            </div>
          )}

          {/* Treasure generator */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-stone-400 text-sm">Butin</p>
              <button
                onClick={() => {
                  const crList = defeated.map(c => {
                    const tpl = monsterMap[c.id]
                    if (!tpl) return 0
                    const n = parseFloat(tpl.cr)
                    return isNaN(n) ? 0 : n
                  })
                  setLoot(generateLoot(crList))
                }}
                className="text-xs text-stone-500 hover:text-amber-400 transition-colors"
              >
                {loot ? '↺ Régénérer' : '⚄ Générer butin'}
              </button>
            </div>
            {loot ? (
              <div className="bg-stone-800 rounded-lg px-3 py-2 space-y-1">
                <p className="text-amber-300 text-sm font-medium">{loot.description}</p>
                {loot.items.map((item, i) => (
                  <p key={i} className="text-stone-400 text-xs">· {item}</p>
                ))}
              </div>
            ) : (
              <p className="text-stone-600 text-xs italic">Cliquez "Générer butin" pour tirer un trésor selon les CR vaincus.</p>
            )}
          </div>

          {characters.length > 0 && (
            <div>
              <p className="text-stone-400 text-sm mb-1.5">État du groupe</p>
              <ul className="space-y-1">
                {characters.map(c => {
                  const pct = c.combat.max_hp > 0 ? c.combat.current_hp / c.combat.max_hp : 0
                  const color = pct > 0.5 ? 'text-emerald-400' : pct > 0.25 ? 'text-yellow-400' : 'text-red-400'
                  return (
                    <li key={c.id} className="flex justify-between text-xs">
                      <span className="text-stone-300">{c.name}</span>
                      <span className={color}>{c.combat.current_hp}/{c.combat.max_hp} PV</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-between gap-2 px-5 py-3 border-t border-stone-800">
          <button
            onClick={handleExportToSession}
            disabled={exporting || exported || !campaignId}
            className="text-amber-400 hover:text-amber-300 disabled:opacity-50 text-sm px-3 py-1.5 rounded-lg border border-amber-800/50 hover:border-amber-700/50 transition-colors flex items-center gap-1.5"
          >
            {exported ? '✓ Note créée' : exporting ? '…' : '📋 Exporter en note'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-200 text-sm px-3 py-1.5 rounded-lg border border-stone-700 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={onReset}
              className="text-stone-200 hover:text-white text-sm px-3 py-1.5 rounded-lg bg-stone-700 hover:bg-stone-600 border border-stone-600 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CombatPage() {
  const toast = useToast()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const campaignId = searchParams.get('campaign') ? Number(searchParams.get('campaign')) : null
  const { currentId: currentCampaignId, loading: campaignsLoading } = useCampaigns()

  const [characters, setCharacters] = useState<Character[]>([])
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [showBattleMap, setShowBattleMap] = useState(false)
  // The docked active-combatant panel is the primary surface now; the full
  // initiative list stays as a collapsible fallback (repliée par défaut).
  const [showInitList, setShowInitList] = useState(false)
  // Overflow menu (⋯) regroupant les actions utilitaires de l'en-tête d'initiative.
  const [showInitMenu, setShowInitMenu] = useState(false)
  // Ribbon card whose quick-action popover is open (off-turn Dmg/Soin/état).
  const [ribbonMenu, setRibbonMenu] = useState<string | null>(null)
  // Horizontal center (px, relative to the fixed bar) of the card whose popover is open — anchors it under the card.
  const [ribbonMenuX, setRibbonMenuX] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  // Set only when no combat could be resolved and the DM must pick a campaign.
  const allMonsters: MonsterTemplate[] = [
    ...MONSTERS,
    ...(campaign?.custom_monsters ?? []).map(m => ({
      name: m.name, cr: m.cr, ac: m.ac,
      hp_dice: 0, hp_sides: 1, hp_bonus: m.hp_avg,
      hp_avg: m.hp_avg, initiative_mod: m.initiative_mod,
      xp: CR_XP[m.cr] ?? m.xp,
    })),
  ]
  const [loading, setLoading] = useState(true)
  const [activeTurn, setActiveTurn] = useState(0)
  const [diceLog, setDiceLog] = useState<DiceRoll[]>(() => {
    if (!campaignId) return []
    try {
      const stored = localStorage.getItem(`taverne-dice-log-${campaignId}`)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })
  const [actionState, setActionState] = useState<Record<string, { action: boolean; bonus: boolean; reaction: boolean }>>({})
  const [expandedConditions, setExpandedConditions] = useState<number | null>(null)
  const [conditionDurationDraft, setConditionDurationDraft] = useState<Record<string, string>>({})
  const [aoeMode, setAoeMode] = useState(false)
  const [aoeSelected, setAoeSelected] = useState<Set<string>>(new Set())
  const [aoeDamageInput, setAoeDamageInput] = useState('')
  const [aoeCondition, setAoeCondition] = useState('')
  const [expandedMonster, setExpandedMonster] = useState<number | null>(null)
  const [expandedCharacterConditions, setExpandedCharacterConditions] = useState<number | null>(null)
  const [characterConditionDurationDraft, setCharacterConditionDurationDraft] = useState<Record<string, string>>({})
  const [charTempHpInputs, setCharTempHpInputs] = useState<Record<number, string>>({})
  const [macroResult, setMacroResult] = useState<{ label: string; detail: string; total: number; isAttack: boolean } | null>(null)
  const macroResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [roundNumber, setRoundNumber] = useState(1)
  const [showXpPanel, setShowXpPanel] = useState(false)
  const [xpInputs, setXpInputs] = useState<Record<number, string>>({})
  const [xpResult, setXpResult] = useState<{ total: number; share: number; levelUps: string[] } | null>(null)
  const [monsterMap, setMonsterMap] = useState<Record<number, MonsterTemplate>>({})

  /**
   * Fiche de créature associée à chaque combattant.
   *
   * `monsterMap` n'est peuplé qu'au moment où l'on ajoute une créature depuis le
   * bestiaire, et c'est un état React : il disparaît au moindre rechargement de la
   * page. On retombe donc sur une recherche par nom dans le bestiaire (SRD +
   * personnalisé) — sans quoi l'XP des créatures prédéfinies n'est jamais
   * pré-remplie, et le bouton « Distribuer » reste désactivé faute de total.
   */
  const resolvedMonsters: Record<number, MonsterTemplate> = {}
  combatants.forEach(cb => {
    const tpl = monsterMap[cb.id] ?? allMonsters.find(m => m.name === cb.name)
    if (tpl) resolvedMonsters[cb.id] = tpl
  })

  /**
   * XP d'un combattant. Le FP STOCKÉ sur le combattant fait foi : il survit au
   * rechargement et à un renommage. À défaut (combattants créés avant cette
   * colonne), on retombe sur la fiche retrouvée par nom dans le bestiaire.
   */
  const xpForCombatant = (id: number): number => {
    const cb = combatants.find(c => c.id === id)
    if (cb?.cr) return crToXp(cb.cr)
    const tpl = resolvedMonsters[id]
    if (!tpl) return 0
    return tpl.xp || crToXp(tpl.cr)
  }
  const [showCombatSummary, setShowCombatSummary] = useState(false)

  // Group rest
  const [showRestPanel, setShowRestPanel] = useState(false)
  const [restInProgress, setRestInProgress] = useState(false)
  const [restNotif, setRestNotif] = useState<{ type: 'short' | 'long'; results: { name: string; healed: number }[] } | null>(null)
  const restNotifTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Combat timers (global)
  const [timers, setTimers] = useState<{ id: number; name: string; rounds: number }[]>([])
  const [timerName, setTimerName] = useState('')
  const [timerRounds, setTimerRounds] = useState('1')
  const [expiredAlert, setExpiredAlert] = useState<string[]>([])
  const [showTimerForm, setShowTimerForm] = useState(false)
  const timerIdRef = useRef(0)

  // Per-combatant effects
  const [combatantEffects, setCombatantEffects] = useState<Record<string, { id: number; name: string; rounds: number }[]>>({})
  const [effectInput, setEffectInput] = useState<{ key: string; name: string; rounds: string } | null>(null)
  const effectIdRef = useRef(0)

  // Turn timer
  const [turnTimerMax, setTurnTimerMax] = useState(0)
  const [turnTimerLeft, setTurnTimerLeft] = useState(0)
  const [turnTimerExpired, setTurnTimerExpired] = useState(false)
  const turnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const turnTimerMaxRef = useRef(0)
  turnTimerMaxRef.current = turnTimerMax

  // Random encounter generator
  const [generateDifficulty, setGenerateDifficulty] = useState<'facile' | 'moyen' | 'difficile' | 'mortelle'>('moyen')
  const [showGeneratePanel, setShowGeneratePanel] = useState(false)
  const [showNotepad, setShowNotepad] = useState(false)
  const [combatNotes, setCombatNotes] = useState(() => {
    if (typeof window === 'undefined') return ''
    try { return localStorage.getItem(`taverne-combat-notes-${campaignId ?? 'default'}`) ?? '' } catch { return '' }
  })

  // Réordonnancement manuel de l'initiative (local au MJ ; les joueurs trient toujours
  // par jet d'initiative). Deux états SÉPARÉS à dessein : `manualOrder` est l'arrangement
  // retenu qui pilote l'affichage, `reordering` n'est que le mode d'édition (poignées,
  // glisser-déposer). Les confondre faisait que revalider (sortir du mode) effaçait
  // l'ordre donné et rebasculait sur l'initiative — le bug corrigé ici.
  const [manualOrder, setManualOrder] = useState<string[] | null>(null)
  const [reordering, setReordering] = useState(false)
  const [dragRowId, setDragRowId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // DM dice roller

  // Encounter builder
  const [showEncounterBuilder, setShowEncounterBuilder] = useState(false)
  const [encounterSearch, setEncounterSearch] = useState('')
  const [encounterEntries, setEncounterEntries] = useState<{ monster: MonsterTemplate; count: number }[]>([])
  const [saveEncounterName, setSaveEncounterName] = useState('')
  const [showSavedEncounters, setShowSavedEncounters] = useState(false)
  const [savedEncounterSearch, setSavedEncounterSearch] = useState('')
  const [savedEncounterSort, setSavedEncounterSort] = useState<'default' | 'name' | 'difficulty'>('default')
  const [combatFactionFilter, setCombatFactionFilter] = useState<'all' | 'allié' | 'ennemi' | 'neutre'>('all')
  const [combatTrackerSearch, setCombatTrackerSearch] = useState('')
  const [encounterMonsterSort, setEncounterMonsterSort] = useState<'cr_asc' | 'cr_desc' | 'name' | 'xp'>('cr_asc')

  // Saving throws
  const [showSavingThrow, setShowSavingThrow] = useState(false)
  const [savingThrowAbility, setSavingThrowAbility] = useState<'strength'|'dexterity'|'constitution'|'intelligence'|'wisdom'|'charisma'>('dexterity')
  const [savingThrowDC, setSavingThrowDC] = useState('15')
  const [savingThrowResults, setSavingThrowResults] = useState<{ name: string; roll: number; mod: number; total: number; success: boolean }[] | null>(null)

  // Combat log
  interface CombatLogEntry { id: number; time: string; type: 'turn' | 'roll' | 'hp' | 'xp' | 'join' | 'condition' | 'spell'; text: string }
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([])
  const [showCombatLog, setShowCombatLog] = useState(false)
  const [savingLog, setSavingLog] = useState(false)
  const [logSaved, setLogSaved] = useState(false)
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | CombatLogEntry['type']>('all')
  const logIdRef = useRef(0)

  function logEvent(type: CombatLogEntry['type'], text: string) {
    const entry: CombatLogEntry = {
      id: ++logIdRef.current,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type,
      text,
    }
    setCombatLog(prev => [entry, ...prev].slice(0, 150))
  }

  async function handleSaveLogToSession() {
    if (!campaignId || combatLog.length === 0 || savingLog) return
    setSavingLog(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const lines = [...combatLog].reverse().map(e => `[${e.time}] ${e.text}`)
      await createChapter(campaignId, {
        title: `Journal de combat — ${today}`,
        notes: lines.join('\n'),
        done: true,
      })
      setLogSaved(true)
      setTimeout(() => setLogSaved(false), 3000)
    } finally {
      setSavingLog(false)
    }
  }

  function handleRollMacro(character: Character, macro: AttackMacro, type: 'attack' | 'damage') {
    const result = rollMacro(character, macro, type)
    if (macroResultTimer.current) clearTimeout(macroResultTimer.current)
    setMacroResult({ ...result, isAttack: type === 'attack' })
    macroResultTimer.current = setTimeout(() => setMacroResult(null), 6000)
    logEvent('roll', `${character.name} · ${macro.name} ${type === 'attack' ? 'Att.' : 'Dég.'} → ${result.total}  (${result.detail})`)
  }

  function handleRollSpell(character: Character, spell: Spell, type: 'attack' | 'damage') {
    const result = rollSpell(character, spell, type)
    if (macroResultTimer.current) clearTimeout(macroResultTimer.current)
    setMacroResult({ ...result, isAttack: type === 'attack' })
    macroResultTimer.current = setTimeout(() => setMacroResult(null), 6000)
    logEvent('roll', `${character.name} · ✦ ${spell.name} ${type === 'attack' ? 'Att.' : 'Dég.'} → ${result.total} (${result.detail})`)
  }

  function handleMonsterRoll(combatantId: number, m: MonsterTemplate, type: 'attack' | 'damage') {
    const cbName = combatants.find(c => c.id === combatantId)?.name ?? m.name
    if (type === 'attack') {
      const bonus = crToAttackBonus(m.cr)
      const roll = Math.floor(Math.random() * 20) + 1
      const total = roll + bonus
      const nat = roll === 20 ? ' (critique!)' : roll === 1 ? ' (échec crit.)' : ''
      const detail = `[${roll}]${bonus >= 0 ? `+${bonus}` : `${bonus}`}${nat}`
      const label = `${cbName} — Attaque`
      if (macroResultTimer.current) clearTimeout(macroResultTimer.current)
      setMacroResult({ label, detail, total, isAttack: true })
      macroResultTimer.current = setTimeout(() => setMacroResult(null), 6000)
      logEvent('roll', `${cbName} · Attaque → ${total} (${detail})`)
    } else {
      const { count, sides, bonus } = crToDamageDice(m.cr)
      const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
      const total = rolls.reduce((s, r) => s + r, 0) + bonus
      const detail = `[${rolls.join('+')}]${bonus !== 0 ? (bonus >= 0 ? `+${bonus}` : `${bonus}`) : ''}`
      const label = `${cbName} — Dégâts (${count}d${sides}${bonus >= 0 ? `+${bonus}` : `${bonus}`})`
      if (macroResultTimer.current) clearTimeout(macroResultTimer.current)
      setMacroResult({ label, detail, total, isAttack: false })
      macroResultTimer.current = setTimeout(() => setMacroResult(null), 6000)
      logEvent('roll', `${cbName} · Dégâts → ${total} (${detail})`)
    }
  }

  // Combatant HP input per combatant id
  const [combatantHpInputs, setCombatantHpInputs] = useState<Record<number, string>>({})

  // Monster stats popup
  const [monsterPopup, setMonsterPopup] = useState<CustomMonster | null>(null)
  const [renamingCombatantId, setRenamingCombatantId] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState('')


  // Add combatant form
  // Modale « Combattants » de la vue plein écran (seul accès au bestiaire / constructeur là-bas).
  const [showAddEnemy, setShowAddEnemy] = useState(false)
  const [enemyTab, setEnemyTab] = useState<'bestiary' | 'manual' | 'encounter'>('bestiary')
  const [addingCombatant, setAddingCombatant] = useState(false)
  const [combatantDraft, setCombatantDraft] = useState({ name: '', faction: 'ennemi' as CombatantFaction, max_hp: '', ac: '', initiative: '', cr: '' })
  const [monsterSuggestions, setMonsterSuggestions] = useState<MonsterTemplate[]>([])
  const [showBestiary, setShowBestiary] = useState(false)
  const [bestiarySearch, setBestiarySearch] = useState('')
  const [bestiaryMinCr, setBestiaryMinCr] = useState('0')
  const [bestiaryMaxCr, setBestiaryMaxCr] = useState('30')
  const [encounterMinCr, setEncounterMinCr] = useState('0')
  const [encounterMaxCr, setEncounterMaxCr] = useState('30')
  const [addedMonster, setAddedMonster] = useState<string | null>(null)
  const [combatantError, setCombatantError] = useState<string | null>(null)
  const [charHpInputs, setCharHpInputs] = useState<Record<number, string>>({})
  const [concentrationPrompt, setConcentrationPrompt] = useState<{ character: Character; amount: number; dc: number } | null>(null)
  const [concentrationRoll, setConcentrationRoll] = useState<{ roll: number; mod: number; total: number; success: boolean } | null>(null)

  const echoRef = useRef<ReturnType<typeof createEcho> | null>(null)
  const restoredRef = useRef(false)
  const withRollDisplayRef = useRef<typeof withRollDisplay>([])

  // Restore combat turn state from localStorage after data loads
  useEffect(() => {
    if (loading || restoredRef.current || !campaignId) return
    restoredRef.current = true
    try {
      const savedRound = parseInt(localStorage.getItem(`taverne-combat-round-${campaignId}`) ?? '', 10)
      if (!isNaN(savedRound) && savedRound >= 1) setRoundNumber(savedRound)
      const savedActiveId = localStorage.getItem(`taverne-combat-active-${campaignId}`)
      if (savedActiveId && withRollDisplayRef.current.length > 0) {
        const idx = withRollDisplayRef.current.findIndex(r => rowId(r) === savedActiveId)
        if (idx >= 0) setActiveTurn(idx)
      }
    } catch { /* ignore */ }
  }, [loading, campaignId])

  // A combat always belongs to a campaign; reached without one in the URL, we
  // fall back on the campaign the DM is currently inside.
  useEffect(() => {
    if (campaignId || campaignsLoading) return
    if (currentCampaignId) navigate(`/combat?campaign=${currentCampaignId}`, { replace: true })
    else navigate('/campaigns?all=1', { replace: true })
  }, [campaignId, campaignsLoading, currentCampaignId, navigate])

  // Load characters + combatants
  useEffect(() => {
    if (!campaignId) return
    Promise.all([getCampaign(campaignId), listCombatants(campaignId)])
      .then(([c, cbs]) => {
        setCampaign(c)
        setCharacters(c.characters)
        setCombatants(cbs)
      })
      .catch(() => navigate('/campaigns?all=1'))
      .finally(() => setLoading(false))
  }, [campaignId, navigate])

  // WS subscriptions
  useEffect(() => {
    if (!token || !campaignId || !REALTIME_CONFIGURED) return

    const echo = createEcho(token)
    echoRef.current = echo

    // Canal campagne : mises à jour ET événements structurels (ajout/retrait de
    // combattant), poussés à toutes les sessions MJ ouvertes. C'est ce qui permet
    // l'ajout/retrait de combattant à chaud en multi-appareils — un canal par
    // combattant ne pourrait pas notifier les sessions qui ignorent le nouveau venu.
    echo.private(`campaign.${campaignId}`)
      .listen('.combatant.updated', (e: { combatant: Combatant }) => {
        setCombatants(prev => prev.some(c => c.id === e.combatant.id)
          ? prev.map(c => c.id === e.combatant.id ? e.combatant : c)
          : [...prev, e.combatant])
      })
      .listen('.combatant.removed', (e: { id: number }) => {
        setCombatants(prev => prev.filter(c => c.id !== e.id))
      })
      .listen('.character.updated', (e: { character: Character }) => {
        setCharacters(prev => prev.some(c => c.id === e.character.id)
          ? prev.map(c => c.id === e.character.id ? e.character : c)
          : prev)
      })

    // Canaux personnages : uniquement le flux de jets de dés (diffusé par personnage).
    characters.forEach(c => {
      echo.private(`character.${c.id}`)
        .listen('.dice.rolled', (e: DiceRoll) => {
          setDiceLog(log => {
            const next = [e, ...log].slice(0, 50)
            if (campaignId) localStorage.setItem(`taverne-dice-log-${campaignId}`, JSON.stringify(next))
            return next
          })
        })
        // Un sort d'utilité ne produit aucun dé : sans cette annonce, le MJ ne verrait
        // jamais passer un Bouclier ou une Armure de mage.
        .listen('.spell.cast', (e: { character_name: string; spell_name: string; level: number }) => {
          logEvent('spell', e.level > 0
            ? `${e.character_name} lance ${e.spell_name} (niv.${e.level})`
            : `${e.character_name} lance ${e.spell_name}`)
        })
    })

    return () => {
      echo.leave(`campaign.${campaignId}`)
      characters.forEach(c => echo.leave(`character.${c.id}`))
      echo.disconnect()
      echoRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, campaignId, characters.map(c => c.id).join(',')])

  // Build unified sorted list
  const allRows: CombatRow[] = [
    ...characters.map(c => ({ kind: 'character' as const, initiativeRoll: c.combat.initiative_roll, data: c })),
    ...combatants.map(c => ({ kind: 'combatant' as const, initiativeRoll: c.initiative_roll, data: c })),
  ].sort((a, b) => {
    const ra = a.initiativeRoll ?? -Infinity
    const rb = b.initiativeRoll ?? -Infinity
    if (rb !== ra) return (rb as number) - (ra as number)
    // tiebreak: character initiative mod vs combatant AC (proxy)
    const modA = a.kind === 'character' ? a.data.combat.initiative : 0
    const modB = b.kind === 'character' ? b.data.combat.initiative : 0
    return modB - modA
  })

  const withRoll = allRows.filter(r => r.initiativeRoll != null)
  const withoutRoll = allRows.filter(r => r.initiativeRoll == null)
  const sorted = [...withRoll, ...withoutRoll]

  // Manual order: reorder sorted rows; new rows not yet in manualOrder are appended
  const displayRows = manualOrder
    ? [
        ...manualOrder.flatMap(id => { const r = sorted.find(r => rowId(r) === id); return r ? [r] : [] }),
        ...sorted.filter(r => !manualOrder.includes(rowId(r))),
      ]
    : sorted
  const withRollDisplay = displayRows.filter(r => r.initiativeRoll != null)
  withRollDisplayRef.current = withRollDisplay

  const activeCombatant = withRollDisplay[activeTurn % Math.max(1, withRollDisplay.length)] ?? null

  // Phase 3 — quand une image de fond est fournie, le plateau devient l'élément central de la page.
  const hasBattleImage = !!campaign?.battle_map?.image_url

  // Lieux ayant une carte (section Monde) : proposés comme fond de plateau pour
  // « reprendre la carte du lieu du combat » sans re-téléverser l'image.
  const locationMaps = useMemo(
    () => (campaign?.locations ?? [])
      .filter((l): l is typeof l & { map_url: string } => !!l.map_url)
      .map(l => ({ name: l.name, map_url: l.map_url })),
    [campaign?.locations],
  )

  // Sans plateau visuel, la liste d'initiative est le seul contenu à afficher :
  // on la déplie automatiquement une fois dès qu'un combat est lancé pour ne pas
  // laisser un grand vide entre le haut de page et la barre du bas. L'utilisateur
  // reste libre de la replier ensuite (autoExpandedRef garde l'ouverture ponctuelle).
  const autoExpandedRef = useRef(false)
  useEffect(() => {
    if (autoExpandedRef.current || hasBattleImage) return
    if (withRoll.length > 0) {
      autoExpandedRef.current = true
      setShowInitList(true)
    }
  }, [withRoll.length, hasBattleImage])

  // Le combat est « lancé » dès que tout le monde a une initiative (plus aucune
  // manquante) : c'est ce qui active « Lancer l'initiative » et l'accès des joueurs.
  const combatLaunched = withRoll.length > 0 && withoutRoll.length === 0
  const mainWidthClass = hasBattleImage ? (combatLaunched ? 'max-w-7xl' : 'max-w-6xl') : 'max-w-5xl'

  const { setTitle, notify } = useTabNotify()

  // Update tab title on every turn change; blink if tab is hidden.
  useEffect(() => {
    const name = activeCombatant?.data.name ?? null
    if (!name) { setTitle('Taverne'); return }
    const msg = `⚔ ${name} — Taverne`
    if (document.hidden) notify(msg)
    else setTitle(msg)

    // Notify CharacterPage tabs via BroadcastChannel (turn + full order)
    try {
      const bc = new BroadcastChannel('taverne-combat-turn')
      bc.postMessage({
        characterId: activeCombatant?.kind === 'character' ? activeCombatant.data.id : undefined,
        name,
        combatOrder: withRollDisplay.map((row, i) => ({
          id: rowId(row),
          name: row.data.name,
          currentHp: row.kind === 'character' ? row.data.combat.current_hp : row.data.current_hp,
          maxHp: row.kind === 'character' ? row.data.combat.max_hp : row.data.max_hp,
          isActive: i === activeTurn,
          faction: row.kind === 'character' ? 'allié' : row.data.faction,
        })),
        round: roundNumber,
      })
      bc.close()
    } catch { /* unsupported */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTurn, activeCombatant?.data.id])

  function updateCharacter(updated: Character) {
    setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  async function handleSetCharacterInitiative(id: number, roll: number | null) {
    await run(async () => {
      const updated = await setInitiativeRoll(id, roll)
      updateCharacter(updated)
    }, "L'initiative n'a pas pu être enregistrée.")
  }

  async function handleSetCombatantInitiative(id: number, roll: number | null) {
    if (!campaignId) return
    await run(async () => {
      const updated = await updateCombatantInitiative(campaignId, id, roll)
      setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
    }, "L'initiative n'a pas pu être enregistrée.")
  }

  /**
   * Exécute une mutation et signale son échec.
   *
   * Ces handlers appliquent l'état renvoyé par le SERVEUR après la réponse : en cas
   * d'échec rien n'est corrompu, mais sans ce message l'action semblerait simplement
   * « ne rien faire » — un coup critique appliqué sur un wifi qui tousse passerait
   * inaperçu.
   */
  async function run<T>(fn: () => Promise<T>, message: string): Promise<T | undefined> {
    try {
      return await fn()
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : message)
    }
  }

  async function handleRollAllInitiative(onlyMissing = false) {
    const d20 = () => Math.floor(Math.random() * 20) + 1
    await run(() => Promise.all([
      ...characters
        .filter(c => !onlyMissing || c.combat.initiative_roll == null)
        .map(async c => {
          const roll = d20() + c.combat.initiative
          const updated = await setInitiativeRoll(c.id, roll)
          updateCharacter(updated)
        }),
      ...combatants
        .filter(cb => !onlyMissing || cb.initiative_roll == null)
        .map(async cb => {
          if (!campaignId) return
          const mod = resolvedMonsters[cb.id]?.initiative_mod ?? 0
          const roll = d20() + mod
          const updated = await updateCombatantInitiative(campaignId, cb.id, roll)
          setCombatants(prev => prev.map(x => x.id === updated.id ? updated : x))
        }),
    ]), "Les initiatives n'ont pas toutes pu être enregistrées.")
    // De nouveaux jets rendent caduc l'ordre donné à la main : on repart de l'initiative,
    // et on sort du mode d'édition pour ne pas laisser des poignées sur un ordre effacé.
    setManualOrder(null); setReordering(false)
    // Lancer l'initiative, c'est ouvrir le combat : les joueurs y accèdent.
    void setCombatActive(true)
  }

  /**
   * « Lancer le combat » ouvre l'accès aux joueurs SANS tirer leur initiative : chacun
   * lance la sienne depuis la vue Combat (dock joueur). On ne tire ici que pour les
   * combattants — PNJ et monstres, que personne d'autre ne lancerait — et on respecte
   * ceux qui ont déjà une initiative (ajoutés avec une valeur). « + Manquants » reste
   * le recours du MJ pour compléter un joueur absent qui ne lancera pas lui-même.
   */
  async function handleLaunchCombat() {
    const d20 = () => Math.floor(Math.random() * 20) + 1
    await run(() => Promise.all(
      combatants
        .filter(cb => cb.initiative_roll == null)
        .map(async cb => {
          if (!campaignId) return
          const mod = resolvedMonsters[cb.id]?.initiative_mod ?? 0
          const roll = d20() + mod
          const updated = await updateCombatantInitiative(campaignId, cb.id, roll)
          setCombatants(prev => prev.map(x => x.id === updated.id ? updated : x))
        }),
    ), "Les initiatives des combattants n'ont pas toutes pu être enregistrées.")
    setManualOrder(null); setReordering(false)
    void setCombatActive(true)
  }

  async function handleCombatantHp(combatantId: number, type: 'damage' | 'heal') {
    if (!campaignId) return
    const raw = combatantHpInputs[combatantId] ?? ''
    const amount = parseInt(raw, 10)
    if (!amount || amount <= 0) return
    const cbName = combatants.find(c => c.id === combatantId)?.name ?? '?'
    await run(async () => {
      const updated = await updateCombatantHp(campaignId, combatantId, amount, type)
      setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
      setCombatantHpInputs(prev => ({ ...prev, [combatantId]: '' }))
      logEvent('hp', `${cbName} : ${type === 'damage' ? `-${amount}` : `+${amount}`} PV`)
    }, `Les PV de ${cbName} n'ont pas pu être mis à jour.`)
  }

  async function handleSetCharacterTempHp(character: Character) {
    const raw = charTempHpInputs[character.id] ?? ''
    const amount = parseInt(raw, 10)
    if (!amount || amount < 0) return
    const updated = await updateHp(character.id, amount, 'temporary')
    updateCharacter(updated)
    setCharTempHpInputs(prev => ({ ...prev, [character.id]: '' }))
    logEvent('hp', `${character.name} : +${amount} PV temporaires`)
  }

  async function handleCharacterHp(character: Character, type: 'damage' | 'heal') {
    const raw = charHpInputs[character.id] ?? ''
    const amount = parseInt(raw, 10)
    if (!amount || amount <= 0) return
    await run(async () => {
      const updated = await updateHp(character.id, amount, type)
      updateCharacter(updated)
      setCharHpInputs(prev => ({ ...prev, [character.id]: '' }))
      logEvent('hp', `${character.name} : ${type === 'damage' ? `-${amount}` : `+${amount}`} PV`)
      if (type === 'damage' && character.state.concentrating_on) {
        const dc = Math.max(10, Math.floor(amount / 2))
        setConcentrationPrompt({ character: updated, amount, dc })
        setConcentrationRoll(null)
      }
    }, `Les PV de ${character.name} n'ont pas pu être mis à jour.`)
  }

  async function handleToggleCharacterCondition(id: number, condition: string, duration?: number) {
    const char = characters.find(c => c.id === id)
    if (!char) return
    const isActive = char.state.conditions.includes(condition)
    const nextConditions = isActive
      ? char.state.conditions.filter(c => c !== condition)
      : [...char.state.conditions, condition]
    const nextDurations = { ...char.state.condition_durations }
    if (isActive) {
      delete nextDurations[condition]
    } else if (duration) {
      nextDurations[condition] = duration
    }
    await run(async () => {
      const updated = await updateConditions(id, nextConditions, nextDurations)
      updateCharacter(updated)
    }, "L'état n'a pas pu être appliqué.")
  }

  function toggleAoeSelect(id: string) {
    setAoeSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAoeDamage(type: 'damage' | 'heal') {
    const amount = parseInt(aoeDamageInput, 10)
    if (!amount || amount <= 0 || aoeSelected.size === 0) return
    const names: string[] = []
    // Une zone touche plusieurs cibles : si une seule écriture échoue, le MJ doit
    // le savoir — sinon une créature reste à pleins PV sans que personne ne le voie.
    const ok = await run(() => Promise.all(Array.from(aoeSelected).map(async id => {
      const [kind, rawId] = id.split('-')
      const numId = parseInt(rawId, 10)
      if (kind === 'character') {
        const char = characters.find(c => c.id === numId)
        if (char) names.push(char.name)
        const updated = await updateHp(numId, amount, type)
        updateCharacter(updated)
      } else if (kind === 'combatant' && campaignId) {
        const cb = combatants.find(c => c.id === numId)
        if (cb) names.push(cb.name)
        const updated = await updateCombatantHp(campaignId, numId, amount, type)
        setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
      }
    })), "La zone n'a pas pu être appliquée à toutes les cibles.")
    if (!ok) return
    if (names.length > 0) {
      logEvent('hp', `Zone ${type === 'damage' ? `−${amount} PV` : `+${amount} PV`} → ${names.join(', ')}`)
    }
    setAoeDamageInput('')
    setAoeSelected(new Set())
    setAoeMode(false)
  }

  async function handleAoeCondition() {
    if (!aoeCondition || aoeSelected.size === 0) return
    const names: string[] = []
    await Promise.all(Array.from(aoeSelected).map(async id => {
      const [kind, rawId] = id.split('-')
      const numId = parseInt(rawId, 10)
      if (kind === 'character') {
        const char = characters.find(c => c.id === numId)
        if (!char || char.state.conditions.includes(aoeCondition)) return
        names.push(char.name)
        const updated = await updateConditions(numId, [...char.state.conditions, aoeCondition], char.state.condition_durations)
        updateCharacter(updated)
      } else if (kind === 'combatant' && campaignId) {
        const cb = combatants.find(c => c.id === numId)
        if (!cb || cb.conditions.includes(aoeCondition)) return
        names.push(cb.name)
        const updated = await updateCombatantConditions(campaignId, numId, [...cb.conditions, aoeCondition], cb.condition_durations)
        setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
      }
    }))
    if (names.length > 0) {
      logEvent('condition', `${CONDITIONS_FR[aoeCondition] ?? aoeCondition} → ${names.join(', ')}`)
    }
    setAoeCondition('')
  }

  /**
   * Supprime des combattants et propose d'annuler.
   *
   * La suppression est réversible côté serveur et conserve les identifiants : une
   * annulation remet donc réellement les combattants en place, pions du plateau
   * compris. C'est ce qui permet d'offrir « Annuler » après coup plutôt qu'une
   * boîte de confirmation avant chaque geste.
   */
  async function deleteCombatantsWithUndo(ids: number[], notice: string) {
    if (!campaignId || ids.length === 0) return
    const cid = campaignId

    // `run` renvoie undefined en cas d'échec — on retourne donc explicitement une
    // valeur en cas de succès, sinon les deux cas seraient indiscernables.
    const done = await run(async () => {
      await Promise.all(ids.map(id => deleteCombatant(cid, id)))
      setCombatants(prev => prev.filter(c => !ids.includes(c.id)))
      return true
    }, 'La suppression a échoué.')
    if (!done) return

    toast.info(notice, {
      label: 'Annuler',
      onClick: () => {
        void run(async () => {
          const restored = await Promise.all(ids.map(id => restoreCombatant(cid, id)))
          setCombatants(prev => {
            const byId = new Map(prev.map(c => [c.id, c]))
            restored.forEach(c => byId.set(c.id, c))
            return [...byId.values()]
          })
        }, 'La restauration a échoué.')
      },
    })
  }

  async function handleDeleteCombatant(id: number) {
    const name = combatants.find(c => c.id === id)?.name ?? 'Combattant'
    await deleteCombatantsWithUndo([id], `${name} supprimé.`)
  }

  async function handleToggleInspiration(character: Character) {
    await run(async () => {
      const updated = await updateInspiration(character.id, !character.combat.inspiration)
      updateCharacter(updated)
    }, "L'inspiration n'a pas pu être modifiée.")
  }

  async function handleUseSlot(character: Character, level: number, action: 'use' | 'restore') {
    const updated = await useSpellSlot(character.id, level, action)
    updateCharacter(updated)
  }

  async function handleToggleCombatantCondition(id: number, condition: string, duration?: number) {
    if (!campaignId) return
    const cb = combatants.find(c => c.id === id)
    if (!cb) return
    const isActive = cb.conditions.includes(condition)
    const nextConditions = isActive
      ? cb.conditions.filter(c => c !== condition)
      : [...cb.conditions, condition]
    const nextDurations = { ...cb.condition_durations }
    if (isActive) {
      delete nextDurations[condition]
    } else if (duration) {
      nextDurations[condition] = duration
    }
    await run(async () => {
      const updated = await updateCombatantConditions(campaignId, id, nextConditions, nextDurations)
      setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
    }, "L'état n'a pas pu être appliqué.")
  }

  async function handleRenameCombatant(id: number) {
    if (!campaignId || !renameDraft.trim()) return
    await run(async () => {
      const updated = await updateCombatantName(campaignId, id, renameDraft.trim())
      setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
      setRenamingCombatantId(null)
    }, "Le combattant n'a pas pu être renommé.")
  }

  async function handleCycleFaction(id: number) {
    if (!campaignId) return
    const cb = combatants.find(c => c.id === id)
    if (!cb) return
    const cycle: CombatantFaction[] = ['ennemi', 'allié', 'neutre']
    const next = cycle[(cycle.indexOf(cb.faction) + 1) % cycle.length]
    const updated = await updateCombatantFaction(campaignId, id, next)
    setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  async function handleAddCombatant() {
    if (!campaignId || !combatantDraft.name.trim()) return
    const maxHp = parseInt(combatantDraft.max_hp, 10)
    if (!maxHp || maxHp < 1) return
    setCombatantError(null)
    try {
      const created = await createCombatant(campaignId, {
        name: combatantDraft.name.trim(),
        cr: combatantDraft.cr.trim() || null,
        faction: combatantDraft.faction,
        max_hp: maxHp,
        armor_class: combatantDraft.ac ? parseInt(combatantDraft.ac, 10) || null : null,
        initiative_roll: combatantDraft.initiative ? parseInt(combatantDraft.initiative, 10) || null : null,
      })
      setCombatants(prev => [...prev, created])
      setCombatantDraft({ name: '', faction: 'ennemi', max_hp: '', ac: '', initiative: '', cr: '' })
      setAddingCombatant(false)
      logEvent('join', `${created.name} entre dans le combat`)
    } catch (e) {
      setCombatantError(e instanceof Error ? e.message : 'Erreur lors de l\'ajout')
    }
  }

  async function handleAddMonster(m: MonsterTemplate) {
    if (!campaignId) return
    setCombatantError(null)
    const hp = rollMonsterHp(m)
    const initRoll = Math.min(30, Math.floor(Math.random() * 20) + 1 + m.initiative_mod)
    try {
      const created = await createCombatant(campaignId, {
        name: m.name,
        cr: m.cr,
        max_hp: hp,
        armor_class: m.ac,
        initiative_roll: initRoll,
      })
      setCombatants(prev => [...prev, created])
      setMonsterMap(prev => ({ ...prev, [created.id]: m }))
      setAddedMonster(m.name)
      setTimeout(() => setAddedMonster(null), 2000)
      logEvent('join', `${m.name} entre dans le combat (${hp} PV, CA ${m.ac})`)
    } catch (e) {
      setCombatantError(e instanceof Error ? e.message : 'Erreur lors de l\'ajout')
    }
  }

  async function handleDeathSave(character: Character, type: 'successes' | 'failures', value: number) {
    const s = type === 'successes' ? value : character.state.death_saves_successes
    const f = type === 'failures'  ? value : character.state.death_saves_failures
    const updated = await updateDeathSaves(character.id, s, f)
    updateCharacter(updated)
  }

  async function handleLaunchEncounter() {
    for (const entry of encounterEntries) {
      for (let i = 0; i < entry.count; i++) {
        await handleAddMonster(entry.monster)
      }
    }
    setEncounterEntries([])
    setShowEncounterBuilder(false)
    setEncounterSearch('')
  }

  async function handleSaveEncounter() {
    if (!campaign || !campaignId || !saveEncounterName.trim() || encounterEntries.length === 0) return
    const newSaved: SavedEncounter = {
      name: saveEncounterName.trim(),
      entries: encounterEntries.map(e => ({ monster_name: e.monster.name, count: e.count, cr: e.monster.cr })),
    }
    const existing = campaign.saved_encounters ?? []
    const updated = await updateCampaign(campaignId, {
      saved_encounters: [...existing, newSaved],
    })
    setCampaign(updated)
    setSaveEncounterName('')
  }

  /**
   * Un gabarit vient d'être lancé : ses cibles alimentent l'outil « 🔥 Zone » déjà
   * en place. C'est tout l'intérêt du gabarit — sans ça, il faudrait re-cocher
   * chaque créature à la main.
   */
  function handleCastZone(rowIds: string[]) {
    if (rowIds.length === 0) {
      toast.info('Aucune créature dans la zone.')
      return
    }
    setAoeSelected(new Set(rowIds))
    setAoeMode(true)
    setShowSavingThrow(false)
    setShowRestPanel(false)
    toast.info(`${rowIds.length} cible${rowIds.length > 1 ? 's' : ''} dans la zone — saisissez les dégâts.`)
  }

  async function handleBattleMapChange(next: BattleMap) {
    if (!campaignId) return
    // Optimiste : le pion a déjà bougé à l'écran, et l'écriture le diffuse aussi
    // à la vue joueurs. Si elle échoue, on REVIENT en arrière : garder la position
    // optimiste ferait croire au MJ qu'elle est enregistrée et diffusée alors que
    // les joueurs voient toujours l'ancienne.
    const previous = campaign?.battle_map ?? null
    const prevLoc = campaign?.combat_location ?? null
    // Si l'image de fond change pour une image qui n'est la carte d'aucun lieu, le lieu
    // de combat mémorisé n'a plus de sens : on l'efface. Un déplacement de pion garde la
    // même image et ne touche donc pas au lieu.
    const imageChanged = next.image_url !== (previous?.image_url ?? '')
    const clearsLocation = imageChanged && prevLoc !== null && !locationMaps.some(l => l.map_url === next.image_url)
    const patch = clearsLocation ? { battle_map: next, combat_location: null } : { battle_map: next }
    setCampaign(prev => prev ? { ...prev, ...patch } : prev)
    try {
      await updateCampaign(campaignId, patch)
    } catch {
      setCampaign(prev => prev ? { ...prev, battle_map: previous, ...(clearsLocation ? { combat_location: prevLoc } : {}) } : prev)
      toast.error("Le plateau n'a pas pu être enregistré : le pion est revenu à sa position précédente.")
    }
  }

  /**
   * Reprend la carte d'un lieu comme fond de plateau ET mémorise ce lieu comme théâtre
   * du combat, en une seule écriture (diffusée aux joueurs). Le lieu reste jusqu'à ce
   * que le MJ change l'image pour autre chose (cf. handleBattleMapChange).
   */
  async function handlePickLocationMap(loc: { name: string; map_url: string }) {
    if (!campaignId) return
    const base = campaign?.battle_map ?? { image_url: '', grid: null, tokens: [] }
    const next: BattleMap = { ...base, image_url: loc.map_url }
    const prevMap = campaign?.battle_map ?? null
    const prevLoc = campaign?.combat_location ?? null
    setCampaign(prev => prev ? { ...prev, battle_map: next, combat_location: loc.name } : prev)
    try {
      await updateCampaign(campaignId, { battle_map: next, combat_location: loc.name })
    } catch {
      setCampaign(prev => prev ? { ...prev, battle_map: prevMap, combat_location: prevLoc } : prev)
      toast.error("La carte du lieu n'a pas pu être enregistrée.")
    }
  }

  /**
   * Ouvre ou ferme l'accès des joueurs à la vue Combat. Persisté en base : c'est ce
   * drapeau que lit la barre latérale partagée pour afficher (ou non) l'onglet Combat,
   * et le serveur le diffuse en direct. Optimiste et silencieux — un échec ne doit pas
   * bloquer le lancement des dés ni la clôture du combat.
   */
  async function setCombatActive(active: boolean) {
    if (!campaignId || campaign?.combat_active === active) return
    setCampaign(prev => prev ? { ...prev, combat_active: active } : prev)
    try {
      await updateCampaign(campaignId, { combat_active: active })
    } catch {
      setCampaign(prev => prev ? { ...prev, combat_active: !active } : prev)
    }
  }

  async function handleDeleteSavedEncounter(index: number) {
    if (!campaign || !campaignId) return
    const next = (campaign.saved_encounters ?? []).filter((_, i) => i !== index)
    const updated = await updateCampaign(campaignId, { saved_encounters: next })
    setCampaign(updated)
  }

  async function handleDuplicateSavedEncounter(index: number) {
    if (!campaign || !campaignId) return
    const src = (campaign.saved_encounters ?? [])[index]
    if (!src) return
    const copy: SavedEncounter = { ...src, name: `${src.name} (copie)`, entries: src.entries.map(e => ({ ...e })) }
    const next = [...(campaign.saved_encounters ?? []), copy]
    const updated = await updateCampaign(campaignId, { saved_encounters: next })
    setCampaign(updated)
  }

  function handleLoadSavedEncounter(saved: SavedEncounter) {
    const entries = saved.entries.flatMap(e => {
      const monster = allMonsters.find(m => m.name === e.monster_name)
      if (!monster) return []
      return [{ monster, count: e.count }]
    })
    setEncounterEntries(entries)
    setShowSavedEncounters(false)
    setShowEncounterBuilder(true)
  }

  /**
   * La navigation de gauche pointe une rencontre par son rang : /combat?encounter=2.
   * Elle garnit le constructeur, où elle se retouche avant d'être lancée. On attend
   * que la campagne soit chargée — c'est elle qui porte les rencontres.
   */
  const encounterParam = searchParams.get('encounter')
  useEffect(() => {
    if (!campaign || encounterParam === null) return
    const saved = (campaign.saved_encounters ?? [])[Number(encounterParam)]
    if (saved) handleLoadSavedEncounter(saved)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, encounterParam])

  async function handleReset() {
    await Promise.all(characters.map(c => setInitiativeRoll(c.id, null)))
    setCharacters(prev => prev.map(c => ({
      ...c,
      combat: { ...c.combat, initiative_roll: null },
    })))
    if (campaignId) {
      await Promise.all(combatants.map(c => updateCombatantInitiative(campaignId, c.id, null)))
      setCombatants(prev => prev.map(c => ({ ...c, initiative_roll: null })))
    }
    setActiveTurn(0)
    setRoundNumber(1)
    if (campaignId) {
      try {
        localStorage.removeItem(`taverne-combat-round-${campaignId}`)
        localStorage.removeItem(`taverne-combat-active-${campaignId}`)
      } catch { /* ignore */ }

      // Le combat est fini : plus personne n'annulera une suppression, on vide la
      // corbeille pour qu'elle ne s'accumule pas. Best-effort — un échec de ménage
      // ne doit pas empêcher la fin du combat.
      //
      // On retire d'abord les toasts « Annuler » encore affichés : leur cible va être
      // purgée, les laisser proposerait un geste voué à échouer.
      toast.dismissActionable()
      purgeTrashedCombatants(campaignId).catch(() => { /* purge différée au prochain combat */ })
    }
    restoredRef.current = false
    // Le combat est clos : le lieu mémorisé n'a plus de sens. On réémet la carte
    // inchangée avec le lieu à null pour que le label des joueurs s'efface en direct
    // (seule une écriture de battle_map déclenche la diffusion) — sans toucher l'image.
    if (campaignId && campaign?.combat_location) {
      const keepMap = campaign?.battle_map ?? null
      setCampaign(prev => prev ? { ...prev, combat_location: null } : prev)
      updateCampaign(campaignId, { battle_map: keepMap, combat_location: null }).catch(() => { /* best-effort */ })
    }
    // Le combat est clos : on referme l'accès des joueurs à la vue Combat.
    void setCombatActive(false)
  }

  function handleClearCombatants() {
    const ids = combatants.map(c => c.id)
    if (ids.length === 0) return
    void deleteCombatantsWithUndo(ids, `${ids.length} combattant${ids.length > 1 ? 's supprimés' : ' supprimé'}.`)
  }

  function handleClearDeadCombatants() {
    const ids = combatants.filter(c => c.current_hp <= 0).map(c => c.id)
    if (ids.length === 0) return
    void deleteCombatantsWithUndo(ids, `${ids.length} combattant${ids.length > 1 ? 's à terre retirés' : ' à terre retiré'}.`)
  }

  /**
   * Supprime le combat : réinitialise (initiatives, tour, accès joueurs) PUIS retire
   * tous les combattants ajoutés. Distinct de « Fin du combat » (qui garde les
   * combattants pour le résumé) et de « Réinitialiser » (qui les garde aussi).
   *
   * On réinitialise d'abord, tant que les combattants existent encore, avant de les
   * supprimer : la suppression douce laisse l'annulation possible (la purge de la
   * corbeille a déjà eu lieu dans handleReset).
   */
  async function handleDeleteCombat() {
    const count = combatants.length
    const message = count > 0
      ? `Supprimer ce combat ? Les ${count} combattant${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''} seront retirés et les initiatives effacées.`
      : 'Supprimer ce combat ? Les initiatives seront effacées.'
    if (!confirm(message)) return

    const ids = combatants.map(c => c.id)
    await handleReset()
    if (ids.length > 0) {
      void deleteCombatantsWithUndo(ids, `Combat supprimé — ${ids.length} combattant${ids.length > 1 ? 's retirés' : ' retiré'}.`)
    }
  }

  function handleGroupSavingThrow() {
    if (characters.length === 0) return
    const dc = parseInt(savingThrowDC, 10) || 15
    const ABILITY_LABELS: Record<string, string> = {
      strength: 'FOR', dexterity: 'DEX', constitution: 'CON',
      intelligence: 'INT', wisdom: 'SAG', charisma: 'CHA',
    }
    const results = characters.map(c => {
      const roll = Math.floor(Math.random() * 20) + 1
      const st = c.saving_throws[savingThrowAbility]
      const mod = st?.modifier ?? 0
      const total = roll + mod
      return { name: c.name, roll, mod, total, success: total >= dc }
    })
    setSavingThrowResults(results)
    const label = ABILITY_LABELS[savingThrowAbility]
    results.forEach(r => {
      logEvent('roll', `${r.name} JS ${label} DD${dc} : ${r.roll}${r.mod >= 0 ? '+' : ''}${r.mod}=${r.total} — ${r.success ? '✓ Réussi' : '✗ Raté'}`)
    })
  }

  function getActions(key: string) {
    return actionState[key] ?? { action: false, bonus: false, reaction: false }
  }

  function toggleAction(key: string, type: 'action' | 'bonus' | 'reaction') {
    setActionState(prev => {
      const cur = prev[key] ?? { action: false, bonus: false, reaction: false }
      return { ...prev, [key]: { ...cur, [type]: !cur[type] } }
    })
  }

  async function decrementConditions(row: CombatRow) {
    const conditions = row.kind === 'character' ? row.data.state.conditions : row.data.conditions
    const durations  = row.kind === 'character' ? row.data.state.condition_durations : row.data.condition_durations

    if (!Object.values(durations).some(d => d > 0)) return

    const nextConditions: string[] = []
    const nextDurations: Record<string, number> = {}

    for (const cond of conditions) {
      const dur = durations[cond]
      if (!dur) {
        nextConditions.push(cond)
      } else if (dur > 1) {
        nextConditions.push(cond)
        nextDurations[cond] = dur - 1
      }
      // dur === 1 → condition expire, non ajoutée
    }

    if (row.kind === 'character') {
      const updated = await updateConditions(row.data.id, nextConditions, nextDurations)
      updateCharacter(updated)
    } else {
      if (!campaignId) return
      const updated = await updateCombatantConditions(campaignId, row.data.id, nextConditions, nextDurations)
      setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
    }
  }

  function moveRow(id: string, direction: 'up' | 'down') {
    const currentOrder = manualOrder ?? sorted.map(rowId)
    const idx = currentOrder.indexOf(id)
    if (idx < 0) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return
    const next = [...currentOrder]
    ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
    setManualOrder(next)
    // Keep activeTurn pointing at the same combatant
    if (activeCombatant) {
      const activeId = rowId(activeCombatant)
      const newWithRollIds = next.filter(nId => sorted.find(r => rowId(r) === nId)?.initiativeRoll != null)
      const newIdx = newWithRollIds.indexOf(activeId)
      if (newIdx >= 0 && newIdx !== activeTurn) setActiveTurn(newIdx)
    }
  }

  function handleDrop(targetId: string) {
    if (!dragRowId || dragRowId === targetId) { setDragRowId(null); setDragOverId(null); return }
    const currentOrder = manualOrder ?? sorted.map(rowId)
    const fromIdx = currentOrder.indexOf(dragRowId)
    const toIdx = currentOrder.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) return
    const next = [...currentOrder]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, dragRowId)
    setManualOrder(next)
    setDragRowId(null)
    setDragOverId(null)
    if (activeCombatant) {
      const activeId = rowId(activeCombatant)
      const newWithRollIds = next.filter(nId => sorted.find(r => rowId(r) === nId)?.initiativeRoll != null)
      const newIdx = newWithRollIds.indexOf(activeId)
      if (newIdx >= 0 && newIdx !== activeTurn) setActiveTurn(newIdx)
    }
  }

  function nextTurn() {
    if (withRollDisplay.length === 0) return
    const currentRow = withRollDisplay[activeTurn % withRollDisplay.length]
    if (currentRow) {
      decrementConditions(currentRow)
      // Decrement per-combatant effects
      const key = rowId(currentRow)
      setCombatantEffects(prev => {
        const effects = prev[key]
        if (!effects || effects.length === 0) return prev
        const expired = effects.filter(e => e.rounds <= 1).map(e => e.name)
        const next = effects.map(e => ({ ...e, rounds: e.rounds - 1 })).filter(e => e.rounds > 0)
        if (expired.length > 0) setExpiredAlert(a => [...a, ...expired])
        return { ...prev, [key]: next }
      })
    }

    const next = (activeTurn + 1) % withRollDisplay.length
    const newRound = next === 0 ? roundNumber + 1 : roundNumber
    if (next === 0) setRoundNumber(newRound)
    setActiveTurn(next)

    const nextRow = withRollDisplay[next]
    if (nextRow) {
      setActionState(prev => ({ ...prev, [rowId(nextRow)]: { action: false, bonus: false, reaction: false } }))
    }

    // Decrement timers once per round (when round increments)
    if (next === 0) {
      const expiredNow = timers.filter(t => t.rounds <= 1).map(t => t.name)
      setTimers(prev => prev.map(t => ({ ...t, rounds: t.rounds - 1 })).filter(t => t.rounds > 0))
      if (expiredNow.length > 0) {
        setExpiredAlert(expiredNow)
        setTimeout(() => setExpiredAlert([]), 5000)
      }
    }

    if (nextRow) {
      logEvent('turn', `Tour ${newRound} — ${nextRow.data.name}`)
    }

    startTurnTimer()

    if (campaignId) {
      try {
        localStorage.setItem(`taverne-combat-round-${campaignId}`, String(newRound))
        if (nextRow) localStorage.setItem(`taverne-combat-active-${campaignId}`, rowId(nextRow))
      } catch { /* ignore */ }
    }

    if (campaignId && campaign?.share_token) {
      broadcastCombatTurn(campaignId, {
        active_kind: nextRow ? nextRow.kind : null,
        active_id:   nextRow ? nextRow.data.id : null,
        round:       newRound,
      })
    }
  }

  async function handleDistributeXp() {
    const total = Object.values(xpInputs).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
    if (total <= 0 || characters.length === 0) return
    const share = Math.floor(total / characters.length)
    const updated = await Promise.all(
      characters.map(c => updateIdentity(c.id, { experience_points: c.experience_points + share })),
    )
    updated.forEach(updateCharacter)
    const levelUps = updated
      .filter((c, i) => canLevelUp(c.level, c.experience_points) && !canLevelUp(characters[i].level, characters[i].experience_points))
      .map(c => c.name)
    setXpResult({ total, share, levelUps })
    logEvent('xp', `XP : +${share} XP / personnage (${total} total, ${characters.length} joueur${characters.length > 1 ? 's' : ''})`)
    setTimeout(() => { setXpResult(null); setShowXpPanel(false); setXpInputs({}) }, 8000)
  }

  async function handleDistributeXpAmount(total: number): Promise<{ share: number; levelUps: string[] }> {
    const share = Math.floor(total / characters.length)
    const updated = await Promise.all(
      characters.map(c => updateIdentity(c.id, { experience_points: c.experience_points + share })),
    )
    updated.forEach(updateCharacter)
    const levelUps = updated
      .filter((c, i) => canLevelUp(c.level, c.experience_points) && !canLevelUp(characters[i].level, characters[i].experience_points))
      .map(c => c.name)
    logEvent('xp', `XP : +${share} XP / personnage (${total} total)`)
    return { share, levelUps }
  }

  function prevTurn() {
    if (withRollDisplay.length === 0) return
    setActiveTurn(t => (t - 1 + withRollDisplay.length) % withRollDisplay.length)
  }

  // Stable ref so the keyboard listener never goes stale
  const kbRef = useRef({ nextTurn, prevTurn })
  kbRef.current.nextTurn = nextTurn
  kbRef.current.prevTurn = prevTurn

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
      if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); kbRef.current.nextTurn() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); kbRef.current.prevTurn() }
      if (e.key === 'Escape') {
        setShowBestiary(false); setShowEncounterBuilder(false)
        setShowXpPanel(false); setShowRestPanel(false)
        setAoeMode(false); setShowSavingThrow(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startTurnTimer() {
    if (turnIntervalRef.current) clearInterval(turnIntervalRef.current)
    if (turnTimerMaxRef.current === 0) return
    setTurnTimerLeft(turnTimerMaxRef.current)
    setTurnTimerExpired(false)
    turnIntervalRef.current = setInterval(() => {
      setTurnTimerLeft(prev => {
        const next = prev - 1
        if (next <= 0) {
          clearInterval(turnIntervalRef.current!)
          turnIntervalRef.current = null
          setTurnTimerExpired(true)
        }
        return Math.max(0, next)
      })
    }, 1000)
  }

  function handleSetTurnTimerMax(seconds: number) {
    if (turnIntervalRef.current) clearInterval(turnIntervalRef.current)
    setTurnTimerMax(seconds)
    setTurnTimerLeft(seconds)
    setTurnTimerExpired(false)
    if (seconds > 0 && withRollDisplay.length > 0) {
      turnTimerMaxRef.current = seconds
      setTimeout(startTurnTimer, 0)
    }
  }

  function handleGenerateEncounter() {
    if (characters.length === 0) return
    const diffIdx = { facile: 0, moyen: 1, difficile: 2, mortelle: 3 }[generateDifficulty]
    const partyThresholds = characters.reduce(
      (acc, c) => {
        const lvl = Math.max(1, Math.min(20, c.level))
        const t = XP_THRESHOLDS[lvl] ?? XP_THRESHOLDS[1]
        return [acc[0] + t[0], acc[1] + t[1], acc[2] + t[2], acc[3] + t[3]] as [number, number, number, number]
      },
      [0, 0, 0, 0] as [number, number, number, number],
    )
    const budget = partyThresholds[diffIdx]
    const avgLevel = characters.reduce((s, c) => s + c.level, 0) / characters.length
    const minCrNum = Math.max(0, avgLevel / 4 - 1)
    const maxCrNum = Math.min(30, avgLevel * 2)
    const eligible = allMonsters.filter(m => {
      const crNum = CR_NUM[m.cr] ?? 0
      return crNum >= minCrNum && crNum <= maxCrNum && m.xp > 0
    })
    if (eligible.length === 0) return
    const entries: { monster: MonsterTemplate; count: number }[] = []
    let spent = 0
    let attempts = 0
    while (spent < budget * 0.8 && attempts < 30) {
      attempts++
      const m = eligible[Math.floor(Math.random() * eligible.length)]
      if (m.xp > budget * 1.5) continue
      const existing = entries.find(e => e.monster.name === m.name)
      if (existing) {
        existing.count++
      } else {
        entries.push({ monster: m, count: 1 })
      }
      const totalCount = entries.reduce((s, e) => s + e.count, 0)
      const mult = encounterMultiplier(totalCount)
      spent = Math.floor(entries.reduce((s, e) => s + e.monster.xp * e.count, 0) * mult)
    }
    setEncounterEntries(entries)
    setShowGeneratePanel(false)
  }

  async function handleGroupRest(type: 'short' | 'long') {
    if (characters.length === 0) return
    setRestInProgress(true)
    try {
      if (type === 'long') {
        const updated = await Promise.all(characters.map(c => longRest(c.id)))
        updated.forEach(updateCharacter)
        const results = updated.map(c => ({ name: c.name, healed: c.combat.max_hp - (characters.find(x => x.id === c.id)?.combat.current_hp ?? c.combat.max_hp) }))
        if (restNotifTimer.current) clearTimeout(restNotifTimer.current)
        setRestNotif({ type: 'long', results })
        restNotifTimer.current = setTimeout(() => setRestNotif(null), 7000)
        logEvent('hp', `Long repos — tout le groupe récupère ses PV et emplacements de sort`)
      } else {
        const results: { name: string; healed: number }[] = []
        await Promise.all(characters.map(async c => {
          if (c.combat.hit_dice_remaining <= 0) { results.push({ name: c.name, healed: 0 }); return }
          const res = await shortRest(c.id, 1)
          updateCharacter(res.character)
          results.push({ name: c.name, healed: res.total_healed })
        }))
        if (restNotifTimer.current) clearTimeout(restNotifTimer.current)
        setRestNotif({ type: 'short', results })
        restNotifTimer.current = setTimeout(() => setRestNotif(null), 7000)
        logEvent('hp', `Court repos — ${results.map(r => `${r.name} +${r.healed} PV`).join(', ')}`)
      }
      setShowRestPanel(false)
    } catch (e) {
      // Le try n'existait que pour le finally : l'échec repartait en rejet non géré,
      // et le repos semblait n'avoir aucun effet.
      toast.error(e instanceof ApiError ? e.message : "Le repos du groupe a échoué.")
    } finally {
      setRestInProgress(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-stone-950">
      {/* ─────────── Plateau plein écran : la carte EST la page ───────────
          Barre du haut = gestion de la map (image, grille, pion, zones) fournie
          par le plateau lui-même ; ruban du bas = personnages ; le reste des
          outils vit dans un tiroir. Sans image de plateau, on garde le flux
          classique qui défile. */}
      {hasBattleImage && (
        // `h-[100dvh]` sans `fixed` : la vue reste dans le flux décalé par la barre
        // latérale (ml-14/ml-48 de AppLayout), donc la barre du haut n'est plus cachée
        // sous la sidebar.
        <div className="h-[100dvh] flex flex-col bg-stone-950">
          {/* Une seule barre en haut : les menus Map/Combattants/Pion/Zone (fournis par
              le plateau) à gauche, les actions de page à droite. Le ruban des
              personnages (barre fixe du bas) recouvre la base : on lui réserve la place. */}
          <div className="flex-1 min-h-0 px-3 sm:px-4 pt-3 pb-40">
            <BattleMapBoard
              map={campaign?.battle_map ?? null}
              combatants={combatants}
              characters={characters}
              editable
              fullscreen
              onChange={handleBattleMapChange}
              onCastZone={handleCastZone}
              locationMaps={locationMaps}
              onPickLocationMap={handlePickLocationMap}
              cameraKey={campaignId ?? undefined}
              activeRef={activeCombatant ? { kind: activeCombatant.kind, id: activeCombatant.data.id } : null}
              toolbarLead={
                <button
                  onClick={() => setShowAddEnemy(true)}
                  className="text-sm font-medium rounded-lg px-3 py-1.5 border bg-stone-800 border-stone-700 text-stone-300 hover:text-white hover:border-stone-500 transition-colors"
                  title="Ajouter des combattants : bestiaire, saisie manuelle ou constructeur de rencontre"
                >
                  👥 Combattants
                </button>
              }
              toolbarExtra={
                <>
                  {campaign?.combat_location && (
                    <span className="text-xs bg-stone-800 border border-stone-700 text-amber-300/90 rounded-lg px-2.5 py-1.5" title="Lieu du combat, montré aux joueurs">
                      📍 {campaign.combat_location}
                    </span>
                  )}
                  {/* Actions clés du combat, toujours à portée (plus besoin d'ouvrir le tiroir). */}
                  {(characters.length > 0 || combatants.length > 0) && (
                    <button
                      onClick={handleLaunchCombat}
                      className="text-xs font-medium rounded-lg px-3 py-1.5 border bg-amber-600/20 border-amber-600/40 text-amber-400 hover:bg-amber-600/40 transition-colors"
                      title="Ouvre le combat aux joueurs (chacun lance son initiative) et tire celle des PNJ"
                    >
                      ⚔ Lancer le combat
                    </button>
                  )}
                  {(characters.length > 0 || combatants.length > 0) && (
                    <button
                      onClick={handleDeleteCombat}
                      className="text-xs font-medium rounded-lg px-3 py-1.5 border bg-red-900/20 border-red-800/50 text-red-400 hover:bg-red-900/40 transition-colors"
                      title="Retire tous les combattants et efface les initiatives"
                    >
                      🗑 Supprimer le combat
                    </button>
                  )}
                  <button
                    onClick={() => { setShowCombatSummary(true); void setCombatActive(false) }}
                    className="text-xs font-medium rounded-lg px-3 py-1.5 border bg-amber-600/15 border-amber-700/40 text-amber-400 hover:bg-amber-600/30 transition-colors"
                    title="Résumé du combat et fermeture de l'accès joueurs"
                  >
                    ⚔ Fin du combat
                  </button>
                </>
              }
            />
          </div>
        </div>
      )}

      {/* Vue classique (sans plateau) : toute la gestion de combat défile ici. Avec un
          plateau, c'est le plein écran ci-dessus qui prend le relais — carte, actions
          clés dans la barre du haut, personnages dans le ruban du bas. */}
      {!hasBattleImage && (
      <main className={`${mainWidthClass} mx-auto px-4 py-8 pb-44 space-y-4`}>
        <h1 className="text-white text-xl font-display font-semibold tracking-wide">Combat</h1>


        {/* Combat timers — n'apparaît que s'il y a des effets ou une saisie en cours
            (le déclencheur « + Effet » vit dans le menu ⋯ de l'en-tête d'initiative). */}
        {(timers.length > 0 || showTimerForm) && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-stone-600 text-xs uppercase tracking-widest shrink-0">Effets</span>

              {/* Active timers */}
              {timers.map(t => {
                const urgent = t.rounds <= 1
                return (
                  <button
                    key={t.id}
                    onClick={() => setTimers(prev => prev.filter(x => x.id !== t.id))}
                    title="Cliquer pour supprimer"
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                      urgent
                        ? 'bg-red-900/40 border-red-700/60 text-red-300 hover:bg-red-900/60'
                        : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                    }`}
                  >
                    <span className="truncate max-w-[120px]">{t.name}</span>
                    <span className={`font-bold tabular-nums ${urgent ? 'text-red-400' : 'text-amber-400'}`}>
                      {t.rounds}R
                    </span>
                    <span className="text-stone-600 text-xs">×</span>
                  </button>
                )
              })}

              {/* Add timer */}
              {showTimerForm ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Nom de l'effet"
                    value={timerName}
                    onChange={e => setTimerName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const r = parseInt(timerRounds, 10)
                        if (timerName.trim() && r > 0) {
                          setTimers(prev => [...prev, { id: ++timerIdRef.current, name: timerName.trim(), rounds: r }])
                          setTimerName('')
                          setTimerRounds('1')
                          setShowTimerForm(false)
                        }
                      }
                      if (e.key === 'Escape') setShowTimerForm(false)
                    }}
                    autoFocus
                    className="w-36 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors"
                  />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={timerRounds}
                    onChange={e => setTimerRounds(e.target.value)}
                    className="w-14 bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-amber-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="R"
                  />
                  <button
                    onClick={() => {
                      const r = parseInt(timerRounds, 10)
                      if (timerName.trim() && r > 0) {
                        setTimers(prev => [...prev, { id: ++timerIdRef.current, name: timerName.trim(), rounds: r }])
                        setTimerName('')
                        setTimerRounds('1')
                        setShowTimerForm(false)
                      }
                    }}
                    className="bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded px-2 py-1 transition-colors"
                  >
                    +
                  </button>
                  <button
                    onClick={() => { setShowTimerForm(false); setTimerName('') }}
                    className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTimerForm(true)}
                  className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                  title="Ajouter un effet temporisé"
                >
                  + Effet
                </button>
              )}
            </div>

            {/* Expired alert */}
            {expiredAlert.length > 0 && (
              <div className="mt-2 pt-2 border-t border-stone-800">
                <p className="text-red-400 text-xs font-semibold">
                  ⏰ Expiré : {expiredAlert.join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Le résultat de jet (macro/sort) flotte désormais au-dessus de tout (voir
            plus bas) : en plein écran il doit rester visible même tiroir fermé. */}

        {/* Battle map — avec image, le plateau vit en plein écran (base) ; ici on ne
            garde que le panneau repliable servant à DÉFINIR une image quand il n'y en
            a pas encore. */}
        {!hasBattleImage && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowBattleMap(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-stone-800/40 transition-colors"
            >
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest flex items-center gap-2">
                🗺 Battle map
                {(campaign?.battle_map?.tokens.length ?? 0) > 0 && (
                  <span className="text-[10px] bg-stone-700 text-stone-300 rounded-full px-1.5 py-0.5 font-normal">{campaign?.battle_map?.tokens.length}</span>
                )}
                {!campaign?.share_token && (
                  <span className="text-[10px] text-stone-600 font-normal normal-case tracking-normal">— partagez la campagne pour la diffuser aux joueurs</span>
                )}
              </h2>
              <span className="text-stone-500 text-xs">{showBattleMap ? '▲' : '▼'}</span>
            </button>
            {showBattleMap && (
              <div className="px-5 pb-5 border-t border-stone-800 pt-4">
                <BattleMapBoard
                  map={campaign?.battle_map ?? null}
                  combatants={combatants}
                  characters={characters}
                  editable
                  onChange={handleBattleMapChange}
                  onCastZone={handleCastZone}
                  locationMaps={locationMaps}
                  onPickLocationMap={handlePickLocationMap}
                  cameraKey={campaignId ?? undefined}
                  activeRef={activeCombatant ? { kind: activeCombatant.kind, id: activeCombatant.data.id } : null}
                />
              </div>
            )}
          </div>
        )}

        {/* Initiative table */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          {/* La carte est en `overflow-hidden` : sans repli, les boutons de droite
              (« Fin du combat », « … ») sortaient de l'écran et devenaient inatteignables. */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-stone-800">
            <button
              onClick={() => setShowInitList(v => !v)}
              className="text-stone-400 hover:text-stone-200 text-xs font-semibold uppercase tracking-widest flex items-center gap-2 transition-colors"
              title="Liste détaillée — filet de secours ; les actions du tour sont dans la barre du bas"
            >
              <span>{showInitList ? '▾' : '▸'}</span>
              Ordre d'initiative
              <span className="text-stone-600 normal-case tracking-normal font-normal">({withRollDisplay.length})</span>
            </button>
            <div className="flex flex-wrap items-center gap-2">
              {displayRows.length > 4 && (
                <input
                  type="text"
                  value={combatTrackerSearch}
                  onChange={e => setCombatTrackerSearch(e.target.value)}
                  placeholder="Chercher…"
                  className="w-24 bg-stone-800 border border-stone-700 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-amber-500 transition-colors placeholder:text-stone-600"
                />
              )}
              {(characters.length > 0 || combatants.length > 0) && (
                <div className="flex gap-1.5">
                  {/* En plein écran, « Lancer le combat » vit dans la barre du haut. */}
                  {!hasBattleImage && (
                    <button
                      onClick={handleLaunchCombat}
                      className="bg-amber-600/20 hover:bg-amber-600/40 border border-amber-600/40 text-amber-400 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                      title="Ouvre le combat aux joueurs (chacun lance son initiative) et tire celle des PNJ"
                    >
                      ⚔ Lancer le combat
                    </button>
                  )}
                  {(characters.some(c => c.combat.initiative_roll == null) || combatants.some(cb => cb.initiative_roll == null)) && (
                    <button
                      onClick={() => handleRollAllInitiative(true)}
                      className="bg-stone-700/40 hover:bg-stone-700/70 border border-stone-600/40 text-stone-400 text-xs font-medium rounded-lg px-2.5 py-1.5 transition-colors"
                      title="Lance uniquement pour les participants sans initiative"
                    >
                      + Manquants
                    </button>
                  )}
                </div>
              )}
              {campaignId && combatants.some(c => c.current_hp <= 0) && characters.length > 0 && (
                <button
                  onClick={() => {
                    setShowXpPanel(v => !v)
                    if (!showXpPanel) {
                      const defaults: Record<number, string> = {}
                      combatants.filter(c => c.current_hp <= 0).forEach(c => {
                        const xp = xpForCombatant(c.id)
                        defaults[c.id] = xp > 0 ? String(xp) : ''
                      })
                      setXpInputs(defaults)
                    }
                  }}
                  className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                    showXpPanel
                      ? 'bg-emerald-700/30 border-emerald-600 text-emerald-400'
                      : 'bg-emerald-900/20 border-emerald-800/50 text-emerald-500 hover:border-emerald-700 hover:text-emerald-400'
                  }`}
                >
                  ✦ XP
                </button>
              )}
              {campaignId && combatants.some(c => c.current_hp <= 0) && (
                <button
                  onClick={handleClearDeadCombatants}
                  className="text-xs font-medium rounded-lg px-2.5 py-1.5 border bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-600/50 hover:text-amber-400 transition-colors"
                >
                  ☠ Retirer morts
                </button>
              )}
              {campaignId && combatants.length > 0 && (
                <button
                  onClick={handleClearCombatants}
                  className="text-xs font-medium rounded-lg px-2.5 py-1.5 border bg-stone-800 border-stone-700 text-stone-400 hover:border-red-700/60 hover:text-red-400 transition-colors"
                >
                  Vider ennemis
                </button>
              )}
              {/* En plein écran, « Fin du combat » vit dans la barre du haut. */}
              {!hasBattleImage && (characters.length > 0 || combatants.length > 0) && (
                <button
                  onClick={handleDeleteCombat}
                  className="text-xs font-medium rounded-lg px-3 py-1.5 border bg-red-900/20 border-red-800/50 text-red-400 hover:bg-red-900/40 transition-colors"
                  title="Retire tous les combattants et efface les initiatives"
                >
                  🗑 Supprimer le combat
                </button>
              )}
              {!hasBattleImage && (
                <button
                  onClick={() => { setShowCombatSummary(true); void setCombatActive(false) }}
                  className="text-xs font-medium rounded-lg px-3 py-1.5 border bg-amber-600/15 border-amber-700/40 text-amber-400 hover:bg-amber-600/30 transition-colors"
                >
                  ⚔ Fin du combat
                </button>
              )}

              {/* Utilitaires regroupés sous un menu ⋯ pour désencombrer l'en-tête */}
              <div className="relative">
                <button
                  onClick={() => setShowInitMenu(v => !v)}
                  title="Plus d'actions"
                  className={`text-sm rounded-lg px-2 py-1 border transition-colors ${showInitMenu ? 'bg-stone-700/50 border-stone-600 text-stone-200' : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'}`}
                >
                  ⋯
                </button>
                {showInitMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowInitMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-stone-900 border border-stone-700 rounded-lg shadow-xl py-1">
                      <button
                        onClick={() => { setShowTimerForm(true); setShowInitMenu(false) }}
                        className="w-full text-left px-3 py-1.5 text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition-colors"
                      >
                        ⏱ Ajouter un effet
                      </button>
                      <button
                        onClick={() => { setShowNotepad(v => !v); setShowInitMenu(false) }}
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-stone-800 ${showNotepad ? 'text-stone-200' : 'text-stone-400'}`}
                      >
                        📝 Notes{showNotepad ? ' ✓' : ''}
                      </button>
                      <button
                        onClick={() => { handleReset(); setShowInitMenu(false) }}
                        className="w-full text-left px-3 py-1.5 text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition-colors"
                      >
                        ↺ Réinitialiser
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {displayRows.length > 0 && combatants.length > 0 && (() => {
            const factions = [...new Set(combatants.map(c => c.faction))]
            return factions.length > 1 ? (
              <div className="flex gap-1.5 px-5 py-2 border-b border-stone-800/60 flex-wrap">
                {(['all', 'allié', 'ennemi', 'neutre'] as const).filter(f => f === 'all' || factions.includes(f as typeof factions[number])).map(f => {
                  const count = f === 'all' ? combatants.length : combatants.filter(c => c.faction === f).length
                  const labels = { all: `Tous (${count})`, allié: `🟢 Alliés (${count})`, ennemi: `🔴 Ennemis (${count})`, neutre: `🟡 Neutres (${count})` }
                  return (
                    <button key={f} onClick={() => setCombatFactionFilter(f)}
                      className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${combatFactionFilter === f ? 'bg-stone-700 border-stone-500 text-stone-100' : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'}`}>
                      {labels[f]}
                    </button>
                  )
                })}
              </div>
            ) : null
          })()}

          {displayRows.length === 0 ? (
            <div className="px-5 py-10 text-center text-stone-500 text-sm">
              Aucun combattant.{' '}
              <Link to="/characters" className="text-amber-400 hover:text-amber-300">
                Créer un personnage
              </Link>
            </div>
          ) : showInitList ? (
            <div className="divide-y divide-stone-800">
              {displayRows.filter(row => combatFactionFilter === 'all' || (row.kind === 'character' ? combatFactionFilter === 'allié' : row.data.faction === combatFactionFilter)).filter(row => !combatTrackerSearch || row.data.name.toLowerCase().includes(combatTrackerSearch.toLowerCase())).map((row, displayIdx) => {
                const isActive = withRollDisplay.length > 0 && activeCombatant && rowId(row) === rowId(activeCombatant)
                const position = withRollDisplay.findIndex(r => rowId(r) === rowId(row))

                if (row.kind === 'character') {
                  const character = row.data
                  const isDying = character.combat.current_hp <= 0
                  const hpPct = Math.max(0, Math.min(100,
                    (character.combat.current_hp / character.combat.max_hp) * 100,
                  ))

                  return (
                    <div
                      key={rowId(row)}
                      draggable={reordering}
                      onDragStart={reordering ? () => setDragRowId(rowId(row)) : undefined}
                      onDragOver={reordering ? e => { e.preventDefault(); setDragOverId(rowId(row)) } : undefined}
                      onDrop={reordering ? e => { e.preventDefault(); handleDrop(rowId(row)) } : undefined}
                      onDragEnd={reordering ? () => { setDragRowId(null); setDragOverId(null) } : undefined}
                      className={`px-5 py-4 transition-colors ${reordering ? 'cursor-grab' : ''} ${
                        reordering && dragRowId === rowId(row) ? 'opacity-40' :
                        reordering && dragOverId === rowId(row) && dragRowId !== rowId(row) ? 'border-t border-sky-500' :
                        isActive ? 'bg-amber-500/10 border-l-2 border-amber-500' :
                        'hover:bg-stone-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-4">
                        {/* Reorder handle */}
                        {reordering && !combatTrackerSearch && (
                          <div className="flex flex-col gap-0.5 shrink-0 select-none">
                            <button onClick={e => { e.stopPropagation(); moveRow(rowId(row), 'up') }} disabled={displayIdx === 0}
                              className="text-sky-400 hover:text-sky-200 disabled:text-stone-700 text-xs leading-none transition-colors px-0.5">▲</button>
                            <button onClick={e => { e.stopPropagation(); moveRow(rowId(row), 'down') }} disabled={displayIdx === displayRows.length - 1}
                              className="text-sky-400 hover:text-sky-200 disabled:text-stone-700 text-xs leading-none transition-colors px-0.5">▼</button>
                          </div>
                        )}

                        {/* AoE checkbox */}
                        {aoeMode && (
                          <input
                            type="checkbox"
                            checked={aoeSelected.has(rowId(row))}
                            onChange={() => toggleAoeSelect(rowId(row))}
                            className="w-4 h-4 shrink-0 accent-orange-500 cursor-pointer"
                          />
                        )}

                        {/* Position */}
                        <div className="w-6 shrink-0 text-center">
                          {position >= 0 ? (
                            <span className={`text-sm font-bold ${isActive ? 'text-amber-400' : 'text-stone-500'}`}>
                              {position + 1}
                            </span>
                          ) : (
                            <span className="text-stone-700 text-sm">—</span>
                          )}
                        </div>

                        {/* Initiative — 144 px de large écrasaient la colonne du nom à zéro
                            sur mobile, et rejetaient ses contrôles PV hors de l'écran. */}
                        <div className="w-24 sm:w-36 shrink-0">
                          <InitInput
                            value={character.combat.initiative_roll}
                            mod={character.combat.initiative}
                            onSet={roll => handleSetCharacterInitiative(character.id, roll)}
                          />
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            {character.portrait_url && (
                              <img
                                src={character.portrait_url}
                                alt={character.name}
                                className="w-7 h-7 rounded-full object-cover shrink-0 border border-stone-700"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                              />
                            )}
                            <Link
                              to={`/characters/${character.id}`}
                              className={`font-semibold truncate hover:underline basis-full sm:basis-auto ${
                                isActive ? 'text-amber-300' : isDying ? 'text-red-400' : 'text-white'
                              }`}
                            >
                              {character.name}
                            </Link>
                            {isDying && (
                              <span className="shrink-0 text-xs bg-red-900/60 border border-red-700/50 text-red-300 rounded px-1.5 py-0.5">
                                À terre
                              </span>
                            )}
                            {character.state.exhaustion_level > 0 && (
                              <span className={`shrink-0 text-xs rounded px-1.5 py-0.5 border ${
                                character.state.exhaustion_level <= 2 ? 'bg-amber-900/40 border-amber-700/50 text-amber-400' :
                                character.state.exhaustion_level <= 4 ? 'bg-orange-900/40 border-orange-700/50 text-orange-400' :
                                'bg-red-900/40 border-red-700/50 text-red-400'
                              }`} title={`Niveau d'épuisement ${character.state.exhaustion_level}`}>
                                Épuis. {character.state.exhaustion_level}
                              </span>
                            )}
                          </div>
                          <p className="text-stone-500 text-xs truncate mt-0.5">
                            {character.race} · {character.character_class} · Niv.{character.level}
                            {' · '}CA {character.combat.armor_class}
                            {' · '}PP {character.passive_perception}
                          </p>
                          {(character.damage_modifiers.resistances.length > 0 ||
                            character.damage_modifiers.immunities.length > 0 ||
                            character.damage_modifiers.vulnerabilities.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {character.damage_modifiers.resistances.length > 0 && (
                                <span
                                  title={`Résistances : ${character.damage_modifiers.resistances.join(', ')}`}
                                  className="text-xs bg-sky-900/60 border border-sky-700/50 text-sky-300 rounded px-1.5 py-0.5"
                                >
                                  R×{character.damage_modifiers.resistances.length}
                                </span>
                              )}
                              {character.damage_modifiers.immunities.length > 0 && (
                                <span
                                  title={`Immunités : ${character.damage_modifiers.immunities.join(', ')}`}
                                  className="text-xs bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 rounded px-1.5 py-0.5"
                                >
                                  I×{character.damage_modifiers.immunities.length}
                                </span>
                              )}
                              {character.damage_modifiers.vulnerabilities.length > 0 && (
                                <span
                                  title={`Vulnérabilités : ${character.damage_modifiers.vulnerabilities.join(', ')}`}
                                  className="text-xs bg-red-900/60 border border-red-700/50 text-red-300 rounded px-1.5 py-0.5"
                                >
                                  V×{character.damage_modifiers.vulnerabilities.length}
                                </span>
                              )}
                            </div>
                          )}
                          {character.state.concentrating_on && (
                            <div className="mt-1">
                              <button
                                onClick={async () => {
                                  const updated = await updateConcentration(character.id, null)
                                  updateCharacter(updated)
                                  logEvent('hp', `${character.name} : concentration sur "${character.state.concentrating_on}" relâchée`)
                                }}
                                title="Cliquer pour relâcher la concentration"
                                className="text-xs bg-violet-900/50 hover:bg-violet-900/80 border border-violet-700/50 text-violet-300 rounded px-1.5 py-0.5 transition-colors"
                              >
                                ◈ {character.state.concentrating_on}
                              </button>
                            </div>
                          )}
                          {/* Per-combatant effect badges (character) */}
                          {(() => {
                            const key = rowId(row)
                            const effects = combatantEffects[key] ?? []
                            if (effects.length === 0 && effectInput?.key !== key) return null
                            return (
                              <div className="flex flex-wrap gap-1 mt-1 items-center">
                                {effects.map(e => (
                                  <button key={e.id}
                                    onClick={() => setCombatantEffects(prev => ({ ...prev, [key]: (prev[key] ?? []).filter(x => x.id !== e.id) }))}
                                    title="Cliquer pour supprimer"
                                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${e.rounds <= 1 ? 'bg-red-900/40 border-red-700/50 text-red-300' : 'bg-sky-900/30 border-sky-700/40 text-sky-300'}`}
                                  >
                                    {e.name} <span className="font-bold">{e.rounds}R</span> ×
                                  </button>
                                ))}
                                {effectInput?.key === key && (
                                  <div className="flex items-center gap-1">
                                    <input autoFocus type="text" placeholder="Effet" value={effectInput.name}
                                      onChange={ev => setEffectInput(prev => prev ? { ...prev, name: ev.target.value } : prev)}
                                      onKeyDown={ev => {
                                        if (ev.key === 'Enter') { const r = parseInt(effectInput.rounds, 10); if (effectInput.name.trim() && r > 0) { setCombatantEffects(prev => ({ ...prev, [key]: [...(prev[key] ?? []), { id: ++effectIdRef.current, name: effectInput.name.trim(), rounds: r }] })); setEffectInput(null) } }
                                        if (ev.key === 'Escape') setEffectInput(null)
                                      }}
                                      className="w-28 bg-stone-800 border border-sky-700/50 rounded px-2 py-0.5 text-white text-xs focus:outline-none" />
                                    <input type="number" min={1} max={99} value={effectInput.rounds}
                                      onChange={ev => setEffectInput(prev => prev ? { ...prev, rounds: ev.target.value } : prev)}
                                      className="w-10 bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-white text-xs text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    <button onClick={() => { const r = parseInt(effectInput.rounds, 10); if (effectInput.name.trim() && r > 0) { setCombatantEffects(prev => ({ ...prev, [key]: [...(prev[key] ?? []), { id: ++effectIdRef.current, name: effectInput.name.trim(), rounds: r }] })) } setEffectInput(null) }} className="text-sky-400 text-xs px-1.5 rounded bg-stone-700 hover:bg-stone-600">✓</button>
                                    <button onClick={() => setEffectInput(null)} className="text-stone-500 text-xs">✕</button>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                          {character.attack_macros.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {character.attack_macros.map((macro, mi) => (
                                <span key={mi} className="inline-flex items-center gap-0.5">
                                  <button
                                    onClick={() => handleRollMacro(character, macro, 'attack')}
                                    title={`Attaque: 1d20${macro.attack_bonus != null ? (macro.attack_bonus >= 0 ? '+' : '') + macro.attack_bonus : ''}`}
                                    className="text-xs bg-rose-900/50 border border-rose-700/40 text-rose-300 rounded-l px-1.5 py-0.5 hover:bg-rose-800/60 transition-colors"
                                  >
                                    {macro.name}
                                  </button>
                                  <button
                                    onClick={() => handleRollMacro(character, macro, 'damage')}
                                    title={`Dégâts: ${macro.damage_dice}`}
                                    className="text-xs bg-orange-900/50 border border-orange-700/40 text-orange-300 rounded-r px-1.5 py-0.5 hover:bg-orange-800/60 transition-colors"
                                  >
                                    {macro.damage_dice}
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Sorts préparés (et tours de magie) */}
                          {(() => {
                            const castable = character.spellcasting.spells.filter(s => s.prepared || s.level === 0)
                            if (castable.length === 0) return null
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {castable.map((spell, si) => {
                                  const dice = spellDice(character, spell)
                                  // Le jet d'attaque a besoin du bonus d'incantation (donc de la
                                  // caractéristique) ; les DÉGÂTS ne sont qu'un lancer de dés et
                                  // restent lançables même sans caractéristique (ex. sort à JS).
                                  const canAttack = !!character.spellcasting.ability
                                  if (!dice && !canAttack) {
                                    return (
                                      <span key={si} className="text-xs bg-violet-900/30 border border-violet-800/40 text-violet-300/90 rounded px-1.5 py-0.5">
                                        ✦ {spell.name}
                                        <SpellLevelBadge character={character} level={spell.level} />
                                      </span>
                                    )
                                  }
                                  return (
                                    <span key={si} className="inline-flex items-center gap-0.5">
                                      {canAttack ? (
                                        <button
                                          onClick={() => handleRollSpell(character, spell, 'attack')}
                                          title={`Attaque: 1d20${character.spellcasting.attack_bonus >= 0 ? '+' : ''}${character.spellcasting.attack_bonus} · DD ${character.spellcasting.save_dc}`}
                                          className={`text-xs bg-violet-900/50 border border-violet-700/40 text-violet-300 ${dice ? 'rounded-l' : 'rounded'} px-1.5 py-0.5 hover:bg-violet-800/60 transition-colors`}
                                        >
                                          ✦ {spell.name}
                                        </button>
                                      ) : (
                                        <span className="text-xs bg-violet-900/30 border border-violet-800/40 text-violet-300/90 rounded-l px-1.5 py-0.5">✦ {spell.name}</span>
                                      )}
                                      {dice && (
                                        <button
                                          onClick={() => handleRollSpell(character, spell, 'damage')}
                                          title={`Dégâts: ${dice}`}
                                          className="text-xs bg-indigo-900/50 border border-indigo-700/40 text-indigo-300 rounded-r px-1.5 py-0.5 hover:bg-indigo-800/60 transition-colors"
                                        >
                                          {dice}
                                        </button>
                                      )}
                                      <SpellLevelBadge character={character} level={spell.level} />
                                    </span>
                                  )
                                })}
                              </div>
                            )
                          })()}

                          {/* Emplacements de sort */}
                          <SpellSlots character={character} onUse={(lvl, action) => handleUseSlot(character, lvl, action)} className="mt-1.5" />

                          {/* Mobile HP controls */}
                          <div className="sm:hidden flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>{character.combat.current_hp}</span>
                            <span className="text-stone-500 text-xs">/ {character.combat.max_hp}</span>
                            <div className="ml-auto flex items-center gap-1">
                              <input
                                type="number"
                                value={charHpInputs[character.id] ?? ''}
                                min={1}
                                onChange={e => setCharHpInputs(prev => ({ ...prev, [character.id]: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') handleCharacterHp(character, 'damage') }}
                                placeholder="PV"
                                className="w-12 bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button onClick={() => handleCharacterHp(character, 'damage')}
                                className="bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-300 text-xs rounded px-1.5 py-0.5 transition-colors">Dmg</button>
                              <button onClick={() => handleCharacterHp(character, 'heal')}
                                className="bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-700/50 text-emerald-300 text-xs rounded px-1.5 py-0.5 transition-colors">Soin</button>
                            </div>
                          </div>
                        </div>

                        {/* HP */}
                        <div className="w-44 shrink-0 hidden sm:block">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
                              {character.combat.current_hp}
                            </span>
                            <span className="text-stone-500 text-xs">/ {character.combat.max_hp}</span>
                            {character.combat.temporary_hp > 0 && (
                              <span className="text-sky-400 text-xs font-semibold">
                                +{character.combat.temporary_hp} tmp
                              </span>
                            )}
                          </div>
                          <div className="h-2 bg-stone-700 rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${hpColor(character.combat.current_hp, character.combat.max_hp)}`}
                              style={{ width: `${hpPct}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              value={charTempHpInputs[character.id] ?? ''}
                              onChange={e => setCharTempHpInputs(prev => ({ ...prev, [character.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleSetCharacterTempHp(character) }}
                              placeholder="PV tmp"
                              className="w-16 bg-stone-800 border border-stone-700 rounded px-1.5 py-1 text-white text-xs text-center focus:outline-none focus:border-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => handleSetCharacterTempHp(character)}
                              className="bg-sky-900/60 hover:bg-sky-800/80 border border-sky-700/50 text-sky-300 text-xs rounded px-1.5 py-1 transition-colors"
                            >
                              Tmp
                            </button>
                          </div>
                        </div>

                        {/* Conditions + Effets */}
                        <div className="hidden lg:flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setExpandedCharacterConditions(expandedCharacterConditions === character.id ? null : character.id)}
                            className={`text-xs rounded px-2 py-1 border transition-colors ${
                              character.state.conditions.length > 0
                                ? 'bg-purple-900/60 border-purple-700/50 text-purple-300 hover:bg-purple-800/60'
                                : 'bg-stone-800 border-stone-700 text-stone-600 hover:text-stone-400'
                            }`}
                          >
                            {character.state.conditions.length > 0
                              ? character.state.conditions.map(c => CONDITIONS_FR[c] ?? c).join(', ')
                              : '+ Condition'}
                          </button>
                          <button
                            onClick={() => setEffectInput({ key: rowId(row), name: '', rounds: '1' })}
                            title="Ajouter un effet temporaire (rounds)"
                            className="text-xs rounded px-2 py-1 border bg-stone-800 border-stone-700 text-stone-600 hover:text-sky-400 hover:border-sky-700/50 transition-colors"
                          >
                            ⏱ Effet
                          </button>
                        </div>

                        {/* Inspiration + action economy */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleToggleInspiration(character)}
                            title={character.combat.inspiration ? 'Retirer l\'inspiration' : 'Accorder l\'inspiration'}
                            className={`w-6 h-6 rounded text-xs border transition-colors ${
                              character.combat.inspiration
                                ? 'bg-amber-500/30 border-amber-500 text-amber-300'
                                : 'bg-stone-800 border-stone-700 text-stone-600 hover:text-amber-500 hover:border-amber-600/50'
                            }`}
                          >
                            ✦
                          </button>
                          {(['action', 'bonus', 'reaction'] as const).map(type => {
                            const key = rowId(row)
                            const used = getActions(key)[type]
                            return (
                              <button
                                key={type}
                                onClick={() => toggleAction(key, type)}
                                title={type === 'action' ? 'Action' : type === 'bonus' ? 'Action bonus' : 'Réaction'}
                                className={`w-6 h-6 rounded text-xs font-bold border transition-colors ${
                                  used
                                    ? 'bg-stone-800 border-stone-700 text-stone-600 line-through'
                                    : type === 'action'
                                      ? 'bg-amber-600/20 border-amber-600/50 text-amber-400 hover:bg-amber-600/30'
                                      : type === 'bonus'
                                        ? 'bg-sky-600/20 border-sky-600/50 text-sky-400 hover:bg-sky-600/30'
                                        : 'bg-rose-600/20 border-rose-600/50 text-rose-400 hover:bg-rose-600/30'
                                }`}
                              >
                                {type === 'action' ? 'A' : type === 'bonus' ? 'B' : 'R'}
                              </button>
                            )
                          })}
                        </div>

                        {/* Sheet link */}
                        <Link
                          to={`/characters/${character.id}`}
                          className="text-stone-600 hover:text-stone-400 transition-colors shrink-0 text-sm"
                          title="Ouvrir la fiche"
                        >
                          ↗
                        </Link>
                      </div>

                      {/* Death saves panel */}
                      {isDying && (
                        <div className="mt-3 pt-3 border-t border-red-900/40 flex items-center gap-4">
                          {character.state.death_saves_successes >= 3 ? (
                            <span className="text-emerald-400 text-xs font-semibold">✓ Stabilisé</span>
                          ) : character.state.death_saves_failures >= 3 ? (
                            <span className="text-red-400 text-xs font-semibold">✕ Mort</span>
                          ) : (
                            <>
                              <span className="text-stone-500 text-xs shrink-0">Jets de mort</span>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  <span className="text-stone-600 text-xs mr-1">✓</span>
                                  {[1, 2, 3].map(n => (
                                    <button
                                      key={n}
                                      onClick={() => handleDeathSave(character, 'successes',
                                        character.state.death_saves_successes === n ? n - 1 : n,
                                      )}
                                      className={`w-5 h-5 rounded-full border-2 transition-colors ${
                                        n <= character.state.death_saves_successes
                                          ? 'bg-emerald-500 border-emerald-400'
                                          : 'bg-transparent border-stone-600 hover:border-emerald-600'
                                      }`}
                                      title={`${n} succès`}
                                    />
                                  ))}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-stone-600 text-xs mr-1">✕</span>
                                  {[1, 2, 3].map(n => (
                                    <button
                                      key={n}
                                      onClick={() => handleDeathSave(character, 'failures',
                                        character.state.death_saves_failures === n ? n - 1 : n,
                                      )}
                                      className={`w-5 h-5 rounded-full border-2 transition-colors ${
                                        n <= character.state.death_saves_failures
                                          ? 'bg-red-500 border-red-400'
                                          : 'bg-transparent border-stone-600 hover:border-red-600'
                                      }`}
                                      title={`${n} échec${n > 1 ? 's' : ''}`}
                                    />
                                  ))}
                                </div>
                                <button
                                  onClick={() => handleDeathSave(character, 'successes', 3)}
                                  className="text-emerald-600 hover:text-emerald-400 text-xs transition-colors ml-1"
                                  title="Marquer stable"
                                >
                                  Stable
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Character condition picker (expanded) */}
                      {expandedCharacterConditions === character.id && (
                        <div className="mt-3 pt-3 border-t border-stone-800">
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(CONDITIONS_FR).map(([key]) => {
                              const active = character.state.conditions.includes(key)
                              const duration = character.state.condition_durations[key]
                              return (
                                <div key={key} className="flex items-center gap-0.5">
                                  <ConditionTag
                                    condition={key}
                                    active={active}
                                    duration={duration}
                                    onClick={() => {
                                      const d = parseInt(characterConditionDurationDraft[key] ?? '', 10)
                                      handleToggleCharacterCondition(character.id, key, isNaN(d) ? undefined : d)
                                    }}
                                    className={`rounded-l px-2 py-1 text-xs font-medium transition-colors ${
                                      active
                                        ? 'bg-purple-600 border border-purple-500 text-white'
                                        : 'bg-stone-800 border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-300'
                                    }`}
                                  />
                                  {!active && (
                                    <input
                                      type="number"
                                      min={1}
                                      max={99}
                                      placeholder="∞"
                                      value={characterConditionDurationDraft[key] ?? ''}
                                      onChange={e => setCharacterConditionDurationDraft(d => ({ ...d, [key]: e.target.value }))}
                                      className="w-10 rounded-r bg-stone-700 border border-l-0 border-stone-600 px-1 py-1 text-stone-300 text-xs text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      title="Durée en rounds (optionnel)"
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                          <p className="text-stone-700 text-xs mt-2">Entrer une durée en rounds avant d'activer (optionnel)</p>
                        </div>
                      )}
                    </div>
                  )
                }

                // Combatant row
                const cb = row.data
                const isDying = cb.current_hp <= 0
                const hpPct = Math.max(0, Math.min(100, (cb.current_hp / cb.max_hp) * 100))
                const hpInput = combatantHpInputs[cb.id] ?? ''

                return (
                  <div
                    key={rowId(row)}
                    draggable={reordering}
                    onDragStart={reordering ? () => setDragRowId(rowId(row)) : undefined}
                    onDragOver={reordering ? e => { e.preventDefault(); setDragOverId(rowId(row)) } : undefined}
                    onDrop={reordering ? e => { e.preventDefault(); handleDrop(rowId(row)) } : undefined}
                    onDragEnd={reordering ? () => { setDragRowId(null); setDragOverId(null) } : undefined}
                    className={`px-5 py-4 transition-colors ${reordering ? 'cursor-grab' : ''} ${
                      reordering && dragRowId === rowId(row) ? 'opacity-40' :
                      reordering && dragOverId === rowId(row) && dragRowId !== rowId(row) ? 'border-t border-sky-500' :
                      isActive ? 'bg-red-500/10 border-l-2 border-red-500' :
                      'hover:bg-stone-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-4">
                      {/* Reorder handle */}
                      {reordering && (
                        <div className="flex flex-col gap-0.5 shrink-0 select-none">
                          <button onClick={e => { e.stopPropagation(); moveRow(rowId(row), 'up') }} disabled={displayIdx === 0}
                            className="text-sky-400 hover:text-sky-200 disabled:text-stone-700 text-xs leading-none transition-colors px-0.5">▲</button>
                          <button onClick={e => { e.stopPropagation(); moveRow(rowId(row), 'down') }} disabled={displayIdx === displayRows.length - 1}
                            className="text-sky-400 hover:text-sky-200 disabled:text-stone-700 text-xs leading-none transition-colors px-0.5">▼</button>
                        </div>
                      )}

                      {/* AoE checkbox */}
                      {aoeMode && (
                        <input
                          type="checkbox"
                          checked={aoeSelected.has(rowId(row))}
                          onChange={() => toggleAoeSelect(rowId(row))}
                          className="w-4 h-4 shrink-0 accent-orange-500 cursor-pointer"
                        />
                      )}

                      {/* Position */}
                      <div className="w-6 shrink-0 text-center">
                        {position >= 0 ? (
                          <span className={`text-sm font-bold ${isActive ? 'text-red-400' : 'text-stone-500'}`}>
                            {position + 1}
                          </span>
                        ) : (
                          <span className="text-stone-700 text-sm">—</span>
                        )}
                      </div>

                      {/* Initiative — cf. la rangée des personnages : étroite sur mobile. */}
                      <div className="w-24 sm:w-36 shrink-0">
                        <InitInput
                          value={cb.initiative_roll}
                          mod={0}
                          onSet={roll => handleSetCombatantInitiative(cb.id, roll)}
                        />
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          {renamingCombatantId === cb.id ? (
                            <form
                              onSubmit={e => { e.preventDefault(); handleRenameCombatant(cb.id) }}
                              className="flex items-center gap-1 min-w-0"
                            >
                              <input
                                autoFocus
                                value={renameDraft}
                                onChange={e => setRenameDraft(e.target.value)}
                                onBlur={() => { if (renameDraft.trim()) handleRenameCombatant(cb.id); else setRenamingCombatantId(null) }}
                                onKeyDown={e => { if (e.key === 'Escape') setRenamingCombatantId(null) }}
                                className="bg-stone-700 border border-stone-500 rounded px-2 py-0.5 text-white text-sm font-semibold focus:outline-none focus:border-amber-500 w-36"
                              />
                            </form>
                          ) : (
                            <button
                              onClick={() => {
                                const m = (campaign?.custom_monsters ?? []).find(m => m.name === cb.name)
                                if (m) setMonsterPopup(m)
                              }}
                              onDoubleClick={() => { setRenamingCombatantId(cb.id); setRenameDraft(cb.name) }}
                              title={(campaign?.custom_monsters ?? []).some(m => m.name === cb.name) ? 'Voir les stats — double-clic pour renommer' : 'Double-clic pour renommer'}
                              className={`font-semibold truncate text-left basis-full sm:basis-auto ${(campaign?.custom_monsters ?? []).some(m => m.name === cb.name) ? 'hover:underline cursor-pointer' : 'cursor-default'} ${isActive ? 'text-red-300' : isDying ? 'text-red-400' : 'text-white'}`}
                            >
                              {cb.name}
                            </button>
                          )}
                          <button
                            onClick={() => handleCycleFaction(cb.id)}
                            title="Changer la faction"
                            className={`shrink-0 text-xs rounded px-1.5 py-0.5 transition-opacity hover:opacity-70 ${
                              cb.faction === 'allié'
                                ? 'bg-emerald-900/40 border border-emerald-800/50 text-emerald-400'
                                : cb.faction === 'neutre'
                                  ? 'bg-stone-800 border border-stone-700 text-stone-400'
                                  : 'bg-red-900/40 border border-red-800/50 text-red-400'
                            }`}
                          >
                            {cb.faction === 'allié' ? 'Allié' : cb.faction === 'neutre' ? 'Neutre' : 'Ennemi'}
                          </button>
                          {isDying && (
                            <span className="shrink-0 text-xs bg-stone-800 border border-stone-700 text-stone-400 rounded px-1.5 py-0.5">
                              À terre
                            </span>
                          )}
                        </div>
                        {cb.armor_class != null && (
                          <p className="text-stone-500 text-xs mt-0.5">CA {cb.armor_class}</p>
                        )}

                        {/* Mobile HP controls */}
                        <div className="sm:hidden flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>{cb.current_hp}</span>
                          <span className="text-stone-500 text-xs">/ {cb.max_hp}</span>
                          <div className="ml-auto flex items-center gap-1">
                            <input
                              type="number"
                              value={hpInput}
                              min={1}
                              onChange={e => setCombatantHpInputs(prev => ({ ...prev, [cb.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') handleCombatantHp(cb.id, 'damage') }}
                              placeholder="PV"
                              className="w-12 bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button onClick={() => handleCombatantHp(cb.id, 'damage')}
                              className="bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-300 text-xs rounded px-1.5 py-0.5 transition-colors">Dmg</button>
                            <button onClick={() => handleCombatantHp(cb.id, 'heal')}
                              className="bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-700/50 text-emerald-300 text-xs rounded px-1.5 py-0.5 transition-colors">Soin</button>
                          </div>
                        </div>
                      </div>

                      {/* HP + controls */}
                      <div className="w-48 shrink-0 hidden sm:block">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
                            {cb.current_hp}
                          </span>
                          <span className="text-stone-500 text-xs">/ {cb.max_hp}</span>
                        </div>
                        <div className="h-2 bg-stone-700 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${hpColor(cb.current_hp, cb.max_hp)}`}
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={hpInput}
                            min={1}
                            onChange={e => setCombatantHpInputs(prev => ({ ...prev, [cb.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') handleCombatantHp(cb.id, 'damage') }}
                            placeholder="PV"
                            className="w-14 bg-stone-800 border border-stone-700 rounded px-1.5 py-1 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => handleCombatantHp(cb.id, 'damage')}
                            className="bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-300 text-xs rounded px-1.5 py-1 transition-colors"
                          >
                            Dmg
                          </button>
                          <button
                            onClick={() => handleCombatantHp(cb.id, 'heal')}
                            className="bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-700/50 text-emerald-300 text-xs rounded px-1.5 py-1 transition-colors"
                          >
                            Soin
                          </button>
                        </div>
                      </div>

                      {/* Conditions + Effets (éditable) */}
                      <div className="hidden lg:flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => setExpandedConditions(expandedConditions === cb.id ? null : cb.id)}
                          className={`text-xs rounded px-2 py-1 border transition-colors ${
                            cb.conditions.length > 0
                              ? 'bg-purple-900/60 border-purple-700/50 text-purple-300 hover:bg-purple-800/60'
                              : 'bg-stone-800 border-stone-700 text-stone-600 hover:text-stone-400'
                          }`}
                        >
                          {cb.conditions.length > 0
                            ? cb.conditions.map(c => CONDITIONS_FR[c] ?? c).join(', ')
                            : '+ Condition'}
                        </button>
                        <button
                          onClick={() => setEffectInput({ key: rowId(row), name: '', rounds: '1' })}
                          title="Ajouter un effet temporaire (rounds)"
                          className="text-xs rounded px-2 py-1 border bg-stone-800 border-stone-700 text-stone-600 hover:text-sky-400 hover:border-sky-700/50 transition-colors"
                        >
                          ⏱ Effet
                        </button>
                      </div>

                      {/* Action economy */}
                      <div className="hidden md:flex items-center gap-1 shrink-0">
                        {(['action', 'bonus', 'reaction'] as const).map(type => {
                          const key = rowId(row)
                          const used = getActions(key)[type]
                          return (
                            <button
                              key={type}
                              onClick={() => toggleAction(key, type)}
                              title={type === 'action' ? 'Action' : type === 'bonus' ? 'Action bonus' : 'Réaction'}
                              className={`w-6 h-6 rounded text-xs font-bold border transition-colors ${
                                used
                                  ? 'bg-stone-800 border-stone-700 text-stone-600 line-through'
                                  : type === 'action'
                                    ? 'bg-amber-600/20 border-amber-600/50 text-amber-400 hover:bg-amber-600/30'
                                    : type === 'bonus'
                                      ? 'bg-sky-600/20 border-sky-600/50 text-sky-400 hover:bg-sky-600/30'
                                      : 'bg-rose-600/20 border-rose-600/50 text-rose-400 hover:bg-rose-600/30'
                              }`}
                            >
                              {type === 'action' ? 'A' : type === 'bonus' ? 'B' : 'R'}
                            </button>
                          )
                        })}
                      </div>

                      {/* Monster stat block toggle */}
                      {resolvedMonsters[cb.id] && (
                        <button
                          onClick={() => setExpandedMonster(expandedMonster === cb.id ? null : cb.id)}
                          className={`text-xs rounded px-2 py-1 border transition-colors shrink-0 ${
                            expandedMonster === cb.id
                              ? 'bg-stone-700 border-stone-500 text-stone-200'
                              : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                          }`}
                          title="Voir le bloc de stats"
                        >
                          📊
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteCombatant(cb.id)}
                        className="text-stone-700 hover:text-red-500 transition-colors shrink-0 text-sm"
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Monster stat block */}
                    {expandedMonster === cb.id && resolvedMonsters[cb.id] && (() => {
                      const m = resolvedMonsters[cb.id]
                      const hpStr = `${m.hp_dice}d${m.hp_sides}${m.hp_bonus > 0 ? `+${m.hp_bonus}` : m.hp_bonus < 0 ? m.hp_bonus : ''}`
                      const atkBonus = crToAttackBonus(m.cr)
                      const dmg = crToDamageDice(m.cr)
                      const dmgStr = `${dmg.count}d${dmg.sides}${dmg.bonus >= 0 ? `+${dmg.bonus}` : dmg.bonus}`
                      return (
                        <div className="mt-3 pt-3 border-t border-stone-800 space-y-2">
                          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                            <span className="text-stone-500">CR <span className="text-stone-200 font-semibold">{m.cr}</span></span>
                            <span className="text-stone-500">CA <span className="text-stone-200 font-semibold">{m.ac}</span></span>
                            <span className="text-stone-500">PV <span className="text-stone-200 font-semibold">{hpStr} (moy. {m.hp_avg})</span></span>
                            <span className="text-stone-500">Init. <span className="text-stone-200 font-semibold">{m.initiative_mod >= 0 ? '+' : ''}{m.initiative_mod}</span></span>
                            <span className="text-stone-500">XP <span className="text-stone-200 font-semibold">{m.xp}</span></span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMonsterRoll(cb.id, m, 'attack')}
                              className="bg-rose-900/50 hover:bg-rose-800/60 border border-rose-700/50 text-rose-300 text-xs rounded-lg px-3 py-1.5 transition-colors font-medium"
                              title={`1d20 + ${atkBonus}`}
                            >
                              ⚔ Attaque {sign(atkBonus)}
                            </button>
                            <button
                              onClick={() => handleMonsterRoll(cb.id, m, 'damage')}
                              className="bg-orange-900/50 hover:bg-orange-800/60 border border-orange-700/50 text-orange-300 text-xs rounded-lg px-3 py-1.5 transition-colors font-medium"
                              title={dmgStr}
                            >
                              💥 Dégâts {dmgStr}
                            </button>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Condition picker (expanded) */}
                    {expandedConditions === cb.id && (
                      <div className="mt-3 pt-3 border-t border-stone-800">
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(CONDITIONS_FR).map(([key]) => {
                            const active = cb.conditions.includes(key)
                            const duration = cb.condition_durations[key]
                            return (
                              <div key={key} className="flex items-center gap-0.5">
                                <ConditionTag
                                  condition={key}
                                  active={active}
                                  duration={duration}
                                  onClick={() => {
                                    const d = parseInt(conditionDurationDraft[key] ?? '', 10)
                                    handleToggleCombatantCondition(cb.id, key, isNaN(d) ? undefined : d)
                                  }}
                                  className={`rounded-l px-2 py-1 text-xs font-medium transition-colors ${
                                    active
                                      ? 'bg-purple-600 border border-purple-500 text-white'
                                      : 'bg-stone-800 border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-300'
                                  }`}
                                />
                                {!active && (
                                  <input
                                    type="number"
                                    min={1}
                                    max={99}
                                    placeholder="∞"
                                    value={conditionDurationDraft[key] ?? ''}
                                    onChange={e => setConditionDurationDraft(d => ({ ...d, [key]: e.target.value }))}
                                    className="w-10 rounded-r bg-stone-700 border border-l-0 border-stone-600 px-1 py-1 text-stone-300 text-xs text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    title="Durée en rounds (optionnel)"
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-stone-700 text-xs mt-2">Entrer une durée en rounds avant d'activer (optionnel)</p>
                      </div>
                    )}

                    {/* Per-combatant effects (combatant row) */}
                    {(() => {
                      const key = rowId(row)
                      const effects = combatantEffects[key] ?? []
                      if (effects.length === 0 && effectInput?.key !== key) return null
                      return (
                        <div className="mt-2 pt-2 border-t border-stone-800/60 flex flex-wrap gap-1.5 items-center">
                          {effects.map(e => (
                            <button key={e.id}
                              onClick={() => setCombatantEffects(prev => ({ ...prev, [key]: (prev[key] ?? []).filter(x => x.id !== e.id) }))}
                              title="Cliquer pour supprimer"
                              className={`text-xs px-2 py-0.5 rounded border transition-colors ${e.rounds <= 1 ? 'bg-red-900/40 border-red-700/50 text-red-300' : 'bg-sky-900/30 border-sky-700/40 text-sky-300'}`}
                            >
                              {e.name} <span className="font-bold">{e.rounds}R</span> ×
                            </button>
                          ))}
                          {effectInput?.key === key && (
                            <div className="flex items-center gap-1">
                              <input autoFocus type="text" placeholder="Effet" value={effectInput.name}
                                onChange={ev => setEffectInput(prev => prev ? { ...prev, name: ev.target.value } : prev)}
                                onKeyDown={ev => {
                                  if (ev.key === 'Enter') { const r = parseInt(effectInput.rounds, 10); if (effectInput.name.trim() && r > 0) { setCombatantEffects(prev => ({ ...prev, [key]: [...(prev[key] ?? []), { id: ++effectIdRef.current, name: effectInput.name.trim(), rounds: r }] })); setEffectInput(null) } }
                                  if (ev.key === 'Escape') setEffectInput(null)
                                }}
                                className="w-28 bg-stone-800 border border-sky-700/50 rounded px-2 py-0.5 text-white text-xs focus:outline-none" />
                              <input type="number" min={1} max={99} value={effectInput.rounds}
                                onChange={ev => setEffectInput(prev => prev ? { ...prev, rounds: ev.target.value } : prev)}
                                className="w-10 bg-stone-800 border border-stone-700 rounded px-1 py-0.5 text-white text-xs text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              <button onClick={() => { const r = parseInt(effectInput.rounds, 10); if (effectInput.name.trim() && r > 0) { setCombatantEffects(prev => ({ ...prev, [key]: [...(prev[key] ?? []), { id: ++effectIdRef.current, name: effectInput.name.trim(), rounds: r }] })) } setEffectInput(null) }} className="text-sky-400 text-xs px-1.5 rounded bg-stone-700 hover:bg-stone-600">✓</button>
                              <button onClick={() => setEffectInput(null)} className="text-stone-500 text-xs">✕</button>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          ) : null}

          {/* La barre AoE « Zone » vit désormais dans le tiroir d'outils de groupe (barre du bas). */}

          {/* Add combatant section */}
          {campaignId && (
            <div className="border-t border-stone-800 px-5 py-3">
              {combatantError && (
                <p className="text-red-400 text-xs mb-2">⚠ {combatantError}</p>
              )}
              {!addingCombatant && !showBestiary && !showEncounterBuilder ? (
                <div className="flex items-center gap-4 flex-wrap">
                  <button
                    onClick={() => setAddingCombatant(true)}
                    className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors"
                  >
                    + Ajouter un ennemi / PNJ
                  </button>
                  <button
                    onClick={() => setShowBestiary(true)}
                    className="text-stone-500 hover:text-stone-300 text-xs font-medium transition-colors"
                  >
                    📚 Bestiaire SRD
                  </button>
                  <button
                    onClick={() => { setShowEncounterBuilder(true); setEncounterEntries([]) }}
                    className="text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors"
                  >
                    ⚔ Constructeur
                  </button>
                </div>
              ) : addingCombatant ? (
                <div className="space-y-3">
                  <p className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Nouveau combattant</p>
                  <div className="flex gap-1.5">
                    {(['ennemi', 'allié', 'neutre'] as CombatantFaction[]).map(f => (
                      <button
                        key={f}
                        onClick={() => setCombatantDraft(prev => ({ ...prev, faction: f }))}
                        className={`flex-1 text-xs font-semibold rounded-lg py-1.5 border transition-colors capitalize ${
                          combatantDraft.faction === f
                            ? f === 'ennemi'
                              ? 'bg-red-700/40 border-red-600 text-red-300'
                              : f === 'allié'
                                ? 'bg-emerald-700/40 border-emerald-600 text-emerald-300'
                                : 'bg-stone-700 border-stone-500 text-stone-300'
                            : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                        }`}
                      >
                        {f === 'ennemi' ? 'Ennemi' : f === 'allié' ? 'Allié' : 'Neutre'}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="col-span-2 sm:col-span-1 relative">
                      <input
                        type="text"
                        value={combatantDraft.name}
                        onChange={e => {
                          const val = e.target.value
                          setCombatantDraft(prev => ({ ...prev, name: val }))
                          if (val.length >= 2) {
                            setMonsterSuggestions(allMonsters.filter(m =>
                              m.name.toLowerCase().includes(val.toLowerCase())
                            ).slice(0, 6))
                          } else {
                            setMonsterSuggestions([])
                          }
                        }}
                        onBlur={() => setTimeout(() => setMonsterSuggestions([]), 150)}
                        placeholder="Nom *"
                        className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                      />
                      {monsterSuggestions.length > 0 && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded-lg shadow-xl overflow-hidden">
                          {monsterSuggestions.map(m => (
                            <button
                              key={m.name}
                              type="button"
                              onMouseDown={() => {
                                setCombatantDraft(prev => ({ ...prev, name: m.name, cr: m.cr, max_hp: String(m.hp_avg), ac: String(m.ac) }))
                                setMonsterSuggestions([])
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-stone-700 text-left transition-colors"
                            >
                              <span className="text-white text-sm">{m.name}</span>
                              <span className="text-stone-500 text-xs">CA {m.ac} · {m.hp_avg} PV · FP {m.cr}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      value={combatantDraft.max_hp}
                      onChange={e => setCombatantDraft(prev => ({ ...prev, max_hp: e.target.value }))}
                      placeholder="PV max *"
                      min={1}
                      className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <input
                      type="number"
                      value={combatantDraft.ac}
                      onChange={e => setCombatantDraft(prev => ({ ...prev, ac: e.target.value }))}
                      placeholder="CA"
                      className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <input
                      type="number"
                      value={combatantDraft.initiative}
                      onChange={e => setCombatantDraft(prev => ({ ...prev, initiative: e.target.value }))}
                      placeholder="Initiative"
                      className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {/* FP : c'est lui qui donnera l'XP en fin de combat, même pour une
                        créature inventée dont le nom n'existe dans aucun bestiaire. */}
                    <select
                      value={combatantDraft.cr}
                      onChange={e => setCombatantDraft(prev => ({ ...prev, cr: e.target.value }))}
                      title="Facteur de puissance — détermine l'XP accordée en fin de combat"
                      className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                    >
                      <option value="">FP (XP)…</option>
                      {CR_VALUES.map(cr => (
                        <option key={cr} value={cr}>FP {cr} · {crToXp(cr)} XP</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddCombatant}
                      disabled={!combatantDraft.name.trim() || !combatantDraft.max_hp}
                      className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
                    >
                      Ajouter
                    </button>
                    <button
                      onClick={() => { setAddingCombatant(false); setCombatantDraft({ name: '', faction: 'ennemi', max_hp: '', ac: '', initiative: '', cr: '' }); setMonsterSuggestions([]) }}
                      className="text-stone-500 hover:text-stone-300 text-sm transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : showBestiary ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Bestiaire SRD</p>
                    <button onClick={() => { setShowBestiary(false); setBestiarySearch(''); setBestiaryMinCr('0'); setBestiaryMaxCr('30') }} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">
                      Fermer
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Rechercher un monstre…"
                    value={bestiarySearch}
                    onChange={e => setBestiarySearch(e.target.value)}
                    autoFocus
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-stone-500 text-xs shrink-0">CR</span>
                    <select value={bestiaryMinCr} onChange={e => setBestiaryMinCr(e.target.value)}
                      className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500 transition-colors">
                      {CR_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <span className="text-stone-600 text-xs">—</span>
                    <select value={bestiaryMaxCr} onChange={e => setBestiaryMaxCr(e.target.value)}
                      className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500 transition-colors">
                      {CR_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    {(bestiaryMinCr !== '0' || bestiaryMaxCr !== '30') && (
                      <button onClick={() => { setBestiaryMinCr('0'); setBestiaryMaxCr('30') }}
                        className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Réinit.</button>
                    )}
                  </div>
                  {addedMonster && (
                    <p className="text-emerald-400 text-xs font-medium">✓ {addedMonster} ajouté au combat</p>
                  )}
                  {(() => {
                    const filtered = allMonsters.filter(m =>
                      m.name.toLowerCase().includes(bestiarySearch.toLowerCase()) &&
                      (CR_NUM[m.cr] ?? 0) >= (CR_NUM[bestiaryMinCr] ?? 0) &&
                      (CR_NUM[m.cr] ?? 0) <= (CR_NUM[bestiaryMaxCr] ?? 30)
                    )
                    return (
                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                    {filtered.map(m => (
                      <button
                        key={m.name}
                        onClick={() => handleAddMonster(m)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-stone-800 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-stone-500 text-xs w-8 shrink-0 font-mono">CR{m.cr}</span>
                          <span className="text-stone-200 text-sm truncate group-hover:text-white transition-colors">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-stone-500 text-xs">
                          <span>CA {m.ac}</span>
                          <span>{m.hp_dice > 0 ? `${m.hp_dice}d${m.hp_sides}${m.hp_bonus > 0 ? `+${m.hp_bonus}` : m.hp_bonus < 0 ? m.hp_bonus : ''}` : m.hp_bonus} PV</span>
                          <span className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">+ Ajouter</span>
                        </div>
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-stone-600 text-sm text-center py-4">Aucun monstre trouvé.</p>
                    )}
                  </div>
                    )
                  })()}
                </div>
              ) : showEncounterBuilder ? (() => {
                const totalRawXp = encounterEntries.reduce((s, e) => s + e.monster.xp * e.count, 0)
                const totalCount = encounterEntries.reduce((s, e) => s + e.count, 0)
                const multiplier = encounterMultiplier(totalCount)
                const adjustedXp = Math.floor(totalRawXp * multiplier)
                const partyThresholds = characters.reduce(
                  (acc, c) => {
                    const lvl = Math.max(1, Math.min(20, c.level))
                    const t = XP_THRESHOLDS[lvl] ?? XP_THRESHOLDS[1]
                    return [acc[0] + t[0], acc[1] + t[1], acc[2] + t[2], acc[3] + t[3]] as [number, number, number, number]
                  },
                  [0, 0, 0, 0] as [number, number, number, number],
                )
                const difficulty = encounterEntries.length > 0 ? encounterDifficultyLabel(adjustedXp, partyThresholds) : null
                const filteredMonsters = allMonsters
                  .filter(m =>
                    m.name.toLowerCase().includes(encounterSearch.toLowerCase()) &&
                    (CR_NUM[m.cr] ?? 0) >= (CR_NUM[encounterMinCr] ?? 0) &&
                    (CR_NUM[m.cr] ?? 0) <= (CR_NUM[encounterMaxCr] ?? 30)
                  )
                  .sort((a, b) => {
                    if (encounterMonsterSort === 'name') return a.name.localeCompare(b.name, 'fr')
                    if (encounterMonsterSort === 'cr_desc') return (CR_NUM[b.cr] ?? 0) - (CR_NUM[a.cr] ?? 0)
                    if (encounterMonsterSort === 'xp') return b.xp - a.xp
                    return (CR_NUM[a.cr] ?? 0) - (CR_NUM[b.cr] ?? 0)
                  })
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-violet-400 text-xs font-semibold uppercase tracking-widest">⚔ Constructeur de rencontre</p>
                      <div className="flex items-center gap-2">
                        {characters.length > 0 && (
                          <button
                            onClick={() => setShowGeneratePanel(v => !v)}
                            className={`text-xs transition-colors ${showGeneratePanel ? 'text-amber-400' : 'text-stone-500 hover:text-amber-400'}`}
                          >
                            ⚡ Générer
                          </button>
                        )}
                        {campaignId && (campaign?.saved_encounters?.length ?? 0) > 0 && (
                          <button
                            onClick={() => setShowSavedEncounters(v => !v)}
                            className={`text-xs transition-colors ${showSavedEncounters ? 'text-violet-400' : 'text-stone-500 hover:text-violet-400'}`}
                          >
                            Sauvegardées ({campaign!.saved_encounters!.length})
                          </button>
                        )}
                        <button
                          onClick={() => { setShowEncounterBuilder(false); setEncounterEntries([]); setEncounterSearch(''); setShowSavedEncounters(false) }}
                          className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
                        >
                          Fermer
                        </button>
                      </div>
                    </div>

                    {/* Random encounter generator */}
                    {showGeneratePanel && (
                      <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-3">
                        <p className="text-amber-400 text-xs font-semibold mb-2">Générer une rencontre aléatoire équilibrée</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(['facile', 'moyen', 'difficile', 'mortelle'] as const).map(d => (
                            <button
                              key={d}
                              onClick={() => setGenerateDifficulty(d)}
                              className={`text-xs rounded-lg px-3 py-1.5 border transition-colors capitalize ${
                                generateDifficulty === d
                                  ? 'bg-amber-800/40 border-amber-600/50 text-amber-200'
                                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/50'
                              }`}
                            >
                              {d.charAt(0).toUpperCase() + d.slice(1)}
                            </button>
                          ))}
                          <button
                            onClick={handleGenerateEncounter}
                            className="bg-amber-600 hover:bg-amber-500 text-black text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors ml-auto"
                          >
                            Générer
                          </button>
                        </div>
                        <p className="text-stone-600 text-xs mt-2">
                          Groupe : niv. moy. {characters.length > 0 ? Math.round(characters.reduce((s, c) => s + c.level, 0) / characters.length) : '?'} · {characters.length} PJ{characters.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    )}

                    {/* Saved encounters list */}
                    {showSavedEncounters && campaignId && (campaign?.saved_encounters?.length ?? 0) > 0 && (
                      <div className="bg-stone-800/60 rounded-lg p-2 space-y-1">
                        {(campaign!.saved_encounters!.length > 2) && (
                          <div className="flex gap-1.5 pb-1">
                            <input
                              type="text"
                              value={savedEncounterSearch}
                              onChange={e => setSavedEncounterSearch(e.target.value)}
                              placeholder="Rechercher…"
                              className="flex-1 bg-stone-700 border border-stone-600 rounded px-2 py-1 text-stone-200 text-xs placeholder-stone-500 focus:outline-none focus:border-violet-500 transition-colors"
                            />
                            <select
                              value={savedEncounterSort}
                              onChange={e => setSavedEncounterSort(e.target.value as typeof savedEncounterSort)}
                              className="bg-stone-700 border border-stone-600 rounded px-1.5 py-1 text-stone-300 text-xs focus:outline-none"
                            >
                              <option value="default">Défaut</option>
                              <option value="name">Nom A→Z</option>
                              <option value="difficulty">Difficulté</option>
                            </select>
                          </div>
                        )}
                        {campaign!.saved_encounters!
                          .map((saved, i) => ({ saved, i }))
                          .filter(({ saved }) => !savedEncounterSearch || saved.name.toLowerCase().includes(savedEncounterSearch.toLowerCase()))
                          .sort((a, b) => {
                            if (savedEncounterSort === 'name') return a.saved.name.localeCompare(b.saved.name, 'fr')
                            if (savedEncounterSort === 'difficulty') {
                              const order = ['facile', 'moyen', 'difficile', 'mortelle']
                              const da = computeEncounterDifficulty(a.saved.entries, characters.map(c => c.level)) ?? ''
                              const db = computeEncounterDifficulty(b.saved.entries, characters.map(c => c.level)) ?? ''
                              return order.indexOf(da) - order.indexOf(db)
                            }
                            return 0
                          })
                          .map(({ saved, i }) => {
                          const diff = computeEncounterDifficulty(saved.entries, characters.map(c => c.level))
                          return (
                          <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-stone-700/50 transition-colors">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-stone-200 text-xs font-medium truncate">{saved.name}</p>
                                {diff && <span className={`text-xs font-semibold shrink-0 ${difficultyColor(diff)}`}>{diff}</span>}
                              </div>
                              <p className="text-stone-500 text-xs truncate">
                                {saved.entries.map(e => `${e.count}× ${e.monster_name}${e.cr ? ` CR${e.cr}` : ''}`).join(', ')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleLoadSavedEncounter(saved)}
                                className="text-violet-400 hover:text-violet-300 text-xs transition-colors"
                              >
                                Charger
                              </button>
                              <button
                                onClick={() => handleDuplicateSavedEncounter(i)}
                                className="text-stone-600 hover:text-sky-400 text-xs transition-colors"
                                title="Dupliquer"
                              >⎘</button>
                              <button
                                onClick={() => handleDeleteSavedEncounter(i)}
                                className="text-stone-600 hover:text-red-400 text-xs transition-colors"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )})}
                      </div>
                    )}

                    {/* Monster search */}
                    <input
                      type="text"
                      placeholder="Ajouter un monstre…"
                      value={encounterSearch}
                      onChange={e => setEncounterSearch(e.target.value)}
                      autoFocus
                      className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-stone-500 text-xs shrink-0">CR</span>
                      <select value={encounterMinCr} onChange={e => setEncounterMinCr(e.target.value)}
                        className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors">
                        {CR_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <span className="text-stone-600 text-xs">—</span>
                      <select value={encounterMaxCr} onChange={e => setEncounterMaxCr(e.target.value)}
                        className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors">
                        {CR_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      {(encounterMinCr !== '0' || encounterMaxCr !== '30') && (
                        <button onClick={() => { setEncounterMinCr('0'); setEncounterMaxCr('30') }}
                          className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Réinit.</button>
                      )}
                      <select value={encounterMonsterSort} onChange={e => setEncounterMonsterSort(e.target.value as typeof encounterMonsterSort)}
                        className="ml-auto bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-xs focus:outline-none focus:border-violet-500 transition-colors">
                        <option value="cr_asc">CR ↑</option>
                        <option value="cr_desc">CR ↓</option>
                        <option value="xp">XP ↓</option>
                        <option value="name">Nom A→Z</option>
                      </select>
                    </div>

                    {encounterSearch && (
                      <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                        {filteredMonsters.slice(0, 12).map(m => (
                          <button
                            key={m.name}
                            onClick={() => {
                              setEncounterEntries(prev => {
                                const idx = prev.findIndex(e => e.monster.name === m.name)
                                if (idx >= 0) {
                                  const next = [...prev]
                                  next[idx] = { ...next[idx], count: next[idx].count + 1 }
                                  return next
                                }
                                return [...prev, { monster: m, count: 1 }]
                              })
                              setEncounterSearch('')
                            }}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded hover:bg-stone-800 transition-colors text-left group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-stone-500 text-xs w-8 shrink-0 font-mono">CR{m.cr}</span>
                              <span className="text-stone-200 text-sm truncate">{m.name}</span>
                            </div>
                            <span className="text-stone-500 text-xs shrink-0">{m.xp} XP</span>
                          </button>
                        ))}
                        {filteredMonsters.length === 0 && (
                          <p className="text-stone-600 text-sm text-center py-2">Aucun monstre trouvé.</p>
                        )}
                      </div>
                    )}

                    {/* Selected monsters */}
                    {encounterEntries.length > 0 && (
                      <div className="space-y-1.5">
                        {encounterEntries.map((entry, i) => (
                          <div key={entry.monster.name} className="flex items-center gap-3 bg-stone-800/60 rounded-lg px-3 py-2">
                            <span className="text-stone-500 text-xs font-mono w-8 shrink-0">CR{entry.monster.cr}</span>
                            <span className="flex-1 text-stone-200 text-sm min-w-0 truncate">{entry.monster.name}</span>
                            <span className="text-stone-500 text-xs shrink-0">{entry.monster.xp * entry.count} XP</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setEncounterEntries(prev => {
                                  const next = [...prev]
                                  if (next[i].count <= 1) return next.filter((_, j) => j !== i)
                                  next[i] = { ...next[i], count: next[i].count - 1 }
                                  return next
                                })}
                                className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs flex items-center justify-center transition-colors"
                              >
                                −
                              </button>
                              <span className="text-white text-sm w-5 text-center">{entry.count}</span>
                              <button
                                onClick={() => setEncounterEntries(prev => {
                                  const next = [...prev]
                                  next[i] = { ...next[i], count: next[i].count + 1 }
                                  return next
                                })}
                                className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs flex items-center justify-center transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Difficulty summary */}
                    {difficulty && (
                      <div className="flex items-center justify-between border-t border-stone-800 pt-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${difficultyColor(difficulty)}`}>{difficulty}</span>
                            <span className="text-stone-500 text-xs">
                              {adjustedXp} XP ajustés
                              {multiplier !== 1 && <span className="text-stone-600"> (×{multiplier} pour {totalCount} monstre{totalCount > 1 ? 's' : ''})</span>}
                            </span>
                          </div>
                          {characters.length > 0 && (
                            <p className="text-stone-600 text-xs">
                              Groupe : F {partyThresholds[0]} · M {partyThresholds[1]} · D {partyThresholds[2]} · ☠ {partyThresholds[3]}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleLaunchEncounter}
                          disabled={encounterEntries.length === 0}
                          className="bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white font-semibold text-sm rounded-lg px-4 py-2 transition-colors shrink-0"
                        >
                          Lancer →
                        </button>
                      </div>
                    )}

                    {campaignId && (
                      <div className="flex items-center gap-2 border-t border-stone-800 pt-3">
                        <input
                          type="text"
                          placeholder="Nom de la rencontre…"
                          value={saveEncounterName}
                          onChange={e => setSaveEncounterName(e.target.value)}
                          className="flex-1 min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                        />
                        <button
                          onClick={handleSaveEncounter}
                          disabled={!saveEncounterName.trim() || encounterEntries.length === 0}
                          className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-stone-200 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors shrink-0"
                        >
                          Sauvegarder
                        </button>
                      </div>
                    )}

                    {encounterEntries.length === 0 && (
                      <p className="text-stone-600 text-xs text-center py-2">Recherchez des monstres pour composer la rencontre.</p>
                    )}
                  </div>
                )
              })() : null}
            </div>
          )}
        </div>

        {/* Group saving throw panel */}
        {/* Le panneau « JS de groupe » vit désormais dans le tiroir d'outils de groupe (barre du bas). */}

        {/* XP distribution panel */}
        {showXpPanel && (() => {
          const deadCombatants = combatants.filter(c => c.current_hp <= 0)
          const total = Object.values(xpInputs).reduce((s, v) => s + (parseInt(v, 10) || 0), 0)
          const share = characters.length > 0 ? Math.floor(total / characters.length) : 0
          return (
            <div className="bg-stone-900 border border-emerald-800/40 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">
                  ✦ Distribution d'expérience
                </h2>
                <button onClick={() => setShowXpPanel(false)} className="text-stone-600 hover:text-stone-400 text-sm">×</button>
              </div>

              {xpResult ? (
                <div className="py-4 space-y-3">
                  <div className="text-center">
                    <p className="text-emerald-400 font-bold text-2xl">{xpResult.share} XP</p>
                    <p className="text-stone-400 text-sm mt-1">
                      par personnage ({xpResult.total} XP au total · {characters.length} joueur{characters.length > 1 ? 's' : ''})
                    </p>
                  </div>
                  {xpResult.levelUps.length > 0 && (
                    <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg px-4 py-3 text-center space-y-1">
                      <p className="text-amber-400 font-semibold text-sm">⬆ Montée de niveau disponible !</p>
                      <p className="text-amber-300/80 text-xs">
                        {xpResult.levelUps.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {deadCombatants.length === 0 ? (
                    <p className="text-stone-500 text-sm">Aucun ennemi vaincu pour le moment.</p>
                  ) : (
                    <div className="space-y-2">
                      {deadCombatants.map(c => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="flex-1 text-stone-300 text-sm">{c.name}</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="XP"
                            value={xpInputs[c.id] ?? ''}
                            onChange={e => setXpInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                            className="w-24 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm text-right focus:outline-none focus:border-emerald-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="text-stone-500 text-xs w-6">XP</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-stone-800">
                    <div className="text-sm">
                      {total > 0 && characters.length > 0 ? (
                        <span className="text-stone-300">
                          {total} XP ÷ {characters.length} = <span className="text-emerald-400 font-bold">{share} XP/joueur</span>
                        </span>
                      ) : (
                        <span className="text-stone-600">Renseignez les valeurs XP</span>
                      )}
                    </div>
                    <button
                      onClick={handleDistributeXp}
                      disabled={total <= 0 || characters.length === 0}
                      className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold text-sm rounded-lg px-5 py-2 transition-colors"
                    >
                      Distribuer
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* Le panneau « Repos du groupe » vit désormais dans le tiroir d'outils de groupe (barre du bas). */}

        {/* Rest notification */}
        {restNotif && (
          <div className={`border rounded-xl px-5 py-3 space-y-1 ${
            restNotif.type === 'long'
              ? 'bg-violet-950/40 border-violet-700/50'
              : 'bg-sky-950/40 border-sky-700/50'
          }`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${restNotif.type === 'long' ? 'text-violet-400' : 'text-sky-400'}`}>
              {restNotif.type === 'long' ? '✦ Long repos terminé' : '⛺ Court repos terminé'}
            </p>
            <div className="flex flex-wrap gap-3">
              {restNotif.results.map((r, i) => (
                <span key={i} className="text-stone-300 text-xs">
                  {r.name}{restNotif.type === 'short' && <span className={`ml-1 font-semibold ${r.healed > 0 ? 'text-emerald-400' : 'text-stone-500'}`}>{r.healed > 0 ? `+${r.healed} PV` : 'aucun DV'}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notepad */}
        {showNotepad && (
          <div className="bg-stone-900 border border-stone-700/60 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">📝 Notes de combat</h2>
              <div className="flex items-center gap-2">
                <MicButton onTranscript={text => {
                  const next = combatNotes ? combatNotes + '\n' + text : text
                  setCombatNotes(next)
                  try { localStorage.setItem(`taverne-combat-notes-${campaignId ?? 'default'}`, next) } catch { /* noop */ }
                }} />
                <button onClick={() => setShowNotepad(false)} className="text-stone-600 hover:text-stone-400 text-sm">×</button>
              </div>
            </div>
            <textarea
              value={combatNotes}
              onChange={e => {
                setCombatNotes(e.target.value)
                try { localStorage.setItem(`taverne-combat-notes-${campaignId ?? 'default'}`, e.target.value) } catch { /* noop */ }
              }}
              placeholder="Conditions spéciales, objectifs de rencontre, règles maison…"
              rows={5}
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-500 transition-colors resize-y font-mono"
            />
          </div>
        )}

        {/* Legend */}
        <p className="text-stone-600 text-xs text-center">
          Initiative modifiable · PV ennemis avec Dmg / Soin · Sync temps réel
        </p>

        {/* Combat log */}
        {combatLog.length > 0 && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowCombatLog(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 border-b border-stone-800 hover:bg-stone-800/40 transition-colors"
            >
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Journal de combat
                <span className="ml-2 text-stone-600 font-normal normal-case tracking-normal">({combatLog.length})</span>
              </h2>
              <div className="flex items-center gap-3">
                {campaignId && (
                  <button
                    onClick={e => { e.stopPropagation(); void handleSaveLogToSession() }}
                    disabled={savingLog}
                    className={`text-xs transition-colors ${logSaved ? 'text-emerald-400' : 'text-stone-600 hover:text-stone-400'}`}
                  >
                    {logSaved ? '✓ Sauvegardé' : savingLog ? '…' : '💾 Session'}
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setCombatLog([]) }}
                  className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
                >
                  Effacer
                </button>
                <span className="text-stone-600 text-xs">{showCombatLog ? '▲' : '▼'}</span>
              </div>
            </button>
            {showCombatLog && (
              <>
                {(() => {
                  const presentTypes = [...new Set(combatLog.map(e => e.type))]
                  const typeLabels: Record<string, string> = { turn: '⟳ Tours', roll: '🎲 Lancers', hp: '❤ PV', xp: '⬆ XP', join: '➕ Arrivées', condition: '✦ États', spell: '✦ Sorts' }
                  return presentTypes.length > 1 ? (
                    <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-2">
                      {(['all', ...presentTypes] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setLogTypeFilter(t)}
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${logTypeFilter === t ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}
                        >
                          {t === 'all' ? 'Tous' : typeLabels[t] ?? t}
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
              <div className="divide-y divide-stone-800/50 max-h-72 overflow-y-auto">
                {combatLog.filter(e => logTypeFilter === 'all' || e.type === logTypeFilter).map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-2">
                    <span className={`shrink-0 text-xs mt-0.5 ${
                      entry.type === 'turn' ? 'text-amber-500' :
                      entry.type === 'roll' ? 'text-rose-400' :
                      entry.type === 'hp'   ? 'text-sky-400' :
                      entry.type === 'xp'   ? 'text-emerald-400' :
                      entry.type === 'spell' ? 'text-violet-300' :
                                              'text-violet-400'
                    }`}>
                      {entry.type === 'turn' ? '⟳' :
                       entry.type === 'roll' ? '🎲' :
                       entry.type === 'hp'   ? '❤' :
                       entry.type === 'xp'   ? '⬆' :
                       entry.type === 'spell' ? '✦' : '➕'}
                    </span>
                    <span className="flex-1 text-stone-300 text-xs">{entry.text}</span>
                    <span className="shrink-0 text-stone-600 text-xs">{entry.time}</span>
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
        )}

        {/* Dice log */}
        {diceLog.length > 0 && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
                Journal des jets
              </h2>
              <button
                onClick={() => {
                  setDiceLog([])
                  if (campaignId) localStorage.removeItem(`taverne-dice-log-${campaignId}`)
                }}
                className="text-stone-600 hover:text-stone-400 text-xs transition-colors"
              >
                Effacer
              </button>
            </div>
            <div className="divide-y divide-stone-800/60 max-h-64 overflow-y-auto">
              {diceLog.map((roll, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="w-10 shrink-0 text-center">
                    <span className={`font-black text-lg ${
                      roll.total >= 20 && roll.sides === 20 ? 'text-amber-400' :
                      roll.total <= roll.sides * roll.count * 0.1 ? 'text-red-400' :
                      'text-white'
                    }`}>
                      {roll.total}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-stone-200 text-sm font-medium truncate">{roll.label}</p>
                    <p className="text-stone-500 text-xs">
                      {roll.character_name} · [{roll.rolls.join(', ')}]
                      {roll.modifier !== 0 && ` ${roll.modifier >= 0 ? '+' : ''}${roll.modifier}`}
                      {roll.advantage && ' · avantage'}
                      {roll.disadvantage && ' · désavantage'}
                    </p>
                  </div>
                  <span className="text-stone-600 text-xs shrink-0">
                    {new Date(roll.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      )}

      {/* Résultat de jet (macro/sort/monstre) — flotte au-dessus de tout pour rester
          visible aussi bien dans le flux classique qu'en plein écran. */}
      {macroResult && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[45] w-[min(92vw,26rem)] border rounded-xl px-5 py-3 flex items-center justify-between gap-4 shadow-2xl ${
          macroResult.isAttack ? 'bg-rose-950/90 border-rose-700/60' : 'bg-orange-950/90 border-orange-700/60'
        } backdrop-blur`}>
          <div className="min-w-0">
            <p className="text-stone-300 text-xs truncate">{macroResult.label}</p>
            <p className="text-stone-400 text-xs font-mono">{macroResult.detail}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-4xl font-black ${macroResult.isAttack ? 'text-rose-300' : 'text-orange-300'}`}>
              {macroResult.total}
            </span>
            <button onClick={() => setMacroResult(null)} className="text-stone-500 hover:text-stone-300 text-lg">×</button>
          </div>
        </div>
      )}

      {/* ─────────── Ajouter un ennemi (accès plein écran au bestiaire) ─────────── */}
      {showAddEnemy && campaignId && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setShowAddEnemy(false) }}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-xl w-full max-w-lg shadow-2xl my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
              <h2 className="text-stone-200 font-semibold text-base">👥 Combattants</h2>
              <button onClick={() => setShowAddEnemy(false)} className="text-stone-500 hover:text-stone-300 text-lg leading-none">✕</button>
            </div>
            <div className="flex gap-1 px-5 pt-3">
              {([['bestiary', '📚 Bestiaire'], ['manual', '✏ Manuel'], ['encounter', '⚔ Rencontre']] as [typeof enemyTab, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => setEnemyTab(t)}
                  className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${enemyTab === t ? 'bg-stone-700 border-stone-500 text-white' : 'bg-stone-800 border-stone-700 text-stone-400 hover:text-stone-200'}`}
                >{label}</button>
              ))}
            </div>
            <div className="px-5 py-4 space-y-4">
              {combatantError && <p className="text-red-400 text-xs">⚠ {combatantError}</p>}

              {/* Saisie manuelle rapide */}
              {enemyTab === 'manual' && (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  {(['ennemi', 'allié', 'neutre'] as CombatantFaction[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setCombatantDraft(prev => ({ ...prev, faction: f }))}
                      className={`flex-1 text-xs font-semibold rounded-lg py-1.5 border transition-colors ${
                        combatantDraft.faction === f
                          ? f === 'ennemi' ? 'bg-red-700/40 border-red-600 text-red-300'
                            : f === 'allié' ? 'bg-emerald-700/40 border-emerald-600 text-emerald-300'
                            : 'bg-stone-700 border-stone-500 text-stone-300'
                          : 'bg-stone-800 border-stone-700 text-stone-500 hover:text-stone-300'
                      }`}
                    >{f === 'ennemi' ? 'Ennemi' : f === 'allié' ? 'Allié' : 'Neutre'}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="col-span-2 sm:col-span-1 relative">
                    <input
                      type="text"
                      value={combatantDraft.name}
                      onChange={e => {
                        const val = e.target.value
                        setCombatantDraft(prev => ({ ...prev, name: val }))
                        setMonsterSuggestions(val.length >= 2 ? allMonsters.filter(m => m.name.toLowerCase().includes(val.toLowerCase())).slice(0, 6) : [])
                      }}
                      onBlur={() => setTimeout(() => setMonsterSuggestions([]), 150)}
                      placeholder="Nom *"
                      className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                    />
                    {monsterSuggestions.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-stone-800 border border-stone-700 rounded-lg shadow-xl overflow-hidden">
                        {monsterSuggestions.map(m => (
                          <button
                            key={m.name}
                            type="button"
                            onMouseDown={() => { setCombatantDraft(prev => ({ ...prev, name: m.name, cr: m.cr, max_hp: String(m.hp_avg), ac: String(m.ac) })); setMonsterSuggestions([]) }}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-stone-700 text-left transition-colors"
                          >
                            <span className="text-white text-sm">{m.name}</span>
                            <span className="text-stone-500 text-xs">CA {m.ac} · {m.hp_avg} PV · FP {m.cr}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" value={combatantDraft.max_hp} onChange={e => setCombatantDraft(prev => ({ ...prev, max_hp: e.target.value }))} placeholder="PV max *" min={1}
                    className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <input type="number" value={combatantDraft.ac} onChange={e => setCombatantDraft(prev => ({ ...prev, ac: e.target.value }))} placeholder="CA"
                    className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <select value={combatantDraft.cr} onChange={e => setCombatantDraft(prev => ({ ...prev, cr: e.target.value }))} title="Facteur de puissance — XP en fin de combat"
                    className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors">
                    <option value="">FP (XP)…</option>
                    {CR_VALUES.map(cr => <option key={cr} value={cr}>FP {cr} · {crToXp(cr)} XP</option>)}
                  </select>
                </div>
                <button
                  onClick={handleAddCombatant}
                  disabled={!combatantDraft.name.trim() || !combatantDraft.max_hp}
                  className="bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
                >Ajouter au combat</button>
              </div>
              )}

              {/* Bestiaire SRD — ajout en un clic (PV et initiative tirés automatiquement) */}
              {enemyTab === 'bestiary' && (
              <div className="space-y-2">
                {addedMonster && <p className="text-emerald-400 text-xs font-medium">✓ {addedMonster} ajouté au combat</p>}
                <input
                  type="text"
                  placeholder="Rechercher un monstre…"
                  value={bestiarySearch}
                  onChange={e => setBestiarySearch(e.target.value)}
                  className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-red-500 transition-colors"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-stone-500 text-xs shrink-0">CR</span>
                  <select value={bestiaryMinCr} onChange={e => setBestiaryMinCr(e.target.value)} className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500 transition-colors">
                    {CR_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <span className="text-stone-600 text-xs">—</span>
                  <select value={bestiaryMaxCr} onChange={e => setBestiaryMaxCr(e.target.value)} className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500 transition-colors">
                    {CR_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  {(bestiaryMinCr !== '0' || bestiaryMaxCr !== '30') && (
                    <button onClick={() => { setBestiaryMinCr('0'); setBestiaryMaxCr('30') }} className="text-stone-500 hover:text-stone-300 text-xs transition-colors">Réinit.</button>
                  )}
                </div>
                {(() => {
                  const filtered = allMonsters.filter(m =>
                    m.name.toLowerCase().includes(bestiarySearch.toLowerCase()) &&
                    (CR_NUM[m.cr] ?? 0) >= (CR_NUM[bestiaryMinCr] ?? 0) &&
                    (CR_NUM[m.cr] ?? 0) <= (CR_NUM[bestiaryMaxCr] ?? 30)
                  )
                  return (
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                      {filtered.map(m => (
                        <button
                          key={m.name}
                          onClick={() => handleAddMonster(m)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-stone-800 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-stone-500 text-xs w-8 shrink-0 font-mono">CR{m.cr}</span>
                            <span className="text-stone-200 text-sm truncate group-hover:text-white transition-colors">{m.name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-stone-500 text-xs">
                            <span>CA {m.ac}</span>
                            <span className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">+ Ajouter</span>
                          </div>
                        </button>
                      ))}
                      {filtered.length === 0 && <p className="text-stone-600 text-sm text-center py-4">Aucun monstre trouvé.</p>}
                    </div>
                  )
                })()}
              </div>
              )}

              {/* Constructeur de rencontre — composer plusieurs monstres, jauger la
                  difficulté, sauvegarder, puis tout lancer dans le combat d'un coup. */}
              {enemyTab === 'encounter' && (() => {
                const totalRawXp = encounterEntries.reduce((s, e) => s + e.monster.xp * e.count, 0)
                const totalCount = encounterEntries.reduce((s, e) => s + e.count, 0)
                const multiplier = encounterMultiplier(totalCount)
                const adjustedXp = Math.floor(totalRawXp * multiplier)
                const partyThresholds = characters.reduce(
                  (acc, c) => {
                    const t = XP_THRESHOLDS[Math.max(1, Math.min(20, c.level))] ?? XP_THRESHOLDS[1]
                    return [acc[0] + t[0], acc[1] + t[1], acc[2] + t[2], acc[3] + t[3]] as [number, number, number, number]
                  },
                  [0, 0, 0, 0] as [number, number, number, number],
                )
                const difficulty = encounterEntries.length > 0 ? encounterDifficultyLabel(adjustedXp, partyThresholds) : null
                const filteredMonsters = allMonsters
                  .filter(m =>
                    m.name.toLowerCase().includes(encounterSearch.toLowerCase()) &&
                    (CR_NUM[m.cr] ?? 0) >= (CR_NUM[encounterMinCr] ?? 0) &&
                    (CR_NUM[m.cr] ?? 0) <= (CR_NUM[encounterMaxCr] ?? 30)
                  )
                  .sort((a, b) => {
                    if (encounterMonsterSort === 'name') return a.name.localeCompare(b.name, 'fr')
                    if (encounterMonsterSort === 'cr_desc') return (CR_NUM[b.cr] ?? 0) - (CR_NUM[a.cr] ?? 0)
                    if (encounterMonsterSort === 'xp') return b.xp - a.xp
                    return (CR_NUM[a.cr] ?? 0) - (CR_NUM[b.cr] ?? 0)
                  })
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-end gap-3">
                      {characters.length > 0 && (
                        <button onClick={() => setShowGeneratePanel(v => !v)} className={`text-xs transition-colors ${showGeneratePanel ? 'text-amber-400' : 'text-stone-500 hover:text-amber-400'}`}>⚡ Générer</button>
                      )}
                      {campaignId && (campaign?.saved_encounters?.length ?? 0) > 0 && (
                        <button onClick={() => setShowSavedEncounters(v => !v)} className={`text-xs transition-colors ${showSavedEncounters ? 'text-violet-400' : 'text-stone-500 hover:text-violet-400'}`}>Sauvegardées ({campaign!.saved_encounters!.length})</button>
                      )}
                    </div>

                    {showGeneratePanel && (
                      <div className="bg-amber-950/30 border border-amber-800/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(['facile', 'moyen', 'difficile', 'mortelle'] as const).map(d => (
                            <button key={d} onClick={() => setGenerateDifficulty(d)}
                              className={`text-xs rounded-lg px-3 py-1.5 border transition-colors capitalize ${generateDifficulty === d ? 'bg-amber-800/40 border-amber-600/50 text-amber-200' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-700/50'}`}>
                              {d.charAt(0).toUpperCase() + d.slice(1)}
                            </button>
                          ))}
                          <button onClick={handleGenerateEncounter} className="bg-amber-600 hover:bg-amber-500 text-black text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors ml-auto">Générer</button>
                        </div>
                      </div>
                    )}

                    {showSavedEncounters && campaignId && (campaign?.saved_encounters?.length ?? 0) > 0 && (
                      <div className="bg-stone-800/60 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                        {campaign!.saved_encounters!.map((saved, i) => {
                          const diff = computeEncounterDifficulty(saved.entries, characters.map(c => c.level))
                          return (
                            <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-stone-700/50 transition-colors">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-stone-200 text-xs font-medium truncate">{saved.name}</p>
                                  {diff && <span className={`text-xs font-semibold shrink-0 ${difficultyColor(diff)}`}>{diff}</span>}
                                </div>
                                <p className="text-stone-500 text-xs truncate">{saved.entries.map(e => `${e.count}× ${e.monster_name}`).join(', ')}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => handleLoadSavedEncounter(saved)} className="text-violet-400 hover:text-violet-300 text-xs transition-colors">Charger</button>
                                <button onClick={() => handleDuplicateSavedEncounter(i)} className="text-stone-600 hover:text-sky-400 text-xs transition-colors" title="Dupliquer">⎘</button>
                                <button onClick={() => handleDeleteSavedEncounter(i)} className="text-stone-600 hover:text-red-400 text-xs transition-colors">×</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="Ajouter un monstre…"
                      value={encounterSearch}
                      onChange={e => setEncounterSearch(e.target.value)}
                      className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-stone-500 text-xs shrink-0">CR</span>
                      <select value={encounterMinCr} onChange={e => setEncounterMinCr(e.target.value)} className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors">
                        {CR_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <span className="text-stone-600 text-xs">—</span>
                      <select value={encounterMaxCr} onChange={e => setEncounterMaxCr(e.target.value)} className="bg-stone-800 border border-stone-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors">
                        {CR_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <select value={encounterMonsterSort} onChange={e => setEncounterMonsterSort(e.target.value as typeof encounterMonsterSort)} className="ml-auto bg-stone-800 border border-stone-700 rounded px-2 py-1 text-stone-300 text-xs focus:outline-none focus:border-violet-500 transition-colors">
                        <option value="cr_asc">CR ↑</option>
                        <option value="cr_desc">CR ↓</option>
                        <option value="xp">XP ↓</option>
                        <option value="name">Nom A→Z</option>
                      </select>
                    </div>

                    {encounterSearch && (
                      <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                        {filteredMonsters.slice(0, 12).map(m => (
                          <button
                            key={m.name}
                            onClick={() => {
                              setEncounterEntries(prev => {
                                const idx = prev.findIndex(e => e.monster.name === m.name)
                                if (idx >= 0) { const next = [...prev]; next[idx] = { ...next[idx], count: next[idx].count + 1 }; return next }
                                return [...prev, { monster: m, count: 1 }]
                              })
                              setEncounterSearch('')
                            }}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded hover:bg-stone-800 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="text-stone-500 text-xs w-8 shrink-0 font-mono">CR{m.cr}</span>
                              <span className="text-stone-200 text-sm truncate">{m.name}</span>
                            </div>
                            <span className="text-stone-500 text-xs shrink-0">{m.xp} XP</span>
                          </button>
                        ))}
                        {filteredMonsters.length === 0 && <p className="text-stone-600 text-sm text-center py-2">Aucun monstre trouvé.</p>}
                      </div>
                    )}

                    {encounterEntries.length > 0 && (
                      <div className="space-y-1.5">
                        {encounterEntries.map((entry, i) => (
                          <div key={entry.monster.name} className="flex items-center gap-3 bg-stone-800/60 rounded-lg px-3 py-2">
                            <span className="text-stone-500 text-xs font-mono w-8 shrink-0">CR{entry.monster.cr}</span>
                            <span className="flex-1 text-stone-200 text-sm min-w-0 truncate">{entry.monster.name}</span>
                            <span className="text-stone-500 text-xs shrink-0">{entry.monster.xp * entry.count} XP</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => setEncounterEntries(prev => { const next = [...prev]; if (next[i].count <= 1) return next.filter((_, j) => j !== i); next[i] = { ...next[i], count: next[i].count - 1 }; return next })} className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs flex items-center justify-center transition-colors">−</button>
                              <span className="text-white text-sm w-5 text-center">{entry.count}</span>
                              <button onClick={() => setEncounterEntries(prev => { const next = [...prev]; next[i] = { ...next[i], count: next[i].count + 1 }; return next })} className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs flex items-center justify-center transition-colors">+</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {difficulty && (
                      <div className="flex items-center justify-between border-t border-stone-800 pt-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${difficultyColor(difficulty)}`}>{difficulty}</span>
                            <span className="text-stone-500 text-xs">{adjustedXp} XP ajustés{multiplier !== 1 && <span className="text-stone-600"> (×{multiplier})</span>}</span>
                          </div>
                        </div>
                        <button onClick={async () => { await handleLaunchEncounter(); setShowAddEnemy(false) }} disabled={encounterEntries.length === 0} className="bg-violet-700 hover:bg-violet-600 disabled:opacity-40 text-white font-semibold text-sm rounded-lg px-4 py-2 transition-colors shrink-0">Lancer →</button>
                      </div>
                    )}

                    {campaignId && (
                      <div className="flex items-center gap-2 border-t border-stone-800 pt-3">
                        <input type="text" placeholder="Nom de la rencontre…" value={saveEncounterName} onChange={e => setSaveEncounterName(e.target.value)} className="flex-1 min-w-0 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors" />
                        <button onClick={handleSaveEncounter} disabled={!saveEncounterName.trim() || encounterEntries.length === 0} className="bg-stone-700 hover:bg-stone-600 disabled:opacity-40 text-stone-200 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors shrink-0">Sauvegarder</button>
                      </div>
                    )}

                    {encounterEntries.length === 0 && <p className="text-stone-600 text-xs text-center py-2">Recherchez des monstres pour composer la rencontre.</p>}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─────────── Ruban de tour + dock du combattant actif ─────────── */}
      {withRollDisplay.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-amber-700/40 bg-stone-900/95 backdrop-blur shadow-[0_-8px_24px_rgba(0,0,0,0.45)]">
          <div ref={barRef} className={`${mainWidthClass} mx-auto px-4 relative`}>

            {/* Popover d'action rapide (hors tour) — rendu hors du ruban scrollable pour ne pas être rogné */}
            {ribbonMenu && (() => {
              const row = withRollDisplay.find(r => rowId(r) === ribbonMenu)
              if (!row) return null
              const isChar = row.kind === 'character'
              const conds = isChar ? row.data.state.conditions : row.data.conditions
              const addable = Object.entries(CONDITIONS_FR).filter(([k]) => !conds.includes(k))
              return (
                <div
                  style={ribbonMenuX != null ? { left: ribbonMenuX, transform: 'translateX(-50%)' } : undefined}
                  className={`absolute bottom-full mb-2 z-40 w-56 bg-stone-900 border border-stone-700 rounded-lg shadow-xl p-2 space-y-2 ${ribbonMenuX == null ? 'left-1/2 -translate-x-1/2' : ''}`}
                >
                  {/* Petite flèche vers la carte */}
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-stone-900 border-r border-b border-stone-700 rotate-45" />
                  <div className="flex items-center justify-between">
                    <span className="text-stone-200 text-xs font-semibold truncate">{row.data.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Retirer le combattant : réservé aux combattants (PNJ/monstres).
                          Un personnage joueur appartient à la campagne, il ne se supprime
                          pas depuis le combat. */}
                      {!isChar && (
                        <button
                          onClick={() => { void handleDeleteCombatant(row.data.id); setRibbonMenu(null) }}
                          title="Retirer ce combattant"
                          className="text-stone-500 hover:text-red-400 text-xs transition-colors"
                        >🗑</button>
                      )}
                      <button onClick={() => setRibbonMenu(null)} className="text-stone-500 hover:text-stone-300 text-xs">✕</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" min={1} value={isChar ? (charHpInputs[row.data.id] ?? '') : (combatantHpInputs[row.data.id] ?? '')} onChange={e => isChar ? setCharHpInputs(p => ({ ...p, [row.data.id]: e.target.value })) : setCombatantHpInputs(p => ({ ...p, [row.data.id]: e.target.value }))} placeholder="PV" className="w-12 bg-stone-800 border border-stone-700 rounded px-1 py-1 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button onClick={() => { isChar ? handleCharacterHp(row.data, 'damage') : handleCombatantHp(row.data.id, 'damage') }} className="flex-1 bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-300 text-xs rounded py-1 transition-colors">Dmg</button>
                    <button onClick={() => { isChar ? handleCharacterHp(row.data, 'heal') : handleCombatantHp(row.data.id, 'heal') }} className="flex-1 bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-700/50 text-emerald-300 text-xs rounded py-1 transition-colors">Soin</button>
                  </div>
                  {conds.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {conds.map(c => (
                        <button key={c} onClick={() => { isChar ? handleToggleCharacterCondition(row.data.id, c) : handleToggleCombatantCondition(row.data.id, c) }} className="text-[10px] bg-purple-900/50 border border-purple-700/50 text-purple-300 rounded px-1 py-0.5 hover:bg-red-900/40 hover:text-red-300 transition-colors">{CONDITIONS_FR[c] ?? c} ×</button>
                      ))}
                    </div>
                  )}
                  {addable.length > 0 && (
                    <select value="" onChange={e => { if (e.target.value) { isChar ? handleToggleCharacterCondition(row.data.id, e.target.value) : handleToggleCombatantCondition(row.data.id, e.target.value) } }} className="w-full text-xs bg-stone-800 border border-stone-700 text-stone-400 rounded px-1 py-1 focus:outline-none cursor-pointer">
                      <option value="">+ état</option>
                      {addable.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )}
                </div>
              )
            })()}

            {/* Outils de groupe — barre légère attachée au ruban (secondaire dans la hiérarchie) */}
            {(characters.length > 0 || combatants.length > 0) && (
              <div className="flex items-center gap-1.5 py-1 overflow-x-auto">
                <span className="text-stone-600 text-[10px] uppercase tracking-widest shrink-0 pr-1">Groupe</span>
                <button
                  onClick={() => { if (aoeMode) { setAoeMode(false); setAoeSelected(new Set()); setAoeDamageInput('') } else { setAoeMode(true); setShowSavingThrow(false); setShowRestPanel(false); setRibbonMenu(null) } }}
                  className={`shrink-0 text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${aoeMode ? 'bg-orange-700/40 border-orange-500 text-orange-300' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-orange-600/50 hover:text-orange-400'}`}
                  title="Dégâts/soins/état sur plusieurs cibles — cliquez les cartes du ruban pour sélectionner"
                >🔥 Zone</button>
                {characters.length > 0 && (
                  <button
                    onClick={() => { if (showSavingThrow) { setShowSavingThrow(false) } else { setShowSavingThrow(true); setSavingThrowResults(null); setAoeMode(false); setShowRestPanel(false) } }}
                    className={`shrink-0 text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${showSavingThrow ? 'bg-sky-700/30 border-sky-600 text-sky-400' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-sky-600/50 hover:text-sky-400'}`}
                  >🎲 JS groupe</button>
                )}
                {characters.length > 0 && (
                  <button
                    onClick={() => { if (showRestPanel) { setShowRestPanel(false) } else { setShowRestPanel(true); setAoeMode(false); setShowSavingThrow(false) } }}
                    className={`shrink-0 text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${showRestPanel ? 'bg-sky-700/30 border-sky-600 text-sky-400' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-sky-600/50 hover:text-sky-400'}`}
                  >⛺ Repos</button>
                )}
                <button
                  onClick={() => {
                    // Sortir du mode conserve l'ordre donné ; y entrer l'amorce sur
                    // l'ordre courant (initiative) seulement s'il n'en existe pas déjà.
                    if (reordering) { setReordering(false) }
                    else { if (!manualOrder) setManualOrder(sorted.map(rowId)); setReordering(true) }
                  }}
                  className={`shrink-0 text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors ${reordering ? 'bg-sky-700/40 border-sky-500 text-sky-300' : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-sky-600/50 hover:text-sky-400'}`}
                  title={reordering ? 'Valider l’ordre manuel' : 'Réordonner manuellement l’initiative (poignées sur les lignes)'}
                >⇅ {reordering ? 'Valider l’ordre' : 'Réordonner'}</button>
                {/* Revenir à l'ordre d'initiative : le seul moyen d'abandonner l'ordre
                    manuel maintenant que revalider ne l'efface plus. */}
                {manualOrder && !reordering && (
                  <button
                    onClick={() => setManualOrder(null)}
                    className="shrink-0 text-xs font-medium rounded-lg px-2.5 py-1 border bg-stone-800 border-stone-700 text-stone-400 hover:border-amber-600/50 hover:text-amber-400 transition-colors"
                    title="Abandonner l'ordre manuel et revenir au tri par initiative"
                  >↺ Initiative</button>
                )}
              </div>
            )}

            {/* Tiroir d'outils de groupe */}
            {(aoeMode || showSavingThrow || (showRestPanel && characters.length > 0)) && (
              <div className="py-2 border-b border-stone-800/80 max-h-[38vh] overflow-y-auto">
                {aoeMode && (
                  <div className="bg-orange-950/20 border border-orange-800/40 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
                    <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider shrink-0">
                      🔥 Zone — {aoeSelected.size} cible{aoeSelected.size > 1 ? 's' : ''}{aoeSelected.size === 0 ? ' (cliquez les cartes)' : ''}
                    </span>
                    <input type="number" min={1} value={aoeDamageInput} onChange={e => setAoeDamageInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAoeDamage('damage') }} placeholder="Montant" className="w-20 bg-stone-800 border border-orange-700/50 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-orange-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <button onClick={() => handleAoeDamage('damage')} disabled={!aoeDamageInput || aoeSelected.size === 0} className="bg-red-700/60 hover:bg-red-600/80 disabled:opacity-40 border border-red-600/50 text-red-200 text-xs font-semibold rounded-lg px-2.5 py-1 transition-colors">Dégâts</button>
                    <button onClick={() => handleAoeDamage('heal')} disabled={!aoeDamageInput || aoeSelected.size === 0} className="bg-emerald-700/60 hover:bg-emerald-600/80 disabled:opacity-40 border border-emerald-600/50 text-emerald-200 text-xs font-semibold rounded-lg px-2.5 py-1 transition-colors">Soins</button>
                    <span className="text-stone-700">|</span>
                    <select value={aoeCondition} onChange={e => setAoeCondition(e.target.value)} className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-stone-300 text-xs focus:outline-none focus:border-orange-500 transition-colors">
                      <option value="">État...</option>
                      {Object.entries(CONDITIONS_FR).map(([key, label]) => (<option key={key} value={key}>{label}</option>))}
                    </select>
                    <button onClick={handleAoeCondition} disabled={!aoeCondition || aoeSelected.size === 0} className="bg-purple-800/60 hover:bg-purple-700/80 disabled:opacity-40 border border-purple-700/50 text-purple-200 text-xs font-semibold rounded-lg px-2.5 py-1 transition-colors">Appliquer</button>
                    <button onClick={() => { setAoeMode(false); setAoeSelected(new Set()); setAoeDamageInput(''); setAoeCondition('') }} className="text-stone-500 hover:text-stone-300 text-xs transition-colors ml-auto">Annuler</button>
                  </div>
                )}
                {showSavingThrow && (
                  <div className="bg-stone-900 border border-sky-800/40 rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sky-400 text-xs font-semibold uppercase tracking-widest shrink-0">🎲 JS de groupe</span>
                      <select value={savingThrowAbility} onChange={e => { setSavingThrowAbility(e.target.value as typeof savingThrowAbility); setSavingThrowResults(null) }} className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-sky-500 transition-colors">
                        <option value="strength">Force (FOR)</option>
                        <option value="dexterity">Dextérité (DEX)</option>
                        <option value="constitution">Constitution (CON)</option>
                        <option value="intelligence">Intelligence (INT)</option>
                        <option value="wisdom">Sagesse (SAG)</option>
                        <option value="charisma">Charisme (CHA)</option>
                      </select>
                      <div className="flex items-center gap-1.5">
                        <span className="text-stone-500 text-xs">DD</span>
                        <input type="number" min={1} max={30} value={savingThrowDC} onChange={e => { setSavingThrowDC(e.target.value); setSavingThrowResults(null) }} className="w-14 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-sky-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      </div>
                      <button onClick={handleGroupSavingThrow} className="bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg px-3 py-1 transition-colors">Lancer</button>
                      <button onClick={() => { setShowSavingThrow(false); setSavingThrowResults(null) }} className="text-stone-600 hover:text-stone-400 text-xs ml-auto">✕</button>
                    </div>
                    {savingThrowResults && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                        {savingThrowResults.map((r, i) => (
                          <div key={i} className={`rounded-lg px-2 py-1 border ${r.success ? 'bg-emerald-900/30 border-emerald-700/50' : 'bg-red-900/30 border-red-700/50'}`}>
                            <p className="text-stone-200 text-[11px] font-semibold truncate">{r.name}</p>
                            <p className={`text-xs font-bold ${r.success ? 'text-emerald-400' : 'text-red-400'}`}>{r.total} {r.success ? '✓' : '✗'}</p>
                            <p className="text-stone-600 text-[10px]">{r.roll} + {r.mod >= 0 ? r.mod : `(${r.mod})`}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {showRestPanel && characters.length > 0 && (
                  <div className="bg-stone-900 border border-sky-800/40 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sky-400 text-xs font-semibold uppercase tracking-widest">⛺ Repos du groupe</span>
                      <button onClick={() => setShowRestPanel(false)} className="text-stone-600 hover:text-stone-400 text-xs">✕</button>
                    </div>
                    <p className="text-stone-500 text-[11px]">
                      {characters.map(c => `${c.name} (${c.combat.current_hp}/${c.combat.max_hp} PV${c.combat.hit_dice_remaining > 0 ? `, ${c.combat.hit_dice_remaining} DV` : ''})`).join(' · ')}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => handleGroupRest('short')} disabled={restInProgress} className="flex-1 bg-sky-900/40 hover:bg-sky-800/60 disabled:opacity-50 border border-sky-700/50 text-sky-300 text-xs font-medium rounded-lg px-3 py-2 transition-colors">Court repos (1 DV/perso)</button>
                      <button onClick={() => handleGroupRest('long')} disabled={restInProgress} className="flex-1 bg-violet-900/40 hover:bg-violet-800/60 disabled:opacity-50 border border-violet-700/50 text-violet-300 text-xs font-medium rounded-lg px-3 py-2 transition-colors">Long repos (PV + emplacements)</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ruban de tour */}
            <div className="flex items-center gap-2 py-2 border-b border-stone-800/80">
              <button onClick={prevTurn} title="Tour précédent" className="shrink-0 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 rounded px-2 py-2 text-sm transition-colors">←</button>
              <div className="flex-1 min-w-0 overflow-x-auto flex gap-1.5">
                {withRollDisplay.map((row, i) => {
                  const isChar = row.kind === 'character'
                  const hp = isChar ? row.data.combat.current_hp : row.data.current_hp
                  const maxHp = isChar ? row.data.combat.max_hp : row.data.max_hp
                  const init = isChar ? row.data.combat.initiative_roll : row.data.initiative_roll
                  const enemy = !isChar && row.data.faction === 'ennemi'
                  const dying = hp <= 0
                  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
                  const active = i === activeTurn % withRollDisplay.length
                  const id = rowId(row)
                  const open = ribbonMenu === id
                  const aoeSel = aoeMode && aoeSelected.has(id)
                  return (
                    <div key={id} className="relative shrink-0">
                      <button
                        onClick={e => {
                          if (aoeMode) { toggleAoeSelect(id); return }
                          if (ribbonMenu === id) { setRibbonMenu(null); return }
                          const bar = barRef.current
                          if (bar) {
                            const br = bar.getBoundingClientRect()
                            const cr = e.currentTarget.getBoundingClientRect()
                            const half = 116
                            setRibbonMenuX(Math.max(half, Math.min(br.width - half, cr.left + cr.width / 2 - br.left)))
                          }
                          setRibbonMenu(id)
                        }}
                        title={aoeMode ? 'Cliquer pour (dé)sélectionner cette cible' : undefined}
                        className={`w-24 rounded-lg border px-2 py-1 text-left transition-colors ${aoeSel ? 'bg-orange-500/20 border-orange-500 ring-1 ring-orange-500/50' : active ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/40' : open ? 'bg-stone-700/70 border-stone-500' : aoeMode ? 'bg-stone-800/70 border-stone-700 hover:border-orange-500/50' : 'bg-stone-800/70 border-stone-700 hover:border-stone-500'}`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${aoeSel ? 'bg-orange-500 border-orange-400 text-white' : enemy ? 'bg-red-900/50 border-red-700/50 text-red-300' : isChar ? 'bg-sky-900/50 border-sky-700/50 text-sky-300' : 'bg-stone-700 border-stone-600 text-stone-300'}`}>{aoeSel ? '✓' : (init ?? '—')}</span>
                          <span className={`text-xs font-medium truncate ${active ? 'text-amber-200' : 'text-stone-200'}`}>{row.data.name}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <div className="flex-1 h-1 bg-stone-700 rounded-full overflow-hidden"><div className={`h-full ${hpColor(hp, maxHp)}`} style={{ width: `${pct}%` }} /></div>
                          {/* Cette page est celle du MJ (route protégée) : il voit les PV
                              de tout le monde. C'est la vue joueurs, /share/:token/combat,
                              qui masque les PV ennemis. */}
                          <span className={`text-[9px] tabular-nums ${dying ? 'text-red-400' : 'text-stone-500'}`}>{hp}</span>
                        </div>
                      </button>
                      {/* Réordonner dans le ruban : le plein écran n'a pas la table
                          d'initiative avec ses poignées, donc l'ordre se change ici.
                          Ruban horizontal → ◄ ► au lieu de ▲ ▼. Hors du <button> de la
                          carte (un bouton ne peut pas en contenir un autre). */}
                      {reordering && (
                        <div className="mt-0.5 flex items-center justify-center gap-1">
                          <button onClick={() => moveRow(id, 'up')} disabled={i === 0} title="Déplacer vers la gauche"
                            className="flex-1 text-sky-400 hover:text-sky-200 disabled:text-stone-700 text-xs leading-none py-0.5 rounded bg-stone-800 border border-stone-700 transition-colors">◄</button>
                          <button onClick={() => moveRow(id, 'down')} disabled={i === withRollDisplay.length - 1} title="Déplacer vers la droite"
                            className="flex-1 text-sky-400 hover:text-sky-200 disabled:text-stone-700 text-xs leading-none py-0.5 rounded bg-stone-800 border border-stone-700 transition-colors">►</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <div className="hidden md:flex items-center gap-0.5">
                  {[0, 30, 45, 60].map(s => (
                    <button key={s} onClick={() => handleSetTurnTimerMax(s)} className={`text-[11px] rounded px-1.5 py-0.5 transition-colors ${turnTimerMax === s ? 'bg-stone-700 text-stone-200' : 'text-stone-600 hover:text-stone-400'}`}>{s === 0 ? '–' : `${s}s`}</button>
                  ))}
                </div>
                {turnTimerMax > 0 && (
                  <span className={`text-xs font-mono tabular-nums ${turnTimerExpired ? 'text-red-400 font-bold' : turnTimerLeft <= 10 ? 'text-amber-400' : 'text-stone-500'}`}>{turnTimerExpired ? '⏰' : `${turnTimerLeft}s`}</span>
                )}
                <span className="text-stone-500 text-xs tabular-nums hidden sm:inline">R{roundNumber}·{activeTurn + 1}/{withRollDisplay.length}</span>
                <button onClick={nextTurn} className="bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded px-3 py-2 text-sm transition-colors shrink-0">Suivant →</button>
              </div>
            </div>

            {/* Dock du combattant actif */}
            {activeCombatant && (() => {
              const key = rowId(activeCombatant)
              const acts = getActions(key)
              const econ = (['action', 'bonus', 'reaction'] as const).map(type => {
                const used = acts[type]
                return (
                  <button
                    key={type}
                    onClick={() => toggleAction(key, type)}
                    title={type === 'action' ? 'Action' : type === 'bonus' ? 'Action bonus' : 'Réaction'}
                    className={`w-7 h-7 rounded text-xs font-bold border transition-colors ${
                      used ? 'bg-stone-800 border-stone-700 text-stone-600 line-through'
                        : type === 'action' ? 'bg-amber-600/20 border-amber-600/50 text-amber-400 hover:bg-amber-600/30'
                        : type === 'bonus' ? 'bg-sky-600/20 border-sky-600/50 text-sky-400 hover:bg-sky-600/30'
                        : 'bg-rose-600/20 border-rose-600/50 text-rose-400 hover:bg-rose-600/30'
                    }`}
                  >{type === 'action' ? 'A' : type === 'bonus' ? 'B' : 'R'}</button>
                )
              })

              if (activeCombatant.kind === 'character') {
                const ch = activeCombatant.data
                const dying = ch.combat.current_hp <= 0
                // Tous les sorts utilisables ce tour-ci, pas seulement ceux qui font des
                // dégâts : un sort d'utilité préparé (Bouclier, Armure de mage…) doit
                // rester visible. La caractéristique d'incantation ne conditionne que les
                // jets, jamais l'affichage — une fiche sans elle a quand même ses sorts.
                const castable = ch.spellcasting.spells.filter(s => s.prepared || s.level === 0)
                const addable = Object.entries(CONDITIONS_FR).filter(([k]) => !ch.state.conditions.includes(k))
                return (
                  <div className="py-2.5 space-y-2">
                    {macroResult && (
                      <div className="text-center text-sm">
                        <span className="text-stone-400">{macroResult.label} → </span>
                        <span className="text-amber-300 font-bold text-base">{macroResult.total}</span>
                        <span className="text-stone-600 text-xs ml-2">({macroResult.detail})</span>
                      </div>
                    )}
                    <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/60 text-amber-300 text-sm font-bold flex items-center justify-center shrink-0">{ch.combat.initiative_roll ?? '—'}</span>
                        <div className="min-w-0 leading-tight">
                          <p className="text-white font-semibold truncate">{ch.name}</p>
                          <p className="text-stone-500 text-xs truncate">{ch.race} · {ch.character_class} Niv.{ch.level}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-bold ${dying ? 'text-red-400' : 'text-white'}`}>{ch.combat.current_hp}</span>
                        <span className="text-stone-500 text-xs">/{ch.combat.max_hp}{ch.combat.temporary_hp > 0 && <span className="text-sky-400 font-semibold"> +{ch.combat.temporary_hp}</span>}</span>
                        <input type="number" min={1} value={charHpInputs[ch.id] ?? ''} onChange={e => setCharHpInputs(p => ({ ...p, [ch.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleCharacterHp(ch, 'damage') }} placeholder="PV" className="w-12 bg-stone-800 border border-stone-700 rounded px-1 py-1 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <button onClick={() => handleCharacterHp(ch, 'damage')} className="bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-300 text-xs rounded px-2 py-1 transition-colors">Dmg</button>
                        <button onClick={() => handleCharacterHp(ch, 'heal')} className="bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-700/50 text-emerald-300 text-xs rounded px-2 py-1 transition-colors">Soin</button>
                        <input type="number" min={0} value={charTempHpInputs[ch.id] ?? ''} onChange={e => setCharTempHpInputs(p => ({ ...p, [ch.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleSetCharacterTempHp(ch) }} placeholder="tmp" className="w-12 bg-stone-800 border border-stone-700 rounded px-1 py-1 text-white text-xs text-center focus:outline-none focus:border-sky-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <button onClick={() => handleSetCharacterTempHp(ch)} className="bg-sky-900/60 hover:bg-sky-800/80 border border-sky-700/50 text-sky-300 text-xs rounded px-2 py-1 transition-colors">Tmp</button>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleToggleInspiration(ch)} title={ch.combat.inspiration ? "Retirer l'inspiration" : "Accorder l'inspiration"} className={`w-7 h-7 rounded text-xs border transition-colors ${ch.combat.inspiration ? 'bg-amber-500/30 border-amber-500 text-amber-300' : 'bg-stone-800 border-stone-700 text-stone-600 hover:text-amber-500'}`}>✦</button>
                        {econ}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {ch.state.conditions.map(c => (
                          <button key={c} onClick={() => handleToggleCharacterCondition(ch.id, c)} title="Retirer" className="text-xs bg-purple-900/50 border border-purple-700/50 text-purple-300 rounded px-1.5 py-0.5 hover:bg-red-900/40 hover:border-red-700/40 hover:text-red-300 transition-colors">{CONDITIONS_FR[c] ?? c} ×</button>
                        ))}
                        {addable.length > 0 && (
                          <select value="" onChange={e => { if (e.target.value) handleToggleCharacterCondition(ch.id, e.target.value) }} title="Ajouter un état" className="text-xs bg-stone-800 border border-stone-700 text-stone-500 rounded px-1 py-1 focus:outline-none cursor-pointer">
                            <option value="">+ état</option>
                            {addable.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        )}
                      </div>
                      {dying && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="flex items-center gap-0.5" title="Réussites">
                            {[1, 2, 3].map(n => <button key={n} onClick={() => handleDeathSave(ch, 'successes', ch.state.death_saves_successes >= n ? n - 1 : n)} className={`w-4 h-4 rounded-full border ${ch.state.death_saves_successes >= n ? 'bg-emerald-500 border-emerald-400' : 'border-stone-600 hover:border-emerald-500'}`} />)}
                          </span>
                          <span className="flex items-center gap-0.5" title="Échecs">
                            {[1, 2, 3].map(n => <button key={n} onClick={() => handleDeathSave(ch, 'failures', ch.state.death_saves_failures >= n ? n - 1 : n)} className={`w-4 h-4 rounded-full border ${ch.state.death_saves_failures >= n ? 'bg-red-500 border-red-400' : 'border-stone-600 hover:border-red-500'}`} />)}
                          </span>
                        </div>
                      )}
                    </div>
                    {(ch.attack_macros.length > 0 || castable.length > 0) && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {ch.attack_macros.map((macro, mi) => (
                          <span key={`m${mi}`} className="inline-flex items-center gap-0.5">
                            <button onClick={() => handleRollMacro(ch, macro, 'attack')} className="text-xs bg-rose-900/50 border border-rose-700/40 text-rose-300 rounded-l px-1.5 py-0.5 hover:bg-rose-800/60 transition-colors">{macro.name}</button>
                            <button onClick={() => handleRollMacro(ch, macro, 'damage')} title={`Dégâts: ${macro.damage_dice}`} className="text-xs bg-orange-900/50 border border-orange-700/40 text-orange-300 rounded-r px-1.5 py-0.5 hover:bg-orange-800/60 transition-colors">{macro.damage_dice}</button>
                          </span>
                        ))}
                        {castable.map((spell, si) => {
                          const dice = spellDice(ch, spell)
                          // Le jet d'attaque a besoin de la caractéristique d'incantation ;
                          // les DÉGÂTS ne sont qu'un lancer de dés, lançables sans elle (sort
                          // à JS, ou perso sans caractéristique renseignée). Sans dés ni
                          // attaque possible, le sort reste une simple pastille de rappel.
                          const canAttack = !!ch.spellcasting.ability
                          if (!dice && !canAttack) {
                            return (
                              <span key={`s${si}`} className="text-xs bg-violet-900/30 border border-violet-800/40 text-violet-300/90 rounded px-1.5 py-0.5">
                                ✦ {spell.name}
                                <SpellLevelBadge character={ch} level={spell.level} />
                              </span>
                            )
                          }
                          return (
                            <span key={`s${si}`} className="inline-flex items-center gap-0.5">
                              {canAttack ? (
                                <button onClick={() => handleRollSpell(ch, spell, 'attack')} className={`text-xs bg-violet-900/50 border border-violet-700/40 text-violet-300 ${dice ? 'rounded-l' : 'rounded'} px-1.5 py-0.5 hover:bg-violet-800/60 transition-colors`}>✦ {spell.name}</button>
                              ) : (
                                <span className="text-xs bg-violet-900/30 border border-violet-800/40 text-violet-300/90 rounded-l px-1.5 py-0.5">✦ {spell.name}</span>
                              )}
                              {dice && (
                                <button onClick={() => handleRollSpell(ch, spell, 'damage')} title={`Dégâts: ${dice}`} className="text-xs bg-indigo-900/50 border border-indigo-700/40 text-indigo-300 rounded-r px-1.5 py-0.5 hover:bg-indigo-800/60 transition-colors">{dice}</button>
                              )}
                              <SpellLevelBadge character={ch} level={spell.level} />
                            </span>
                          )
                        })}
                      </div>
                    )}
                    {/* Emplacements de sort : dépensables directement depuis le dock du
                        combattant actif, comme dans la vue sans plateau. */}
                    <SpellSlots character={ch} onUse={(lvl, action) => handleUseSlot(ch, lvl, action)} />
                  </div>
                )
              }

              const cb = activeCombatant.data
              const dying = cb.current_hp <= 0
              const addable = Object.entries(CONDITIONS_FR).filter(([k]) => !cb.conditions.includes(k))
              const factionLabel = cb.faction === 'allié' ? 'Allié' : cb.faction === 'neutre' ? 'Neutre' : 'Ennemi'
              return (
                <div className="py-2.5">
                  <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center shrink-0 border ${cb.faction === 'ennemi' ? 'bg-red-900/40 border-red-700/50 text-red-300' : cb.faction === 'allié' ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300' : 'bg-stone-800 border-stone-700 text-stone-300'}`}>{cb.initiative_roll ?? '—'}</span>
                      <div className="min-w-0 leading-tight">
                        <p className="text-white font-semibold truncate">{cb.name}</p>
                        <p className="text-stone-500 text-xs truncate">{factionLabel}{cb.armor_class ? ` · CA ${cb.armor_class}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold ${dying ? 'text-red-400' : 'text-white'}`}>{cb.current_hp}</span>
                      <span className="text-stone-500 text-xs">/{cb.max_hp}</span>
                      <input type="number" min={1} value={combatantHpInputs[cb.id] ?? ''} onChange={e => setCombatantHpInputs(p => ({ ...p, [cb.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleCombatantHp(cb.id, 'damage') }} placeholder="PV" className="w-12 bg-stone-800 border border-stone-700 rounded px-1 py-1 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <button onClick={() => handleCombatantHp(cb.id, 'damage')} className="bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-300 text-xs rounded px-2 py-1 transition-colors">Dmg</button>
                      <button onClick={() => handleCombatantHp(cb.id, 'heal')} className="bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-700/50 text-emerald-300 text-xs rounded px-2 py-1 transition-colors">Soin</button>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">{econ}</div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {cb.conditions.map(c => (
                        <button key={c} onClick={() => handleToggleCombatantCondition(cb.id, c)} title="Retirer" className="text-xs bg-purple-900/50 border border-purple-700/50 text-purple-300 rounded px-1.5 py-0.5 hover:bg-red-900/40 hover:border-red-700/40 hover:text-red-300 transition-colors">{CONDITIONS_FR[c] ?? c} ×</button>
                      ))}
                      {addable.length > 0 && (
                        <select value="" onChange={e => { if (e.target.value) handleToggleCombatantCondition(cb.id, e.target.value) }} title="Ajouter un état" className="text-xs bg-stone-800 border border-stone-700 text-stone-500 rounded px-1 py-1 focus:outline-none cursor-pointer">
                          <option value="">+ état</option>
                          {addable.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Modal jet de concentration */}
      {concentrationPrompt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="bg-stone-900 border border-violet-800/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-violet-400 text-lg">◈</span>
              <h2 className="text-white font-semibold">Jet de Concentration</h2>
            </div>
            <p className="text-stone-300 text-sm mb-1">
              <span className="text-white font-medium">{concentrationPrompt.character.name}</span> concentré·e sur{' '}
              <span className="text-violet-300 font-medium">{concentrationPrompt.character.state.concentrating_on}</span>
            </p>
            <p className="text-stone-400 text-sm mb-4">
              Reçu {concentrationPrompt.amount} dégâts · DC {concentrationPrompt.dc} (Constitution)
            </p>

            {!concentrationRoll ? (
              <button
                onClick={() => {
                  const mod = concentrationPrompt.character.saving_throws.constitution.modifier
                  const roll = Math.floor(Math.random() * 20) + 1
                  const total = roll + mod
                  const success = total >= concentrationPrompt.dc
                  setConcentrationRoll({ roll, mod, total, success })
                  logEvent('roll', `${concentrationPrompt.character.name} · Concentration DC${concentrationPrompt.dc} → ${total} [${roll}${mod >= 0 ? '+' : ''}${mod}] — ${success ? 'Maintenu ✓' : 'Perdu ✗'}`)
                }}
                className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg py-2.5 transition-colors"
              >
                Lancer le d20
              </button>
            ) : (
              <div className="space-y-3">
                <div className={`rounded-xl border px-4 py-3 text-center ${concentrationRoll.success ? 'bg-emerald-900/30 border-emerald-700/50' : 'bg-red-900/30 border-red-700/50'}`}>
                  <p className="text-2xl font-bold text-white">{concentrationRoll.total}</p>
                  <p className="text-stone-400 text-xs">[{concentrationRoll.roll}] {concentrationRoll.mod >= 0 ? '+' : ''}{concentrationRoll.mod} CON</p>
                  <p className={`text-sm font-semibold mt-1 ${concentrationRoll.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {concentrationRoll.success ? '✓ Concentration maintenue' : '✗ Concentration perdue'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!concentrationRoll.success && (
                    <button
                      onClick={async () => {
                        const updated = await updateConcentration(concentrationPrompt.character.id, null)
                        updateCharacter(updated)
                        setConcentrationPrompt(null)
                        setConcentrationRoll(null)
                      }}
                      className="flex-1 bg-red-900/60 hover:bg-red-800/80 border border-red-700/50 text-red-300 text-sm font-semibold rounded-lg py-2 transition-colors"
                    >
                      Retirer la concentration
                    </button>
                  )}
                  <button
                    onClick={() => { setConcentrationPrompt(null); setConcentrationRoll(null) }}
                    className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-semibold rounded-lg py-2 transition-colors"
                  >
                    {concentrationRoll.success ? 'Fermer' : 'Ignorer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal résumé post-combat */}
      {showCombatSummary && (
        <CombatSummaryModal
          roundNumber={roundNumber}
          combatants={combatants}
          monsterMap={resolvedMonsters}
          characters={characters}
          campaignId={campaignId}
          onClose={() => setShowCombatSummary(false)}
          onReset={() => { setShowCombatSummary(false); handleReset() }}
          onDistributeXp={characters.length > 0 ? handleDistributeXpAmount : undefined}
        />
      )}

      {/* Monster stats popup */}
      {monsterPopup && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setMonsterPopup(null)}
        >
          <div
            className="bg-stone-900 border border-stone-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">{monsterPopup.name}</h2>
                <p className="text-stone-500 text-xs mt-0.5">CR {monsterPopup.cr} · {monsterPopup.xp} XP</p>
              </div>
              <button onClick={() => setMonsterPopup(null)} className="text-stone-600 hover:text-stone-300 text-lg transition-colors leading-none mt-0.5">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-stone-800 rounded-xl py-2.5 text-center">
                <p className="text-stone-500 text-xs mb-0.5">CA</p>
                <p className="text-white font-bold text-xl">{monsterPopup.ac}</p>
              </div>
              <div className="bg-stone-800 rounded-xl py-2.5 text-center">
                <p className="text-stone-500 text-xs mb-0.5">PV moy.</p>
                <p className="text-white font-bold text-xl">{monsterPopup.hp_avg}</p>
              </div>
              <div className="bg-stone-800 rounded-xl py-2.5 text-center">
                <p className="text-stone-500 text-xs mb-0.5">Init.</p>
                <p className="text-white font-bold text-xl">{monsterPopup.initiative_mod >= 0 ? `+${monsterPopup.initiative_mod}` : monsterPopup.initiative_mod}</p>
              </div>
            </div>

            {monsterPopup.speed != null && (
              <p className="text-stone-400 text-xs mb-3">Vitesse : {monsterPopup.speed} m</p>
            )}

            {(monsterPopup.attacks ?? []).length > 0 && (
              <div className="mb-4">
                <p className="text-stone-500 text-xs font-semibold uppercase tracking-widest mb-2">Attaques</p>
                <div className="space-y-1.5">
                  {(monsterPopup.attacks ?? []).map((atk: MonsterAttack, i: number) => (
                    <div key={i} className="bg-stone-800 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white text-sm font-medium">{atk.name}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-amber-300 font-mono">{atk.bonus}</span>
                          <span className="text-stone-400">→</span>
                          <span className="text-red-300 font-mono">{atk.damage}</span>
                        </div>
                      </div>
                      {atk.notes && <p className="text-stone-500 text-xs mt-0.5">{atk.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {monsterPopup.notes && (
              <p className="text-stone-400 text-sm">{monsterPopup.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
