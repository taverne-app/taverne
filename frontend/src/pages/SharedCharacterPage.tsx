import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedCharacter, type Character, type AbilityName, type DiceRoll } from '../api/characters'
import { updateSharedCharacterHp, rollSharedDice } from '../api/share'
import { MarkdownText } from '../components/MarkdownText'
import { createPublicEcho, REALTIME_CONFIGURED } from '../lib/echo'
import { TIME_OF_DAY_CONFIG, type TimeOfDay } from '../lib/timeOfDay'

const ABILITY_LABELS: [AbilityName, string, string][] = [
  ['strength', 'FOR', 'Force'],
  ['dexterity', 'DEX', 'Dextérité'],
  ['constitution', 'CON', 'Constitution'],
  ['intelligence', 'INT', 'Intelligence'],
  ['wisdom', 'SAG', 'Sagesse'],
  ['charisma', 'CHA', 'Charisme'],
]

const CONDITIONS_FR: Record<string, string> = {
  blinded: 'Aveuglé', charmed: 'Charmé', deafened: 'Assourdi',
  exhaustion: 'Épuisé', frightened: 'Effrayé', grappled: 'Agrippé',
  incapacitated: 'Hors de combat', invisible: 'Invisible', paralyzed: 'Paralysé',
  petrified: 'Pétrifié', poisoned: 'Empoisonné', prone: 'À terre',
  restrained: 'Entravé', stunned: 'Étourdi', unconscious: 'Inconscient',
}

const SKILL_LABELS: Record<string, string> = {
  acrobatics: 'Acrobaties', animal_handling: 'Dressage', arcana: 'Arcanes',
  athletics: 'Athlétisme', deception: 'Tromperie', history: 'Histoire',
  insight: 'Perspicacité', intimidation: 'Intimidation', investigation: 'Investigation',
  medicine: 'Médecine', nature: 'Nature', perception: 'Perception',
  performance: 'Représentation', persuasion: 'Persuasion', religion: 'Religion',
  sleight_of_hand: 'Escamotage', stealth: 'Discrétion', survival: 'Survie',
}

const SPELL_LEVEL_LABELS: Record<number, string> = {
  0: 'Tours de magie', 1: 'Niv. 1', 2: 'Niv. 2', 3: 'Niv. 3',
  4: 'Niv. 4', 5: 'Niv. 5', 6: 'Niv. 6', 7: 'Niv. 7', 8: 'Niv. 8', 9: 'Niv. 9',
}

function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}


