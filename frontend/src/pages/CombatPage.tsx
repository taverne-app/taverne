import { useEffect, useRef, useState } from 'react'
import { useTabNotify } from '../hooks/useTabNotify'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { listCharacters, setInitiativeRoll, updateInspiration, updateConditions, updateIdentity, updateDeathSaves, useSpellSlot, updateHp, updateConcentration, shortRest, longRest, type Character, type DiceRoll, type AttackMacro, type Spell } from '../api/characters'
import { getCampaign, updateCampaign, broadcastCombatTurn, type Campaign, type SavedEncounter, type CustomMonster, type MonsterAttack } from '../api/campaigns'
import {
  listCombatants,
  createCombatant,
  updateCombatantHp,
  updateCombatantInitiative,
  updateCombatantConditions,
  updateCombatantFaction,
  updateCombatantName,
  deleteCombatant,
  type Combatant,
  type CombatantFaction,
} from '../api/combatants'
import { createSession } from '../api/sessions'
import { logout } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { createEcho, REVERB_CONFIGURED } from '../lib/echo'
import { MONSTERS, rollMonsterHp, crToAttackBonus, crToDamageDice, crToXp, CR_XP, type MonsterTemplate } from '../data/monsters'
import { canLevelUp } from '../data/xp'
import { CONDITIONS_FR } from '../data/conditions'
import { ConditionTag } from '../components/ConditionTag'
import { RulesCompendium } from '../components/RulesCompendium'
import { XP_THRESHOLDS, encounterMultiplier, encounterDifficultyLabel, difficultyColor, computeEncounterDifficulty } from '../data/encounter_difficulty'

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
  const parsed = parseDice(spell.damage_dice ?? '')
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
      await createSession(campaignId, {
        title: `Combat — ${today}`,
        session_date: today,
        notes: lines.join('\n'),
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
  const { token, user, clearAuth } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const campaignId = searchParams.get('campaign') ? Number(searchParams.get('campaign')) : null

  const [characters, setCharacters] = useState<Character[]>([])
  const [combatants, setCombatants] = useState<Combatant[]>([])
  const [campaign, setCampaign] = useState<Campaign | null>(null)
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
  const [linkCopied, setLinkCopied] = useState(false)
  const [showXpPanel, setShowXpPanel] = useState(false)
  const [xpInputs, setXpInputs] = useState<Record<number, string>>({})
  const [xpResult, setXpResult] = useState<{ total: number; share: number; levelUps: string[] } | null>(null)
  const [monsterMap, setMonsterMap] = useState<Record<number, MonsterTemplate>>({})
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

  // Manual initiative reordering
  const [manualOrder, setManualOrder] = useState<string[] | null>(null)
  const [dragRowId, setDragRowId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // DM dice roller
  const [dmDiceOpen, setDmDiceOpen] = useState(false)
  const [dmDiceSides, setDmDiceSides] = useState(20)
  const [dmDiceCount, setDmDiceCount] = useState('1')
  const [dmDiceMod, setDmDiceMod] = useState('')
  const [dmDiceAdv, setDmDiceAdv] = useState<'none' | 'adv' | 'dis'>('none')
  const [dmDiceResult, setDmDiceResult] = useState<{ label: string; detail: string; total: number } | null>(null)
  const [dmDiceExpr, setDmDiceExpr] = useState('')
  const dmDiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Encounter builder
  const [showEncounterBuilder, setShowEncounterBuilder] = useState(false)
  const [encounterSearch, setEncounterSearch] = useState('')
  const [encounterEntries, setEncounterEntries] = useState<{ monster: MonsterTemplate; count: number }[]>([])
  const [saveEncounterName, setSaveEncounterName] = useState('')
  const [showSavedEncounters, setShowSavedEncounters] = useState(false)

  // Saving throws
  const [showSavingThrow, setShowSavingThrow] = useState(false)
  const [savingThrowAbility, setSavingThrowAbility] = useState<'strength'|'dexterity'|'constitution'|'intelligence'|'wisdom'|'charisma'>('dexterity')
  const [savingThrowDC, setSavingThrowDC] = useState('15')
  const [savingThrowResults, setSavingThrowResults] = useState<{ name: string; roll: number; mod: number; total: number; success: boolean }[] | null>(null)

  // Combat log
  interface CombatLogEntry { id: number; time: string; type: 'turn' | 'roll' | 'hp' | 'xp' | 'join'; text: string }
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([])
  const [showCombatLog, setShowCombatLog] = useState(false)
  const [savingLog, setSavingLog] = useState(false)
  const [logSaved, setLogSaved] = useState(false)
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
      await createSession(campaignId, {
        title: `Journal de combat — ${today}`,
        session_date: today,
        notes: lines.join('\n'),
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

  function handleDmRoll() {
    const sides = dmDiceSides
    const count = Math.max(1, parseInt(dmDiceCount, 10) || 1)
    const mod = parseInt(dmDiceMod, 10) || 0
    let rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
    let chosen = rolls
    let advLabel = ''
    if (sides === 20 && count === 1 && dmDiceAdv !== 'none') {
      const r2 = Math.floor(Math.random() * 20) + 1
      rolls = [rolls[0], r2]
      chosen = dmDiceAdv === 'adv' ? [Math.max(...rolls)] : [Math.min(...rolls)]
      advLabel = dmDiceAdv === 'adv' ? ' (avantage)' : ' (désavantage)'
    }
    const total = chosen.reduce((s, r) => s + r, 0) + mod
    const detail = `[${rolls.join(', ')}]${mod !== 0 ? (mod >= 0 ? `+${mod}` : `${mod}`) : ''}${advLabel}`
    const label = `MJ — ${count}d${sides}${mod !== 0 ? (mod >= 0 ? `+${mod}` : `${mod}`) : ''}`
    if (dmDiceTimer.current) clearTimeout(dmDiceTimer.current)
    setDmDiceResult({ label, detail, total })
    dmDiceTimer.current = setTimeout(() => setDmDiceResult(null), 8000)
    logEvent('roll', `${label} → ${total} (${detail})`)
  }

  function handleDmRollExpr() {
    const raw = dmDiceExpr.trim().toLowerCase().replace(/\s+/g, '')
    if (!raw) return
    // Parse: (count)d(sides)(kh/kl N)(+/- mod)
    const m = raw.match(/^(\d*)d(\d+|%)(kh(\d+)|kl(\d+)|dh(\d+)|dl(\d+))?([+-]\d+)?$/)
    if (!m) return
    const count = m[1] ? Math.max(1, parseInt(m[1])) : 1
    const sides = m[2] === '%' ? 100 : parseInt(m[2])
    const mod = m[8] ? parseInt(m[8]) : 0
    const keepMode = m[3]
      ? (m[3].startsWith('kh') || m[3].startsWith('dh') ? 'high' : 'low')
      : null
    // kh = keep highest, kl = keep lowest, dh = drop highest, dl = drop lowest
    const keepN = keepMode
      ? (() => {
          const n = parseInt(m[4] ?? m[5] ?? m[6] ?? m[7])
          const isKeep = m[3].startsWith('k')
          return isKeep ? n : count - n
        })()
      : null
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
    let keptIndices: Set<number>
    let kept: number[]
    if (keepMode !== null && keepN !== null) {
      const indices = rolls.map((_, i) => i)
      indices.sort((a, b) => keepMode === 'high' ? rolls[b] - rolls[a] : rolls[a] - rolls[b])
      keptIndices = new Set(indices.slice(0, keepN))
      kept = indices.slice(0, keepN).map(i => rolls[i])
    } else {
      keptIndices = new Set(rolls.map((_, i) => i))
      kept = rolls
    }
    const total = kept.reduce((s, r) => s + r, 0) + mod
    const detailParts = rolls.map((r, i) => keptIndices.has(i) ? String(r) : `(${r})`)
    const detail = `[${detailParts.join('+')}]${mod !== 0 ? (mod >= 0 ? `+${mod}` : `${mod}`) : ''}`
    const label = `MJ — ${raw.replace('%', '100')}`
    if (dmDiceTimer.current) clearTimeout(dmDiceTimer.current)
    setDmDiceResult({ label, detail, total })
    dmDiceTimer.current = setTimeout(() => setDmDiceResult(null), 8000)
    logEvent('roll', `${label} → ${total} (${detail})`)
  }

  // Add combatant form
  const [addingCombatant, setAddingCombatant] = useState(false)
  const [combatantDraft, setCombatantDraft] = useState({ name: '', faction: 'ennemi' as CombatantFaction, max_hp: '', ac: '', initiative: '' })
  const [monsterSuggestions, setMonsterSuggestions] = useState<MonsterTemplate[]>([])
  const [showBestiary, setShowBestiary] = useState(false)
  const [bestiarySearch, setBestiarySearch] = useState('')
  const [bestiaryMinCr, setBestiaryMinCr] = useState('0')
  const [bestiaryMaxCr, setBestiaryMaxCr] = useState('30')
  const [encounterMinCr, setEncounterMinCr] = useState('0')
  const [encounterMaxCr, setEncounterMaxCr] = useState('30')
  const [addedMonster, setAddedMonster] = useState<string | null>(null)
  const [charHpInputs, setCharHpInputs] = useState<Record<number, string>>({})
  const [concentrationPrompt, setConcentrationPrompt] = useState<{ character: Character; amount: number; dc: number } | null>(null)
  const [concentrationRoll, setConcentrationRoll] = useState<{ roll: number; mod: number; total: number; success: boolean } | null>(null)

  const echoRef = useRef<ReturnType<typeof createEcho> | null>(null)

  // Load characters + combatants
  useEffect(() => {
    if (campaignId) {
      Promise.all([getCampaign(campaignId), listCombatants(campaignId)])
        .then(([c, cbs]) => {
          setCampaign(c)
          setCharacters(c.characters)
          setCombatants(cbs)
        })
        .catch(() => navigate('/campaigns'))
        .finally(() => setLoading(false))
    } else {
      listCharacters()
        .then(setCharacters)
        .catch(() => navigate('/characters'))
        .finally(() => setLoading(false))
    }
  }, [campaignId, navigate])

  // WS subscriptions
  useEffect(() => {
    if (!token || (characters.length === 0 && combatants.length === 0) || !REVERB_CONFIGURED) return

    const echo = createEcho(token)
    echoRef.current = echo

    characters.forEach(c => {
      echo.private(`character.${c.id}`)
        .listen('.character.updated', (e: { character: Character }) => {
          setCharacters(prev => prev.map(ch => ch.id === e.character.id ? e.character : ch))
        })
        .listen('.dice.rolled', (e: DiceRoll) => {
          setDiceLog(log => {
            const next = [e, ...log].slice(0, 50)
            if (campaignId) localStorage.setItem(`taverne-dice-log-${campaignId}`, JSON.stringify(next))
            return next
          })
        })
    })

    combatants.forEach(cb => {
      echo.private(`combatant.${cb.id}`)
        .listen('.combatant.updated', (e: { combatant: Combatant }) => {
          setCombatants(prev => prev.map(c => c.id === e.combatant.id ? e.combatant : c))
        })
    })

    return () => {
      characters.forEach(c => echo.leave(`character.${c.id}`))
      combatants.forEach(cb => echo.leave(`combatant.${cb.id}`))
      echo.disconnect()
      echoRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, characters.map(c => c.id).join(','), combatants.map(c => c.id).join(',')])

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

  const activeCombatant = withRollDisplay[activeTurn % Math.max(1, withRollDisplay.length)] ?? null

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
    const updated = await setInitiativeRoll(id, roll)
    updateCharacter(updated)
  }

  async function handleSetCombatantInitiative(id: number, roll: number | null) {
    if (!campaignId) return
    const updated = await updateCombatantInitiative(campaignId, id, roll)
    setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  async function handleRollAllInitiative(onlyMissing = false) {
    const d20 = () => Math.floor(Math.random() * 20) + 1
    await Promise.all([
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
          const mod = monsterMap[cb.id]?.initiative_mod ?? 0
          const roll = d20() + mod
          const updated = await updateCombatantInitiative(campaignId, cb.id, roll)
          setCombatants(prev => prev.map(x => x.id === updated.id ? updated : x))
        }),
    ])
    setManualOrder(null)
  }

  async function handleCombatantHp(combatantId: number, type: 'damage' | 'heal') {
    if (!campaignId) return
    const raw = combatantHpInputs[combatantId] ?? ''
    const amount = parseInt(raw, 10)
    if (!amount || amount <= 0) return
    const cbName = combatants.find(c => c.id === combatantId)?.name ?? '?'
    const updated = await updateCombatantHp(campaignId, combatantId, amount, type)
    setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
    setCombatantHpInputs(prev => ({ ...prev, [combatantId]: '' }))
    logEvent('hp', `${cbName} : ${type === 'damage' ? `-${amount}` : `+${amount}`} PV`)
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
    const updated = await updateHp(character.id, amount, type)
    updateCharacter(updated)
    setCharHpInputs(prev => ({ ...prev, [character.id]: '' }))
    logEvent('hp', `${character.name} : ${type === 'damage' ? `-${amount}` : `+${amount}`} PV`)
    if (type === 'damage' && character.state.concentrating_on) {
      const dc = Math.max(10, Math.floor(amount / 2))
      setConcentrationPrompt({ character: updated, amount, dc })
      setConcentrationRoll(null)
    }
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
    const updated = await updateConditions(id, nextConditions, nextDurations)
    updateCharacter(updated)
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
    await Promise.all(Array.from(aoeSelected).map(async id => {
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
    }))
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

  async function handleDeleteCombatant(id: number) {
    if (!campaignId) return
    await deleteCombatant(campaignId, id)
    setCombatants(prev => prev.filter(c => c.id !== id))
  }

  async function handleToggleInspiration(character: Character) {
    const updated = await updateInspiration(character.id, !character.combat.inspiration)
    updateCharacter(updated)
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
    const updated = await updateCombatantConditions(campaignId, id, nextConditions, nextDurations)
    setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
  }

  async function handleRenameCombatant(id: number) {
    if (!campaignId || !renameDraft.trim()) return
    const updated = await updateCombatantName(campaignId, id, renameDraft.trim())
    setCombatants(prev => prev.map(c => c.id === updated.id ? updated : c))
    setRenamingCombatantId(null)
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
    const created = await createCombatant(campaignId, {
      name: combatantDraft.name.trim(),
      faction: combatantDraft.faction,
      max_hp: maxHp,
      armor_class: combatantDraft.ac ? parseInt(combatantDraft.ac, 10) || null : null,
      initiative_roll: combatantDraft.initiative ? parseInt(combatantDraft.initiative, 10) || null : null,
    })
    setCombatants(prev => [...prev, created])
    setCombatantDraft({ name: '', faction: 'ennemi', max_hp: '', ac: '', initiative: '' })
    setAddingCombatant(false)
    logEvent('join', `${created.name} entre dans le combat`)
  }

  async function handleAddMonster(m: MonsterTemplate) {
    if (!campaignId) return
    const hp = rollMonsterHp(m)
    const initRoll = Math.floor(Math.random() * 20) + 1 + m.initiative_mod
    const created = await createCombatant(campaignId, {
      name: m.name,
      max_hp: hp,
      armor_class: m.ac,
      initiative_roll: initRoll,
    })
    setCombatants(prev => [...prev, created])
    setMonsterMap(prev => ({ ...prev, [created.id]: m }))
    setAddedMonster(m.name)
    setTimeout(() => setAddedMonster(null), 2000)
    logEvent('join', `${m.name} entre dans le combat (${hp} PV, CA ${m.ac})`)
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

  async function handleDeleteSavedEncounter(index: number) {
    if (!campaign || !campaignId) return
    const next = (campaign.saved_encounters ?? []).filter((_, i) => i !== index)
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

  async function handleLogout() {
    try { await logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

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
  }

  async function handleClearCombatants() {
    if (!campaignId || combatants.length === 0) return
    await Promise.all(combatants.map(c => deleteCombatant(campaignId, c.id)))
    setCombatants([])
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

  // Active row info for the turn banner
  const activeRowName = activeCombatant
    ? activeCombatant.kind === 'character'
      ? activeCombatant.data.name
      : activeCombatant.data.name
    : '—'
  const activeRowSubtitle = activeCombatant
    ? activeCombatant.kind === 'character'
      ? `${activeCombatant.data.race} · ${activeCombatant.data.character_class} · Niv. ${activeCombatant.data.level} · ${activeCombatant.data.combat.current_hp}/${activeCombatant.data.combat.max_hp} PV`
      : `${activeCombatant.data.faction === 'allié' ? 'Allié' : activeCombatant.data.faction === 'neutre' ? 'Neutre' : 'Ennemi'} · ${activeCombatant.data.current_hp}/${activeCombatant.data.max_hp} PV${activeCombatant.data.armor_class ? ` · CA ${activeCombatant.data.armor_class}` : ''}`
    : null

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={campaign ? `/campaigns/${campaign.id}` : '/characters'}
              className="text-stone-400 hover:text-stone-200 transition-colors text-sm shrink-0"
            >
              {campaign ? `← ${campaign.name}` : '← Personnages'}
            </Link>
            <span className="text-stone-700">|</span>
            <span className="text-amber-400 font-bold">⚔ Combat Tracker</span>
            {campaign && (
              <span className="text-stone-500 text-sm hidden sm:block truncate">— {campaign.name}</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <RulesCompendium />
            <button
              onClick={() => setDmDiceOpen(v => !v)}
              className={`text-sm font-bold px-3 py-1 rounded-lg border transition-colors ${
                dmDiceOpen
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-500'
              }`}
            >
              ⚅ Dés
            </button>
            {campaign?.share_token && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/share/${campaign.share_token}/live`
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(url).catch(() => {})
                  }
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 2000)
                }}
                className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                  linkCopied
                    ? 'bg-emerald-700/30 border-emerald-600 text-emerald-400'
                    : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'
                }`}
                title="Copier le lien combat live (lecture seule pour les joueurs)"
              >
                {linkCopied ? '✓ Copié' : '⟳ Vue joueurs'}
              </button>
            )}
            <span className="text-stone-400 text-sm hidden sm:block">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-stone-400 hover:text-stone-200 text-sm transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* DM dice panel — fixed bottom overlay */}
      {dmDiceOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-stone-900 border-t border-stone-700 shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
            {/* Free expression input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={dmDiceExpr}
                onChange={e => setDmDiceExpr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDmRollExpr()}
                placeholder="Expression libre : 4d6kh3, 2d20+5, d%…"
                className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder:text-stone-600 focus:outline-none focus:border-rose-500"
              />
              <button
                onClick={handleDmRollExpr}
                disabled={!dmDiceExpr.trim()}
                className="bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white font-bold text-sm rounded-lg px-4 py-2 transition-colors shrink-0"
              >
                ↵
              </button>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Dice selector */}
              <div className="flex gap-1.5 flex-wrap">
                {[4, 6, 8, 10, 12, 20, 100].map(s => (
                  <button
                    key={s}
                    onClick={() => { setDmDiceSides(s); if (s !== 20) setDmDiceAdv('none') }}
                    className={`w-9 h-9 rounded-lg border text-xs font-bold transition-colors ${
                      dmDiceSides === s
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-stone-800 border-stone-700 text-stone-300 hover:border-stone-500'
                    }`}
                  >
                    d{s}
                  </button>
                ))}
              </div>
              {/* Count */}
              <div className="flex items-center gap-1.5">
                <span className="text-stone-500 text-xs">×</span>
                <input
                  type="number" min={1} max={20} value={dmDiceCount}
                  onChange={e => setDmDiceCount(e.target.value)}
                  className="w-12 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              {/* Modifier */}
              <div className="flex items-center gap-1.5">
                <span className="text-stone-500 text-xs">Mod.</span>
                <input
                  type="number" value={dmDiceMod} onChange={e => setDmDiceMod(e.target.value)}
                  placeholder="0"
                  className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              {/* Advantage (d20 only) */}
              {dmDiceSides === 20 && (
                <div className="flex gap-1">
                  {(['none', 'adv', 'dis'] as const).map(mode => (
                    <button key={mode} onClick={() => setDmDiceAdv(mode)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                        dmDiceAdv === mode
                          ? mode === 'adv' ? 'bg-emerald-700 border-emerald-600 text-white'
                          : mode === 'dis' ? 'bg-red-800 border-red-700 text-white'
                          : 'bg-stone-600 border-stone-500 text-white'
                          : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-stone-500'
                      }`}
                    >
                      {mode === 'none' ? 'Normal' : mode === 'adv' ? 'Avantage' : 'Désav.'}
                    </button>
                  ))}
                </div>
              )}
              {/* Roll button */}
              <button
                onClick={handleDmRoll}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-lg px-5 py-2 transition-colors"
              >
                Lancer
              </button>
              {/* Close */}
              <button onClick={() => setDmDiceOpen(false)} className="ml-auto text-stone-500 hover:text-stone-300 text-lg transition-colors">×</button>
            </div>
            {/* Result */}
            {dmDiceResult && (
              <div className="flex items-center gap-4 bg-stone-800 rounded-xl px-4 py-2">
                <span className="text-rose-300 font-black text-4xl tabular-nums">{dmDiceResult.total}</span>
                <div>
                  <p className="text-stone-400 text-xs">{dmDiceResult.label}</p>
                  <p className="text-stone-500 text-xs font-mono">{dmDiceResult.detail}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Turn controls */}
        {withRollDisplay.length > 0 && (
          <div className={`bg-stone-900 border rounded-xl p-4 ${turnTimerExpired ? 'border-red-500/60' : 'border-amber-500/30'}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-0.5">
                  <p className="text-stone-400 text-xs uppercase tracking-widest">Tour actif</p>
                  <span className="text-amber-600 text-xs font-semibold uppercase tracking-widest">
                    Round {roundNumber}
                  </span>
                </div>
                <p className="text-white font-bold text-lg">{activeRowName}</p>
                {activeRowSubtitle && (
                  <p className="text-stone-400 text-xs mt-0.5">{activeRowSubtitle}</p>
                )}
                {activeCombatant && (() => {
                  if (activeCombatant.kind === 'character') {
                    const ch = activeCombatant.data
                    const slots = Object.entries(ch.spellcasting.slots).filter(([, s]) => s.max > 0)
                    const resources = ch.resources.filter(r => r.max > 0)
                    const hasExtras = ch.state.concentrating_on || slots.length > 0 || resources.length > 0 || ch.state.conditions.length > 0
                    if (!hasExtras) return null
                    return (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                        {ch.state.concentrating_on && (
                          <span className="text-violet-400 text-xs">⊙ {ch.state.concentrating_on}</span>
                        )}
                        {ch.state.conditions.map(cond => (
                          <span key={cond} className="text-purple-300 text-xs bg-purple-900/40 rounded px-1">{CONDITIONS_FR[cond] ?? cond}</span>
                        ))}
                        {slots.map(([lvl, s]) => (
                          <span key={lvl} className={`text-xs font-mono ${s.used >= s.max ? 'text-stone-600' : 'text-amber-400'}`}>
                            {lvl}:{s.max - s.used}/{s.max}
                          </span>
                        ))}
                        {resources.map(r => (
                          <span key={r.name} className={`text-xs ${r.current === 0 ? 'text-stone-600' : 'text-sky-400'}`}>
                            {r.name} {r.current}/{r.max}
                          </span>
                        ))}
                      </div>
                    )
                  } else {
                    const cb = activeCombatant.data
                    if (cb.conditions.length === 0) return null
                    return (
                      <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1.5">
                        {cb.conditions.map(cond => (
                          <span key={cond} className="text-purple-300 text-xs bg-purple-900/40 rounded px-1">{CONDITIONS_FR[cond] ?? cond}</span>
                        ))}
                      </div>
                    )
                  }
                })()}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Timer config */}
                <div className="flex items-center gap-1 mr-1">
                  {[0, 30, 45, 60].map(s => (
                    <button
                      key={s}
                      onClick={() => handleSetTurnTimerMax(s)}
                      className={`text-xs rounded px-1.5 py-0.5 transition-colors ${turnTimerMax === s ? 'bg-stone-700 text-stone-200' : 'text-stone-600 hover:text-stone-400'}`}
                    >
                      {s === 0 ? '–' : `${s}s`}
                    </button>
                  ))}
                </div>
                <button
                  onClick={prevTurn}
                  className="bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-300 rounded-lg px-3 py-2 text-sm transition-colors"
                >
                  ← Précédent
                </button>
                <span className="text-stone-500 text-sm">
                  {activeTurn + 1}/{withRollDisplay.length}
                </span>
                <button
                  onClick={nextTurn}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
                >
                  Suivant →
                </button>
              </div>
            </div>
            {/* Timer bar */}
            {turnTimerMax > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-mono ${turnTimerExpired ? 'text-red-400 font-bold' : turnTimerLeft <= 10 ? 'text-amber-400' : 'text-stone-500'}`}>
                    {turnTimerExpired ? '⏰ Temps écoulé !' : `${turnTimerLeft}s`}
                  </span>
                  <span className="text-stone-600 text-xs">{turnTimerMax}s / tour</span>
                </div>
                <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${turnTimerExpired ? 'bg-red-500' : turnTimerLeft <= 10 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: turnTimerMax > 0 ? `${(turnTimerLeft / turnTimerMax) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Combat timers */}
        {(timers.length > 0 || withRollDisplay.length > 0) && (
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

        {/* Macro roll result */}
        {macroResult && (
          <div className={`border rounded-xl px-5 py-3 flex items-center justify-between gap-4 ${
            macroResult.isAttack ? 'bg-rose-950/40 border-rose-700/50' : 'bg-orange-950/40 border-orange-700/50'
          }`}>
            <div>
              <p className="text-stone-400 text-xs">{macroResult.label}</p>
              <p className="text-stone-400 text-xs font-mono">{macroResult.detail}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-4xl font-black ${macroResult.isAttack ? 'text-rose-300' : 'text-orange-300'}`}>
                {macroResult.total}
              </span>
              <button onClick={() => setMacroResult(null)} className="text-stone-600 hover:text-stone-400 text-lg">×</button>
            </div>
          </div>
        )}

        {/* Initiative table */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-stone-800">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
              Ordre d'initiative
            </h2>
            <div className="flex items-center gap-3">
              {(characters.length > 0 || combatants.length > 0) && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleRollAllInitiative(false)}
                    className="bg-amber-600/20 hover:bg-amber-600/40 border border-amber-600/40 text-amber-400 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
                    title="Lance 1d20 + modificateur pour tous les participants"
                  >
                    ⚅ Lancer l'initiative
                  </button>
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
              {(characters.length > 0 || combatants.length > 0) && (
                <button
                  onClick={() => {
                    if (manualOrder) {
                      setManualOrder(null)
                    } else {
                      setManualOrder(sorted.map(rowId))
                    }
                  }}
                  className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                    manualOrder
                      ? 'bg-sky-700/40 border-sky-500 text-sky-300'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-sky-600/50 hover:text-sky-400'
                  }`}
                  title="Réordonner manuellement l'initiative"
                >
                  ⇅ Réordonner
                </button>
              )}
              {(characters.length > 0 || combatants.length > 0) && (
                <button
                  onClick={() => { setAoeMode(v => !v); setAoeSelected(new Set()); setAoeDamageInput('') }}
                  className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                    aoeMode
                      ? 'bg-orange-700/40 border-orange-500 text-orange-300'
                      : 'bg-stone-800 border-stone-700 text-stone-400 hover:border-orange-600/50 hover:text-orange-400'
                  }`}
                  title="Appliquer des dégâts à plusieurs cibles simultanément"
                >
                  🔥 Zone
                </button>
              )}
              {campaignId && combatants.some(c => c.current_hp <= 0) && characters.length > 0 && (
                <button
                  onClick={() => {
                    setShowXpPanel(v => !v)
                    if (!showXpPanel) {
                      const defaults: Record<number, string> = {}
                      combatants.filter(c => c.current_hp <= 0).forEach(c => {
                        defaults[c.id] = monsterMap[c.id] ? String(monsterMap[c.id].xp) : ''
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
              {characters.length > 0 && (
                <button
                  onClick={() => { setShowSavingThrow(v => !v); setSavingThrowResults(null) }}
                  className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                    showSavingThrow
                      ? 'bg-sky-700/30 border-sky-600 text-sky-400'
                      : 'bg-sky-900/20 border-sky-800/50 text-sky-500 hover:border-sky-700 hover:text-sky-400'
                  }`}
                >
                  🎲 JS groupe
                </button>
              )}
              {campaignId && combatants.length > 0 && (
                <button
                  onClick={handleClearCombatants}
                  className="text-red-600 hover:text-red-400 text-xs transition-colors"
                >
                  Vider ennemis
                </button>
              )}
              <button
                onClick={() => setShowCombatSummary(true)}
                className="text-amber-500 hover:text-amber-300 text-xs transition-colors"
              >
                ⚔ Fin du combat
              </button>
              {characters.length > 0 && (
                <button
                  onClick={() => setShowRestPanel(v => !v)}
                  className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors ${
                    showRestPanel
                      ? 'bg-sky-700/30 border-sky-600 text-sky-400'
                      : 'text-stone-500 hover:text-stone-300 border-transparent'
                  }`}
                >
                  ⛺ Repos
                </button>
              )}
              <button
                onClick={handleReset}
                className="text-stone-500 hover:text-stone-300 text-xs transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>

          {displayRows.length === 0 ? (
            <div className="px-5 py-10 text-center text-stone-500 text-sm">
              Aucun combattant.{' '}
              <Link to="/characters" className="text-amber-400 hover:text-amber-300">
                Créer un personnage
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-stone-800">
              {displayRows.map((row, displayIdx) => {
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
                      draggable={!!manualOrder}
                      onDragStart={manualOrder ? () => setDragRowId(rowId(row)) : undefined}
                      onDragOver={manualOrder ? e => { e.preventDefault(); setDragOverId(rowId(row)) } : undefined}
                      onDrop={manualOrder ? e => { e.preventDefault(); handleDrop(rowId(row)) } : undefined}
                      onDragEnd={manualOrder ? () => { setDragRowId(null); setDragOverId(null) } : undefined}
                      className={`px-5 py-4 transition-colors ${manualOrder ? 'cursor-grab' : ''} ${
                        manualOrder && dragRowId === rowId(row) ? 'opacity-40' :
                        manualOrder && dragOverId === rowId(row) && dragRowId !== rowId(row) ? 'border-t border-sky-500' :
                        isActive ? 'bg-amber-500/10 border-l-2 border-amber-500' :
                        'hover:bg-stone-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Reorder handle */}
                        {manualOrder && (
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

                        {/* Initiative */}
                        <div className="w-36 shrink-0">
                          <InitInput
                            value={character.combat.initiative_roll}
                            mod={character.combat.initiative}
                            onSet={roll => handleSetCharacterInitiative(character.id, roll)}
                          />
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
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
                              className={`font-semibold truncate hover:underline ${
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

                          {/* Sorts avec dés de dégâts */}
                          {character.spellcasting.ability && (() => {
                            const damageSpells = character.spellcasting.spells.filter(s => s.damage_dice && (s.prepared || s.level === 0))
                            if (damageSpells.length === 0) return null
                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {damageSpells.map((spell, si) => (
                                  <span key={si} className="inline-flex items-center gap-0.5">
                                    <button
                                      onClick={() => handleRollSpell(character, spell, 'attack')}
                                      title={`Attaque: 1d20${character.spellcasting.attack_bonus >= 0 ? '+' : ''}${character.spellcasting.attack_bonus} · DD ${character.spellcasting.save_dc}`}
                                      className="text-xs bg-violet-900/50 border border-violet-700/40 text-violet-300 rounded-l px-1.5 py-0.5 hover:bg-violet-800/60 transition-colors"
                                    >
                                      ✦ {spell.name}
                                    </button>
                                    <button
                                      onClick={() => handleRollSpell(character, spell, 'damage')}
                                      title={`Dégâts: ${spell.damage_dice}`}
                                      className="text-xs bg-indigo-900/50 border border-indigo-700/40 text-indigo-300 rounded-r px-1.5 py-0.5 hover:bg-indigo-800/60 transition-colors"
                                    >
                                      {spell.damage_dice}
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )
                          })()}

                          {/* Emplacements de sort */}
                          {character.spellcasting.ability && Object.keys(character.spellcasting.slots).length > 0 && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                              {Object.entries(character.spellcasting.slots)
                                .filter(([, slot]) => slot.max > 0)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([lvl, slot]) => {
                                  const available = slot.max - slot.used
                                  return (
                                    <span key={lvl} className="flex items-center gap-1">
                                      <span className="text-stone-600 text-xs w-3">{lvl}</span>
                                      {Array.from({ length: slot.max }, (_, i) => (
                                        <button
                                          key={i}
                                          onClick={() => handleUseSlot(character, Number(lvl), i < available ? 'use' : 'restore')}
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
                          )}

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
                    draggable={!!manualOrder}
                    onDragStart={manualOrder ? () => setDragRowId(rowId(row)) : undefined}
                    onDragOver={manualOrder ? e => { e.preventDefault(); setDragOverId(rowId(row)) } : undefined}
                    onDrop={manualOrder ? e => { e.preventDefault(); handleDrop(rowId(row)) } : undefined}
                    onDragEnd={manualOrder ? () => { setDragRowId(null); setDragOverId(null) } : undefined}
                    className={`px-5 py-4 transition-colors ${manualOrder ? 'cursor-grab' : ''} ${
                      manualOrder && dragRowId === rowId(row) ? 'opacity-40' :
                      manualOrder && dragOverId === rowId(row) && dragRowId !== rowId(row) ? 'border-t border-sky-500' :
                      isActive ? 'bg-red-500/10 border-l-2 border-red-500' :
                      'hover:bg-stone-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Reorder handle */}
                      {manualOrder && (
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

                      {/* Initiative */}
                      <div className="w-36 shrink-0">
                        <InitInput
                          value={cb.initiative_roll}
                          mod={0}
                          onSet={roll => handleSetCombatantInitiative(cb.id, roll)}
                        />
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
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
                              className={`font-semibold truncate text-left ${(campaign?.custom_monsters ?? []).some(m => m.name === cb.name) ? 'hover:underline cursor-pointer' : 'cursor-default'} ${isActive ? 'text-red-300' : isDying ? 'text-red-400' : 'text-white'}`}
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
                      {monsterMap[cb.id] && (
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
                    {expandedMonster === cb.id && monsterMap[cb.id] && (() => {
                      const m = monsterMap[cb.id]
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
          )}

          {/* AoE damage bar */}
          {aoeMode && (
            <div className="border-t border-orange-800/50 bg-orange-950/20 px-5 py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-orange-400 text-xs font-semibold uppercase tracking-wider">
                  🔥 Zone — {aoeSelected.size} cible{aoeSelected.size > 1 ? 's' : ''} sélectionnée{aoeSelected.size > 1 ? 's' : ''}
                </span>
                <input
                  type="number"
                  min={1}
                  value={aoeDamageInput}
                  onChange={e => setAoeDamageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAoeDamage('damage') }}
                  placeholder="Montant"
                  autoFocus
                  className="w-24 bg-stone-800 border border-orange-700/50 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-orange-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => handleAoeDamage('damage')}
                  disabled={!aoeDamageInput || aoeSelected.size === 0}
                  className="bg-red-700/60 hover:bg-red-600/80 disabled:opacity-40 border border-red-600/50 text-red-200 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                >
                  Dégâts
                </button>
                <button
                  onClick={() => handleAoeDamage('heal')}
                  disabled={!aoeDamageInput || aoeSelected.size === 0}
                  className="bg-emerald-700/60 hover:bg-emerald-600/80 disabled:opacity-40 border border-emerald-600/50 text-emerald-200 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                >
                  Soins
                </button>
                <span className="text-stone-700">|</span>
                <select
                  value={aoeCondition}
                  onChange={e => setAoeCondition(e.target.value)}
                  className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-stone-300 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="">État...</option>
                  {Object.entries(CONDITIONS_FR).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <button
                  onClick={handleAoeCondition}
                  disabled={!aoeCondition || aoeSelected.size === 0}
                  className="bg-purple-800/60 hover:bg-purple-700/80 disabled:opacity-40 border border-purple-700/50 text-purple-200 text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors"
                >
                  Appliquer
                </button>
                <button
                  onClick={() => { setAoeMode(false); setAoeSelected(new Set()); setAoeDamageInput(''); setAoeCondition('') }}
                  className="text-stone-500 hover:text-stone-300 text-xs transition-colors ml-auto"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Add combatant section */}
          {campaignId && (
            <div className="border-t border-stone-800 px-5 py-3">
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
                                setCombatantDraft(prev => ({ ...prev, name: m.name, max_hp: String(m.hp_avg), ac: String(m.ac) }))
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
                      onClick={() => { setAddingCombatant(false); setCombatantDraft({ name: '', faction: 'ennemi', max_hp: '', ac: '', initiative: '' }); setMonsterSuggestions([]) }}
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
                const filteredMonsters = allMonsters.filter(m =>
                  m.name.toLowerCase().includes(encounterSearch.toLowerCase()) &&
                  (CR_NUM[m.cr] ?? 0) >= (CR_NUM[encounterMinCr] ?? 0) &&
                  (CR_NUM[m.cr] ?? 0) <= (CR_NUM[encounterMaxCr] ?? 30)
                )
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
                        {campaign!.saved_encounters!.map((saved, i) => {
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
                          className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-stone-600 focus:outline-none focus:border-violet-500 transition-colors"
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
        {showSavingThrow && (
          <div className="bg-stone-900 border border-sky-800/40 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sky-400 text-xs font-semibold uppercase tracking-widest">🎲 Jet de sauvegarde de groupe</h2>
              <button onClick={() => { setShowSavingThrow(false); setSavingThrowResults(null) }} className="text-stone-600 hover:text-stone-400 text-sm">×</button>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={savingThrowAbility}
                onChange={e => { setSavingThrowAbility(e.target.value as typeof savingThrowAbility); setSavingThrowResults(null) }}
                className="bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 transition-colors"
              >
                <option value="strength">Force (FOR)</option>
                <option value="dexterity">Dextérité (DEX)</option>
                <option value="constitution">Constitution (CON)</option>
                <option value="intelligence">Intelligence (INT)</option>
                <option value="wisdom">Sagesse (SAG)</option>
                <option value="charisma">Charisme (CHA)</option>
              </select>
              <div className="flex items-center gap-2">
                <span className="text-stone-500 text-sm">DD</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={savingThrowDC}
                  onChange={e => { setSavingThrowDC(e.target.value); setSavingThrowResults(null) }}
                  className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm text-center focus:outline-none focus:border-sky-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <button
                onClick={handleGroupSavingThrow}
                className="bg-sky-700 hover:bg-sky-600 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors"
              >
                Lancer
              </button>
            </div>

            {savingThrowResults && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {savingThrowResults.map((r, i) => (
                  <div key={i} className={`rounded-lg px-3 py-2 border ${
                    r.success
                      ? 'bg-emerald-900/30 border-emerald-700/50'
                      : 'bg-red-900/30 border-red-700/50'
                  }`}>
                    <p className="text-stone-200 text-xs font-semibold truncate">{r.name}</p>
                    <p className={`text-sm font-bold ${r.success ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.total} {r.success ? '✓' : '✗'}
                    </p>
                    <p className="text-stone-600 text-xs">{r.roll} + {r.mod >= 0 ? r.mod : `(${r.mod})`}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

        {/* Group rest panel */}
        {showRestPanel && characters.length > 0 && (
          <div className="bg-stone-900 border border-sky-800/40 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sky-400 text-xs font-semibold uppercase tracking-widest">⛺ Repos du groupe</h2>
              <button onClick={() => setShowRestPanel(false)} className="text-stone-600 hover:text-stone-400 text-sm">×</button>
            </div>
            <p className="text-stone-500 text-xs">
              {characters.map(c => `${c.name} (${c.combat.current_hp}/${c.combat.max_hp} PV${c.combat.hit_dice_remaining > 0 ? `, ${c.combat.hit_dice_remaining} DV` : ''})`).join(' · ')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleGroupRest('short')}
                disabled={restInProgress}
                className="flex-1 bg-sky-900/40 hover:bg-sky-800/60 disabled:opacity-50 border border-sky-700/50 text-sky-300 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                Court repos (1 DV/perso)
              </button>
              <button
                onClick={() => handleGroupRest('long')}
                disabled={restInProgress}
                className="flex-1 bg-violet-900/40 hover:bg-violet-800/60 disabled:opacity-50 border border-violet-700/50 text-violet-300 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
              >
                Long repos (PV + emplacements)
              </button>
            </div>
          </div>
        )}

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
              <div className="divide-y divide-stone-800/50 max-h-72 overflow-y-auto">
                {combatLog.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-2">
                    <span className={`shrink-0 text-xs mt-0.5 ${
                      entry.type === 'turn' ? 'text-amber-500' :
                      entry.type === 'roll' ? 'text-rose-400' :
                      entry.type === 'hp'   ? 'text-sky-400' :
                      entry.type === 'xp'   ? 'text-emerald-400' :
                                              'text-violet-400'
                    }`}>
                      {entry.type === 'turn' ? '⟳' :
                       entry.type === 'roll' ? '🎲' :
                       entry.type === 'hp'   ? '❤' :
                       entry.type === 'xp'   ? '⬆' : '➕'}
                    </span>
                    <span className="flex-1 text-stone-300 text-xs">{entry.text}</span>
                    <span className="shrink-0 text-stone-600 text-xs">{entry.time}</span>
                  </div>
                ))}
              </div>
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
          monsterMap={monsterMap}
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
