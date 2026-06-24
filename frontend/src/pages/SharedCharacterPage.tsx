import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedCharacter, type Character, type AbilityName } from '../api/characters'
import { MarkdownText } from '../components/MarkdownText'

const ABILITY_LABELS: [AbilityName, string][] = [
  ['strength', 'FOR'], ['dexterity', 'DEX'], ['constitution', 'CON'],
  ['intelligence', 'INT'], ['wisdom', 'SAG'], ['charisma', 'CHA'],
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
      <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">{title}</h2>
      {children}
    </div>
  )
}

export function SharedCharacterPage() {
  const { token } = useParams<{ token: string }>()
  const [character, setCharacter] = useState<Character | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!token) return
    getSharedCharacter(token)
      .then(c => { setCharacter(c); document.title = `${c.name} — Fiche` })
      .catch(() => setError(true))
  }, [token])

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

  const slots = Object.entries(character.spellcasting.slots)
    .filter(([, s]) => s.max > 0)
    .sort(([a], [b]) => Number(a) - Number(b))

  const spellsByLevel = character.spellcasting.spells.reduce<Record<number, typeof character.spellcasting.spells>>((acc, spell) => {
    const lvl = spell.level
    if (!acc[lvl]) acc[lvl] = []
    acc[lvl].push(spell)
    return acc
  }, {})

  const proficientSkills = Object.entries(character.skills)
    .filter(([, v]) => v.proficient || v.expert)
    .sort(([a], [b]) => a.localeCompare(b))

  const currency = character.currency
  const hasCurrency = Object.values(currency).some(v => v > 0)
  const equippedItems = character.inventory.items.filter(i => i.equipped)

  return (
    <div className="min-h-screen bg-stone-950 text-white">
      {/* Header */}
      <header className="border-b border-stone-800 bg-stone-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {character.portrait_url && (
              <img
                src={character.portrait_url}
                alt={character.name}
                className="w-8 h-8 rounded-full object-cover border border-stone-700 shrink-0"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="min-w-0">
              <h1 className={`font-bold text-lg leading-tight truncate ${isDying ? 'text-red-400' : 'text-white'}`}>
                {character.name}
              </h1>
              <p className="text-stone-500 text-xs truncate">
                {character.race} · {character.character_class}{character.subclass ? ` (${character.subclass})` : ''} · Niv. {character.level}
                {character.background ? ` · ${character.background}` : ''}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-stone-500 text-xs">Vue lecture seule</p>
            <p className="text-stone-600 text-xs">🔒 Taverne</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* HP + combat stats */}
        <Section title="Combat">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className={`text-3xl font-bold ${isDying ? 'text-red-400' : 'text-white'}`}>
                {character.combat.current_hp}
              </span>
              <span className="text-stone-500 text-lg ml-1">/ {character.combat.max_hp}</span>
              {character.combat.temporary_hp > 0 && (
                <span className="text-sky-400 text-sm font-semibold ml-2">+{character.combat.temporary_hp} tmp</span>
              )}
            </div>
            <div className="text-right space-y-0.5">
              {character.combat.inspiration && (
                <p className="text-amber-400 text-xs font-semibold">✦ Inspiration</p>
              )}
              {character.state.exhaustion_level > 0 && (
                <p className="text-orange-400 text-xs font-semibold">Épuisement {character.state.exhaustion_level}</p>
              )}
            </div>
          </div>
          <div className="h-3 bg-stone-700 rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all ${hpColor(character.combat.current_hp, character.combat.max_hp)}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              ['CA', String(character.combat.armor_class)],
              ['Vitesse', `${character.combat.speed} m`],
              ['Init.', sign(character.combat.initiative)],
              ['Perc.', String(character.passive_perception)],
            ].map(([label, value]) => (
              <div key={label} className="bg-stone-800 rounded-lg p-2">
                <p className="text-stone-500 mb-0.5">{label}</p>
                <p className="font-bold text-white">{value}</p>
              </div>
            ))}
          </div>
          {character.state.concentrating_on && (
            <div className="mt-3 pt-3 border-t border-stone-800">
              <span className="text-xs bg-violet-900/50 border border-violet-700/50 text-violet-300 rounded px-2 py-1">
                ◈ Concentration : {character.state.concentrating_on}
              </span>
            </div>
          )}
          {character.state.conditions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-800 flex flex-wrap gap-1.5">
              {character.state.conditions.map(c => (
                <span key={c} className="text-xs bg-purple-900/60 border border-purple-700/50 text-purple-300 rounded px-2 py-0.5">
                  {CONDITIONS_FR[c] ?? c}
                  {character.state.condition_durations[c] ? ` (${character.state.condition_durations[c]}R)` : ''}
                </span>
              ))}
            </div>
          )}
          {/* Damage modifiers */}
          {(character.damage_modifiers.resistances.length > 0 ||
            character.damage_modifiers.immunities.length > 0 ||
            character.damage_modifiers.vulnerabilities.length > 0) && (
            <div className="mt-3 pt-3 border-t border-stone-800 space-y-1 text-xs">
              {character.damage_modifiers.resistances.length > 0 && (
                <p className="text-sky-400">Résistances : {character.damage_modifiers.resistances.join(', ')}</p>
              )}
              {character.damage_modifiers.immunities.length > 0 && (
                <p className="text-emerald-400">Immunités : {character.damage_modifiers.immunities.join(', ')}</p>
              )}
              {character.damage_modifiers.vulnerabilities.length > 0 && (
                <p className="text-red-400">Vulnérabilités : {character.damage_modifiers.vulnerabilities.join(', ')}</p>
              )}
            </div>
          )}
        </Section>

        {/* Abilities */}
        <Section title="Caractéristiques">
          <div className="grid grid-cols-6 gap-2 text-center">
            {ABILITY_LABELS.map(([key, abbr]) => (
              <div key={key} className="bg-stone-800 rounded-lg p-2">
                <p className="text-stone-500 text-xs mb-1">{abbr}</p>
                <p className="font-bold text-white text-lg leading-none">{character.abilities[key] ?? 10}</p>
                <p className="text-stone-400 text-xs mt-1">{sign(character.modifiers[key])}</p>
              </div>
            ))}
          </div>
          {/* Saving throws */}
          <div className="mt-3 pt-3 border-t border-stone-800">
            <p className="text-stone-600 text-xs mb-1.5">Jets de sauvegarde</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {ABILITY_LABELS.map(([key, abbr]) => {
                const st = character.saving_throws[key]
                return (
                  <div key={key} className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${st?.proficient ? 'bg-amber-400' : 'bg-stone-700'}`} />
                    <span className="text-stone-400 text-xs">{abbr}</span>
                    <span className={`text-xs font-semibold ml-auto ${st?.proficient ? 'text-white' : 'text-stone-400'}`}>
                      {sign(st?.modifier ?? 0)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </Section>

        {/* Skills */}
        {proficientSkills.length > 0 && (
          <Section title="Compétences maîtrisées">
            <div className="grid grid-cols-2 gap-1">
              {proficientSkills.map(([key, v]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${v.expert ? 'bg-amber-400' : 'bg-stone-400'}`} />
                  <span className="text-stone-300 text-xs truncate">{SKILL_LABELS[key] ?? key}</span>
                  <span className="text-white text-xs font-semibold ml-auto">{sign(v.modifier)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Attack macros */}
        {character.attack_macros.length > 0 && (
          <Section title="Attaques">
            <div className="space-y-2">
              {character.attack_macros.map((macro, i) => (
                <div key={i} className="flex items-center gap-3 bg-stone-800 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{macro.name}</p>
                    {macro.range && <p className="text-stone-500 text-xs">{macro.range}</p>}
                    {macro.notes && <p className="text-stone-500 text-xs italic">{macro.notes}</p>}
                  </div>
                  <div className="flex gap-3 text-xs shrink-0">
                    {macro.attack_bonus != null && (
                      <span className="text-rose-300">
                        Att. {sign(macro.attack_bonus)}
                      </span>
                    )}
                    <span className="text-orange-300">{macro.damage_dice}</span>
                    {macro.damage_type && <span className="text-stone-500">{macro.damage_type}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Spell slots */}
        {slots.length > 0 && (
          <Section title="Magie">
            <div className="flex items-center gap-3 mb-3 text-xs text-stone-400">
              {character.spellcasting.ability && (
                <>
                  <span>Caractéristique : <span className="text-white font-semibold">{character.spellcasting.ability.toUpperCase()}</span></span>
                  <span>DD <span className="text-white font-semibold">{character.spellcasting.save_dc}</span></span>
                  <span>Att. <span className="text-white font-semibold">{sign(character.spellcasting.attack_bonus)}</span></span>
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
                        <span
                          key={i}
                          className={`w-4 h-4 rounded-full border-2 ${
                            i < available ? 'bg-violet-500 border-violet-400' : 'bg-transparent border-stone-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-stone-500 text-xs">{available}/{slot.max}</span>
                  </div>
                )
              })}
            </div>

            {/* Spells list */}
            {Object.keys(spellsByLevel).length > 0 && (
              <div className="space-y-3 border-t border-stone-800 pt-3">
                {Object.entries(spellsByLevel)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([lvl, spells]) => (
                    <div key={lvl}>
                      <p className="text-stone-500 text-xs font-semibold mb-1.5">{SPELL_LEVEL_LABELS[Number(lvl)] ?? `Niv. ${lvl}`}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {spells.map((spell, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border text-xs ${
                              spell.prepared
                                ? 'bg-violet-900/40 border-violet-700/50 text-violet-200'
                                : 'bg-stone-800 border-stone-700 text-stone-500'
                            }`}
                          >
                            {spell.concentration && <span className="text-violet-400">◈</span>}
                            <span className="font-medium">{spell.name}</span>
                            {spell.damage_dice && <span className="text-indigo-300">{spell.damage_dice}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
          </Section>
        )}

        {/* Resources */}
        {character.resources.length > 0 && (
          <Section title="Ressources de classe">
            <div className="space-y-2">
              {character.resources.map((r, i) => {
                const pct = r.max > 0 ? (r.current / r.max) * 100 : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-stone-300 text-sm">{r.name}</span>
                      <span className="text-stone-400 text-xs font-mono">{r.current}/{r.max}</span>
                    </div>
                    <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Inventory (equipped) */}
        {equippedItems.length > 0 && (
          <Section title="Équipement">
            <div className="space-y-1">
              {equippedItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-500 text-xs shrink-0">●</span>
                  <span className="text-stone-200 flex-1 truncate">{item.name}</span>
                  {item.quantity > 1 && <span className="text-stone-500 text-xs shrink-0">×{item.quantity}</span>}
                  {item.magical && <span className="text-violet-400 text-xs shrink-0">✦</span>}
                </div>
              ))}
            </div>
            {character.inventory.items.filter(i => !i.equipped).length > 0 && (
              <details className="mt-3">
                <summary className="text-stone-600 text-xs cursor-pointer hover:text-stone-400 transition-colors">
                  + {character.inventory.items.filter(i => !i.equipped).length} objets non équipés
                </summary>
                <div className="mt-2 space-y-1">
                  {character.inventory.items.filter(i => !i.equipped).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-stone-700 text-xs shrink-0">○</span>
                      <span className="text-stone-400 flex-1 truncate">{item.name}</span>
                      {item.quantity > 1 && <span className="text-stone-600 text-xs shrink-0">×{item.quantity}</span>}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Section>
        )}

        {/* Currency */}
        {hasCurrency && (
          <Section title="Monnaie">
            <div className="flex flex-wrap gap-3">
              {([['pp', 'Platine'], ['po', 'Or'], ['pe', 'Électrum'], ['pa', 'Argent'], ['pc', 'Cuivre']] as const).map(([key, label]) => {
                const val = currency[key]
                if (!val) return null
                return (
                  <div key={key} className="text-center">
                    <p className="text-stone-500 text-xs">{label}</p>
                    <p className="text-white font-bold">{val}</p>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Personality */}
        {(character.personality_traits || character.ideals || character.bonds || character.flaws) && (
          <Section title="Personnalité">
            <div className="space-y-3">
              {[
                ['Traits', character.personality_traits],
                ['Idéaux', character.ideals],
                ['Liens', character.bonds],
                ['Défauts', character.flaws],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-stone-500 text-xs mb-1">{label as string}</p>
                  <p className="text-stone-300 text-sm leading-relaxed">{value as string}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Languages + tools */}
        {(character.languages.length > 0 || character.tool_proficiencies.length > 0) && (
          <Section title="Langues & outils">
            {character.languages.length > 0 && (
              <p className="text-stone-300 text-sm mb-2">
                <span className="text-stone-500 text-xs">Langues : </span>
                {character.languages.join(', ')}
              </p>
            )}
            {character.tool_proficiencies.length > 0 && (
              <p className="text-stone-300 text-sm">
                <span className="text-stone-500 text-xs">Maîtrises d'outils : </span>
                {character.tool_proficiencies.join(', ')}
              </p>
            )}
          </Section>
        )}

        {/* Features */}
        {character.features.length > 0 && (
          <Section title="Traits & capacités">
            <div className="space-y-3">
              {character.features.map((f, i) => (
                <div key={i}>
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <p className="text-stone-200 text-sm font-medium">{f.name}</p>
                    {f.source && <p className="text-stone-600 text-xs">{f.source}</p>}
                  </div>
                  {f.description && <p className="text-stone-400 text-xs leading-relaxed">{f.description}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Notes */}
        {character.notes && (
          <Section title="Notes">
            <MarkdownText className="text-stone-300">{character.notes}</MarkdownText>
          </Section>
        )}

        <p className="text-center text-stone-700 text-xs pb-4">
          Fiche partagée via Taverne · lecture seule
        </p>
      </main>
    </div>
  )
}