function RollToast({ roll, onDismiss }: { roll: DiceRoll; onDismiss: () => void }) {
  const isNat20 = roll.sides === 20 && (roll.advantage ? Math.max(...roll.rolls) : roll.rolls[0]) === 20
  const isNat1 = roll.sides === 20 && (roll.disadvantage ? Math.max(...roll.rolls) : roll.rolls[0]) === 1

  return (
    <div
      className={`rounded-xl border p-4 flex items-center justify-between gap-4 shadow-lg cursor-pointer transition-colors ${
        isNat20
          ? 'bg-amber-950/80 border-amber-600 hover:border-amber-500'
          : isNat1
            ? 'bg-red-950/80 border-red-700 hover:border-red-600'
            : 'bg-stone-900 border-stone-700 hover:border-stone-600'
      }`}
      onClick={onDismiss}
    >
      <div className="min-w-0">
        <p className="text-stone-400 text-xs">{roll.label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className={`text-3xl font-bold ${isNat20 ? 'text-amber-400' : isNat1 ? 'text-red-400' : 'text-white'}`}>
            {roll.total}
          </span>
          {roll.modifier !== 0 && (
            <span className="text-stone-500 text-sm">
              ({roll.advantage ? `avantage` : roll.disadvantage ? `désavantage` : `d${roll.sides}`}
              {roll.advantage || roll.disadvantage
                ? ` [${roll.rolls.join(', ')}]`
                : roll.rolls.length === 1 ? ` = ${roll.rolls[0]}` : ` = ${roll.rolls.join('+')} = ${roll.rolls.reduce((a, b) => a + b, 0)}`}
              {roll.modifier !== 0 ? ` ${sign(roll.modifier)}` : ''})
            </span>
          )}
          {isNat20 && <span className="text-amber-400 text-sm font-semibold">✦ 20 naturel !</span>}
          {isNat1 && <span className="text-red-400 text-sm font-semibold">✗ 1 naturel</span>}
        </div>
      </div>
      <span className="text-stone-600 text-xs shrink-0">Tap pour fermer</span>
    </div>
  )
}

export function SharedCharacterPage() {
  const { token } = useParams<{ token: string }>()
  const [character, setCharacter] = useState<Character | null>(null)
  const [error, setError] = useState(false)
  const [lastRoll, setLastRoll] = useState<DiceRoll | null>(null)
  const [rolling, setRolling] = useState(false)
  const [advantage, setAdvantage] = useState<'normal' | 'adv' | 'dis'>('normal')
  const [hpInput, setHpInput] = useState('1')
  const [hpLoading, setHpLoading] = useState(false)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [combatRound, setCombatRound] = useState<number | null>(null)
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('none')
  const rollToastRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    getSharedCharacter(token)
      .then(c => {
        setCharacter(c)
        setTimeOfDay((c.campaign_time_of_day as TimeOfDay) ?? 'none')
        document.title = `${c.name} — Taverne`
      })
      .catch(() => setError(true))
  }, [token])

  useEffect(() => {
    if (!character?.campaign_share_token || !REALTIME_CONFIGURED) return
    const echo = createPublicEcho()
    echo.channel(`campaign-share.${character.campaign_share_token}`)
      .listen('.combat.turn-updated', (e: { active_kind: string | null; active_id: number | null; round: number }) => {
        setIsMyTurn(e.active_kind === 'character' && e.active_id === character.id)
        setCombatRound(e.round)
      })
      .listen('.campaign.time-updated', (e: { time_of_day: string | null }) => {
        setTimeOfDay((e.time_of_day as TimeOfDay) ?? 'none')
      })
    return () => { echo.leave(`campaign-share.${character.campaign_share_token!}`); echo.disconnect() }
  }, [character?.campaign_share_token, character?.id])

  async function roll(params: { sides: number; count?: number; modifier?: number; label?: string }) {
    if (!token || rolling) return
    setRolling(true)
    try {
      const result = await rollSharedDice(token, {
        ...params,
        advantage: advantage === 'adv',
        disadvantage: advantage === 'dis',
      })
      setLastRoll(result)
      rollToastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } catch { /* ignore */ }
    finally { setRolling(false) }
  }

  async function handleHp(type: 'damage' | 'heal') {
    if (!token || !character || hpLoading) return
    const amount = parseInt(hpInput, 10)
    if (!amount || amount < 1) return
    setHpLoading(true)
    try {
      const updated = await updateSharedCharacterHp(token, amount, type)
      setCharacter(updated)
    } catch { /* ignore */ }
    finally { setHpLoading(false) }
  }

  if (error) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <p className="text-red-400">Fiche introuvable ou lien expiré.</p>
    </div>
  )
  if (!character) return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hpPct = Math.max(0, Math.min(100, (character.combat.current_hp / character.combat.max_hp) * 100))
  const isDying = character.combat.current_hp <= 0

  const tod = TIME_OF_DAY_CONFIG[timeOfDay]

  const slots = Object.entries(character.spellcasting.slots)
    .filter(([, s]) => s.max > 0)
    .sort(([a], [b]) => Number(a) - Number(b))

  const spellsByLevel = character.spellcasting.spells.reduce<Record<number, typeof character.spellcasting.spells>>((acc, spell) => {
    const lvl = spell.level
    if (!acc[lvl]) acc[lvl] = []
    acc[lvl].push(spell)
    return acc
  }, {})

  const allSkills = Object.entries(character.skills).sort(([a], [b]) => a.localeCompare(b))
  const currency = character.currency
  const hasCurrency = Object.values(currency).some(v => v > 0)
  const equippedItems = character.inventory.items.filter(i => i.equipped)

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* Header — dark chrome */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          {character.portrait_url && (
            <img
              src={character.portrait_url}
              alt={character.name}
              className="w-8 h-8 rounded-full object-cover border border-stone-700 shrink-0"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className={`font-bold text-base leading-tight truncate ${isDying ? 'text-red-400' : 'text-white'}`}>
              {character.name}
            </h1>
            <p className="text-stone-500 text-xs truncate">
              {character.race} · {character.character_class}{character.subclass ? ` (${character.subclass})` : ''} · Niv. {character.level}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`text-lg font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
              {character.combat.current_hp}
              <span className="text-stone-500 text-sm font-normal">/{character.combat.max_hp}</span>
            </p>
            <p className="text-stone-500 text-xs">PV</p>
          </div>
        </div>
      </header>

      {/* Combat banner — dark */}
      {combatRound !== null && (
        <div className={`border-b px-4 py-3 transition-colors ${
          isMyTurn
            ? 'bg-amber-950/80 border-amber-600'
            : 'bg-stone-900/80 border-stone-800'
        }`}>
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMyTurn
                ? <span className="text-amber-400 font-semibold">⚔ C'est ton tour !</span>
                : <span className="text-stone-400 text-sm">Combat en cours — Round {combatRound}</span>
              }
            </div>
            {isMyTurn && (
              <span className="text-amber-600 text-xs animate-pulse">Agis maintenant</span>
            )}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto pb-10">

        {/* Parchment card */}
        <div
          className="mx-4 mt-4 rounded-2xl overflow-hidden border border-stone-300/30 shadow-[0_12px_56px_rgba(0,0,0,0.55),_0_2px_8px_rgba(0,0,0,0.3)]"
          style={{ backgroundColor: tod.parchmentColor, transition: 'background-color 3000ms ease' }}
        >
          <div className="p-4 space-y-4">

            {/* Dice result toast */}
            <div ref={rollToastRef}>
              {lastRoll ? (
                <RollToast roll={lastRoll} onDismiss={() => setLastRoll(null)} />
              ) : (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 p-3 text-center text-stone-500 text-xs">
                  Clique sur un modificateur pour lancer les dés ⚅
                </div>
              )}
            </div>

            {/* Advantage toggle */}
            <div className="flex rounded-lg overflow-hidden border border-amber-300/70 text-xs font-semibold">
              {([['dis', '↓ Désavantage'], ['normal', 'Normal'], ['adv', '↑ Avantage']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setAdvantage(val)}
                  className={`flex-1 py-2 transition-colors ${
                    advantage === val
                      ? val === 'adv'
                        ? 'bg-emerald-600 text-white'
                        : val === 'dis'
                          ? 'bg-red-700 text-white'
                          : 'bg-stone-600 text-white'
                      : 'bg-amber-50 text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* HP management */}
            <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
              <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Points de vie</h2>
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-3xl font-bold ${isDying ? 'text-red-600' : 'text-stone-900'}`}>
                  {character.combat.current_hp}
                </span>
                <span className="text-stone-500 text-lg">/ {character.combat.max_hp}</span>
                {character.combat.temporary_hp > 0 && (
                  <span className="text-sky-600 text-sm font-semibold">+{character.combat.temporary_hp} tmp</span>
                )}
                {character.combat.inspiration && (
                  <span className="text-amber-700 text-xs font-semibold ml-auto">✦ Inspiration</span>
                )}
              </div>
              <div className="h-3 bg-amber-200 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all ${hpColor(character.combat.current_hp, character.combat.max_hp)}`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={hpInput}
                  onChange={e => setHpInput(e.target.value)}
                  className="w-20 bg-white border border-amber-400 rounded-lg px-3 py-2 text-stone-900 text-center text-sm font-bold focus:outline-none focus:border-amber-600"
                />
                <button
                  onClick={() => handleHp('damage')}
                  disabled={hpLoading}
                  className="flex-1 py-2 bg-red-100 hover:bg-red-200/80 border border-red-400 text-red-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Dégâts
                </button>
                <button
                  onClick={() => handleHp('heal')}
                  disabled={hpLoading}
                  className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200/80 border border-emerald-500 text-emerald-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Soins
                </button>
              </div>
              {character.state.conditions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200/60 flex flex-wrap gap-1.5">
                  {character.state.conditions.map(c => (
                    <span key={c} className="text-xs bg-purple-100/80 border border-purple-400/50 text-purple-800 rounded px-2 py-0.5">
                      {CONDITIONS_FR[c] ?? c}
                      {character.state.condition_durations[c] ? ` (${character.state.condition_durations[c]}R)` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Combat stats + initiative */}
            <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
              <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Combat</h2>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {[
                  ['CA', String(character.combat.armor_class)],
                  ['Vitesse', `${character.combat.speed} m`],
                  ['Perc.', String(character.passive_perception)],
                ].map(([label, value]) => (
                  <div key={label} className="bg-amber-100/60 rounded-lg p-2">
                    <p className="text-stone-500 mb-0.5">{label}</p>
                    <p className="font-bold text-stone-900">{value}</p>
                  </div>
                ))}
                <button
                  onClick={() => roll({ sides: 20, modifier: character.combat.initiative, label: 'Initiative' })}
                  disabled={rolling}
                  className="bg-amber-100/60 hover:bg-amber-200/70 hover:border-amber-500 border border-amber-200/60 rounded-lg p-2 transition-colors disabled:opacity-50"
                >
                  <p className="text-stone-500 text-xs mb-0.5">Init.</p>
                  <p className="font-bold text-amber-700">{sign(character.combat.initiative)}</p>
                </button>
              </div>
              {character.state.concentrating_on && (
                <div className="mt-3 pt-3 border-t border-amber-200/60">
                  <span className="text-xs bg-violet-100/60 border border-violet-400/50 text-violet-800 rounded px-2 py-1">
                    ◈ Concentration : {character.state.concentrating_on}
                  </span>
                </div>
              )}
            </div>

            {/* Abilities + saving throws */}
            <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
              <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Caractéristiques</h2>
              <div className="grid grid-cols-6 gap-2 text-center">
                {ABILITY_LABELS.map(([key, abbr, fullName]) => (
                  <button
                    key={key}
                    onClick={() => roll({ sides: 20, modifier: character.modifiers[key], label: `Jet de ${fullName}` })}
                    disabled={rolling}
                    className="bg-amber-100/60 hover:bg-amber-200/70 hover:border-amber-500 border border-amber-200/60 rounded-lg p-2 transition-colors disabled:opacity-50"
                  >
                    <p className="text-stone-500 text-xs mb-1">{abbr}</p>
                    <p className="font-bold text-stone-900 text-lg leading-none">{character.abilities[key] ?? 10}</p>
                    <p className="text-amber-700 text-xs mt-1">{sign(character.modifiers[key])}</p>
                  </button>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-amber-200/60">
                <p className="text-stone-500 text-xs mb-2">Jets de sauvegarde</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {ABILITY_LABELS.map(([key, abbr, fullName]) => {
                    const st = character.saving_throws[key]
                    return (
                      <button
                        key={key}
                        onClick={() => roll({ sides: 20, modifier: st?.modifier ?? 0, label: `Save ${fullName}` })}
                        disabled={rolling}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-200/50 transition-colors disabled:opacity-50"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${st?.proficient ? 'bg-amber-500' : 'bg-stone-300'}`} />
                        <span className="text-stone-600 text-xs">{abbr}</span>
                        <span className={`text-xs font-semibold ml-auto ${st?.proficient ? 'text-stone-900' : 'text-stone-500'}`}>
                          {sign(st?.modifier ?? 0)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
              <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Compétences</h2>
              <div className="grid grid-cols-2 gap-0.5">
                {allSkills.map(([key, v]) => (
                  <button
                    key={key}
                    onClick={() => roll({ sides: 20, modifier: v.modifier, label: SKILL_LABELS[key] ?? key })}
                    disabled={rolling}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-200/50 transition-colors text-left disabled:opacity-50"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${v.expert ? 'bg-amber-500' : v.proficient ? 'bg-stone-400' : 'bg-stone-300'}`} />
                    <span className={`text-xs truncate ${v.proficient || v.expert ? 'text-stone-800' : 'text-stone-500'}`}>{SKILL_LABELS[key] ?? key}</span>
                    <span className={`text-xs font-semibold ml-auto ${v.proficient || v.expert ? 'text-stone-900' : 'text-stone-500'}`}>{sign(v.modifier)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Attack macros */}
            {character.attack_macros.length > 0 && (
              <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
                <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Attaques</h2>
                <div className="space-y-2">
                  {character.attack_macros.map((macro, i) => (
                    <div key={i} className="bg-amber-100/60 rounded-lg px-3 py-2 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-stone-800 text-sm font-medium truncate">{macro.name}</p>
                        {macro.range && <p className="text-stone-500 text-xs">{macro.range}</p>}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {macro.attack_bonus != null && (
                          <button
                            onClick={() => roll({ sides: 20, modifier: macro.attack_bonus!, label: `Attaque — ${macro.name}` })}
                            disabled={rolling}
                            className="text-xs px-2 py-1 rounded bg-rose-100 hover:bg-rose-200/80 border border-rose-400 text-rose-700 transition-colors disabled:opacity-50"
                          >
                            {sign(macro.attack_bonus)} att.
                          </button>
                        )}
                        {macro.damage_dice && (
                          <button
                            onClick={() => {
                              const m = macro.damage_dice.match(/^(\d+)d(\d+)([+-]\d+)?$/)
                              if (m) {
                                roll({ count: parseInt(m[1]), sides: parseInt(m[2]), modifier: m[3] ? parseInt(m[3]) : 0, label: `Dégâts — ${macro.name}` })
                              }
                            }}
                            disabled={rolling}
                            className="text-xs px-2 py-1 rounded bg-orange-100 hover:bg-orange-200/80 border border-orange-400 text-orange-700 transition-colors disabled:opacity-50"
                          >
                            {macro.damage_dice}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spell slots + spells */}
            {slots.length > 0 && (
              <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
                <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Magie</h2>
                <div className="flex items-center gap-3 mb-3 text-xs text-stone-600">
                  {character.spellcasting.ability && (
                    <>
                      <span>Caract. : <span className="text-stone-900 font-semibold">{character.spellcasting.ability.toUpperCase()}</span></span>
                      <span>DD <span className="text-stone-900 font-semibold">{character.spellcasting.save_dc}</span></span>
                      <span>Att. <span className="text-stone-900 font-semibold">{sign(character.spellcasting.attack_bonus)}</span></span>
                    </>
                  )}
                </div>
                <div className="space-y-2 mb-4">
                  {slots.map(([lvl, slot]) => {
                    const available = slot.max - slot.used
                    return (
                      <div key={lvl} className="flex items-center gap-3">
                        <span className="text-stone-500 text-xs w-14 shrink-0">Niv. {lvl}</span>
                        <div className="flex gap-1.5">
                          {Array.from({ length: slot.max }, (_, i) => (
                            <span key={i} className={`w-4 h-4 rounded-full border-2 ${i < available ? 'bg-violet-500 border-violet-400' : 'bg-transparent border-stone-400'}`} />
                          ))}
                        </div>
                        <span className="text-stone-500 text-xs">{available}/{slot.max}</span>
                      </div>
                    )
                  })}
                </div>
                {Object.keys(spellsByLevel).length > 0 && (
                  <div className="space-y-3 border-t border-amber-200/60 pt-3">
                    {Object.entries(spellsByLevel)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([lvl, spells]) => (
                        <div key={lvl}>
                          <p className="text-stone-500 text-xs font-semibold mb-1.5">{SPELL_LEVEL_LABELS[Number(lvl)] ?? `Niv. ${lvl}`}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {spells.map((spell, i) => (
                              <div key={i} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border text-xs ${spell.prepared ? 'bg-violet-100/60 border-violet-500/50 text-violet-900' : 'bg-amber-50 border-amber-200 text-stone-500'}`}>
                                {spell.concentration && <span className="text-violet-600">◈</span>}
                                <span className="font-medium">{spell.name}</span>
                                {spell.damage_dice && <span className="text-indigo-700">{spell.damage_dice}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}

            {/* Resources */}
            {character.resources.length > 0 && (
              <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
                <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Ressources</h2>
                <div className="space-y-2">
                  {character.resources.map((r, i) => {
                    const pct = r.max > 0 ? (r.current / r.max) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-stone-700 text-sm">{r.name}</span>
                          <span className="text-stone-500 text-xs font-mono">{r.current}/{r.max}</span>
                        </div>
                        <div className="h-1.5 bg-amber-200 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Inventory */}
            {equippedItems.length > 0 && (
              <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
                <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Équipement</h2>
                <div className="space-y-1">
                  {equippedItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-600 text-xs shrink-0">●</span>
                      <span className="text-stone-800 flex-1 truncate">{item.name}</span>
                      {item.quantity > 1 && <span className="text-stone-500 text-xs shrink-0">×{item.quantity}</span>}
                      {item.magical && <span className="text-violet-600 text-xs shrink-0">✦</span>}
                    </div>
                  ))}
                </div>
                {character.inventory.items.filter(i => !i.equipped).length > 0 && (
                  <details className="mt-3">
                    <summary className="text-stone-500 text-xs cursor-pointer hover:text-stone-700 transition-colors">
                      + {character.inventory.items.filter(i => !i.equipped).length} objets non équipés
                    </summary>
                    <div className="mt-2 space-y-1">
                      {character.inventory.items.filter(i => !i.equipped).map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-stone-400 text-xs shrink-0">○</span>
                          <span className="text-stone-600 flex-1 truncate">{item.name}</span>
                          {item.quantity > 1 && <span className="text-stone-500 text-xs shrink-0">×{item.quantity}</span>}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Currency */}
            {hasCurrency && (
              <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
                <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Monnaie</h2>
                <div className="flex flex-wrap gap-3">
                  {([['pp', 'Platine'], ['po', 'Or'], ['pe', 'Électrum'], ['pa', 'Argent'], ['pc', 'Cuivre']] as const).map(([key, label]) => {
                    const val = currency[key]
                    if (!val) return null
                    return (
                      <div key={key} className="text-center">
                        <p className="text-stone-500 text-xs">{label}</p>
                        <p className="text-stone-900 font-bold">{val}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Features */}
            {character.features.length > 0 && (
              <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
                <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Traits & capacités</h2>
                <div className="space-y-3">
                  {character.features.map((f, i) => (
                    <div key={i}>
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <p className="text-stone-800 text-sm font-medium">{f.name}</p>
                        {f.source && <p className="text-stone-500 text-xs">{f.source}</p>}
                      </div>
                      {f.description && <p className="text-stone-600 text-xs leading-relaxed">{f.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {character.notes && (
              <div className="bg-white/30 border border-amber-200/60 rounded-xl p-4">
                <h2 className="text-amber-900/70 text-xs font-semibold uppercase tracking-widest mb-3">Notes</h2>
                <MarkdownText className="text-stone-700">{character.notes}</MarkdownText>
              </div>
            )}

            <p className="text-center text-amber-800/40 text-xs pt-2 pb-2">
              Fiche joueur — Taverne
            </p>

          </div>
        </div>

      </main>
    </div>
  )
}
