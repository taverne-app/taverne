import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getCharacter, type Character, type AbilityName } from '../api/characters'

const ABILITY_LABELS: [AbilityName, string][] = [
  ['strength', 'FOR'], ['dexterity', 'DEX'], ['constitution', 'CON'],
  ['intelligence', 'INT'], ['wisdom', 'SAG'], ['charisma', 'CHA'],
]

const SKILL_LABELS: [string, string, AbilityName][] = [
  ['acrobatics', 'Acrobaties', 'dexterity'],
  ['animal_handling', 'Dressage', 'wisdom'],
  ['arcana', 'Arcanes', 'intelligence'],
  ['athletics', 'Athlétisme', 'strength'],
  ['deception', 'Tromperie', 'charisma'],
  ['history', 'Histoire', 'intelligence'],
  ['insight', 'Perspicacité', 'wisdom'],
  ['intimidation', 'Intimidation', 'charisma'],
  ['investigation', 'Investigation', 'intelligence'],
  ['medicine', 'Médecine', 'wisdom'],
  ['nature', 'Nature', 'intelligence'],
  ['perception', 'Perception', 'wisdom'],
  ['performance', 'Représentation', 'charisma'],
  ['persuasion', 'Persuasion', 'charisma'],
  ['religion', 'Religion', 'intelligence'],
  ['sleight_of_hand', 'Escamotage', 'dexterity'],
  ['stealth', 'Discrétion', 'dexterity'],
  ['survival', 'Survie', 'wisdom'],
]

function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="break-inside-avoid mb-4">
      <div className="border-b-2 border-stone-800 mb-2 pb-0.5">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-600">{title}</span>
      </div>
      {children}
    </div>
  )
}

export function CharacterPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [character, setCharacter] = useState<Character | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    getCharacter(Number(id))
      .then(setCharacter)
      .catch(() => setError(true))
  }, [id])

  useEffect(() => {
    if (character) {
      document.title = `${character.name} — Fiche`
    }
  }, [character])

  if (error) return <div className="p-8 text-red-600">Impossible de charger le personnage.</div>
  if (!character) return <div className="p-8 text-stone-400">Chargement…</div>

  const slots = Object.entries(character.spellcasting.slots)
    .filter(([, s]) => s.max > 0)
    .sort(([a], [b]) => Number(a) - Number(b))

  return (
    <div className="bg-white text-stone-900 min-h-screen p-6 font-sans text-sm">
      {/* Print button — hidden when printing */}
      <div className="print:hidden mb-4 flex gap-3 items-center">
        <button
          onClick={() => window.print()}
          className="bg-stone-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-stone-700 transition-colors"
        >
          ⎙ Imprimer / Enregistrer en PDF
        </button>
        <span className="text-stone-500 text-xs">Ctrl+P ou ⌘P fonctionne aussi</span>
      </div>

      {/* ── Header ── */}
      <div className="border-b-4 border-stone-800 pb-3 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-stone-900">{character.name}</h1>
            <p className="text-stone-500 text-sm mt-0.5">
              {character.race} · {character.character_class}
              {character.subclass ? ` (${character.subclass})` : ''} · Niveau {character.level}
              {character.background ? ` · ${character.background}` : ''}
              {character.alignment ? ` · ${character.alignment}` : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-stone-500 text-xs">XP : {character.experience_points}</p>
            <p className="text-stone-500 text-xs">Maîtrise : {sign(character.proficiency_bonus)}</p>
          </div>
        </div>
      </div>

      {/* ── Combat stats row ── */}
      <div className="grid grid-cols-6 gap-2 mb-4 text-center">
        {[
          ['PV', `${character.combat.current_hp} / ${character.combat.max_hp}`],
          ['CA', String(character.combat.armor_class)],
          ['Vitesse', `${character.combat.speed} m`],
          ['Initiative', sign(character.combat.initiative)],
          ['Perc. pass.', String(character.passive_perception)],
          ['Dés de vie', `${character.combat.hit_dice_remaining}d${character.combat.hit_dice_type}`],
        ].map(([label, value]) => (
          <div key={label} className="border border-stone-300 rounded p-1.5">
            <p className="text-xs text-stone-500 leading-tight">{label}</p>
            <p className="font-bold text-stone-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* ── Column 1 : Abilities + Saves ── */}
        <div>
          <Section title="Caractéristiques">
            <div className="grid grid-cols-3 gap-1">
              {ABILITY_LABELS.map(([key, abbr]) => {
                const score = character.abilities[key] ?? 10
                const mod = character.modifiers[key]
                return (
                  <div key={key} className="border border-stone-300 rounded text-center p-1">
                    <p className="text-xs text-stone-500">{abbr}</p>
                    <p className="font-bold">{score}</p>
                    <p className="text-xs text-stone-600">{sign(mod)}</p>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Jets de sauvegarde">
            <div className="space-y-0.5">
              {ABILITY_LABELS.map(([key, abbr]) => {
                const save = character.saving_throws[key]
                return (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full inline-block ${save.proficient ? 'bg-stone-800' : 'border border-stone-400'}`} />
                      {abbr}
                    </span>
                    <span className="font-mono font-semibold">{sign(save.modifier)}</span>
                  </div>
                )
              })}
            </div>
          </Section>

          {character.languages.length > 0 && (
            <Section title="Langues">
              <p className="text-xs text-stone-600">{character.languages.join(', ')}</p>
            </Section>
          )}
          {character.tool_proficiencies.length > 0 && (
            <Section title="Maîtrises d'outils">
              <p className="text-xs text-stone-600">{character.tool_proficiencies.join(', ')}</p>
            </Section>
          )}
          {(character.damage_modifiers.resistances.length > 0 || character.damage_modifiers.immunities.length > 0) && (
            <Section title="Résistances & Immunités">
              {character.damage_modifiers.resistances.length > 0 && (
                <p className="text-xs"><span className="font-semibold">Rés. :</span> {character.damage_modifiers.resistances.join(', ')}</p>
              )}
              {character.damage_modifiers.immunities.length > 0 && (
                <p className="text-xs"><span className="font-semibold">Imm. :</span> {character.damage_modifiers.immunities.join(', ')}</p>
              )}
            </Section>
          )}
        </div>

        {/* ── Column 2 : Skills ── */}
        <div>
          <Section title="Compétences">
            <div className="space-y-0.5">
              {SKILL_LABELS.map(([key, label, ability]) => {
                const entry = character.skills[key as keyof typeof character.skills]
                if (!entry) return null
                const abbr = ABILITY_LABELS.find(([a]) => a === ability)?.[1] ?? ''
                return (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${entry.proficient ? 'bg-stone-800' : 'border border-stone-400'}`} />
                      <span className="truncate">{label}</span>
                      <span className="text-stone-400">{abbr}</span>
                    </span>
                    <span className="font-mono font-semibold shrink-0 ml-1">{sign(entry.modifier)}</span>
                  </div>
                )
              })}
            </div>
          </Section>
        </div>

        {/* ── Column 3 : Spellcasting + Resources ── */}
        <div>
          {character.spellcasting.ability && (
            <Section title="Incantation">
              <div className="flex gap-3 text-xs mb-2">
                <span><span className="font-semibold">Caract. :</span> {character.spellcasting.ability?.toUpperCase()}</span>
                <span><span className="font-semibold">DD :</span> {character.spellcasting.save_dc}</span>
                <span><span className="font-semibold">Att. :</span> {sign(character.spellcasting.attack_bonus)}</span>
              </div>
              {slots.length > 0 && (
                <div className="space-y-0.5">
                  {slots.map(([lvl, slot]) => (
                    <div key={lvl} className="flex items-center gap-2 text-xs">
                      <span className="w-12 text-stone-500">Niv. {lvl}</span>
                      <div className="flex gap-1">
                        {Array.from({ length: slot.max }, (_, i) => (
                          <span
                            key={i}
                            className={`w-3 h-3 rounded-full border ${i < (slot.max - slot.used) ? 'bg-stone-800 border-stone-800' : 'border-stone-400'}`}
                          />
                        ))}
                      </div>
                      <span className="text-stone-400">{slot.max - slot.used}/{slot.max}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {character.resources.length > 0 && (
            <Section title="Ressources de classe">
              {character.resources.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs mb-0.5">
                  <span>{r.name}</span>
                  <span className="font-mono font-semibold">{r.current}/{r.max}</span>
                </div>
              ))}
            </Section>
          )}

          {character.attack_macros.length > 0 && (
            <Section title="Attaques">
              {character.attack_macros.map((m, i) => (
                <div key={i} className="text-xs mb-1">
                  <span className="font-semibold">{m.name}</span>
                  {m.attack_bonus != null && <span className="text-stone-500 ml-1">Att. {sign(m.attack_bonus)}</span>}
                  <span className="text-stone-500 ml-1">Dég. {m.damage_dice}{m.damage_type ? ` ({m.damage_type})` : ''}</span>
                </div>
              ))}
            </Section>
          )}

          {character.currency && Object.values(character.currency).some(v => v > 0) && (
            <Section title="Monnaie">
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(character.currency).filter(([, v]) => v > 0).map(([k, v]) => (
                  <span key={k}><span className="font-semibold">{v}</span> {k}</span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* ── Features ── */}
      {character.features.length > 0 && (
        <Section title="Traits & capacités">
          <div className="grid grid-cols-2 gap-x-4">
            {character.features.map((f, i) => (
              <div key={i} className="mb-1.5 break-inside-avoid">
                <p className="font-semibold text-xs">{f.name}{f.source ? <span className="text-stone-400 font-normal"> ({f.source})</span> : ''}</p>
                {f.description && <p className="text-xs text-stone-600 leading-snug">{f.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Spells ── */}
      {character.spellcasting.spells.length > 0 && (
        <Section title="Sorts">
          <div className="grid grid-cols-3 gap-x-4">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => {
              const spells = character.spellcasting.spells.filter(s => s.level === lvl)
              if (spells.length === 0) return null
              return (
                <div key={lvl} className="mb-1 break-inside-avoid">
                  <p className="text-xs font-semibold text-stone-500 mb-0.5">{lvl === 0 ? 'Tours de magie' : `Niveau ${lvl}`}</p>
                  {spells.map((s, i) => (
                    <p key={i} className={`text-xs ${s.prepared ? 'text-stone-900' : 'text-stone-400'}`}>
                      {s.concentration ? '◈ ' : ''}{s.name}{s.damage_dice ? ` (${s.damage_dice})` : ''}
                    </p>
                  ))}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ── Inventory ── */}
      {character.inventory.items.length > 0 && (
        <Section title="Équipement & Inventaire">
          <div className="grid grid-cols-3 gap-x-4">
            {character.inventory.items.map((item, i) => (
              <p key={i} className="text-xs">
                {item.equipped ? '⊙ ' : ''}<span className={item.equipped ? 'font-semibold' : ''}>{item.name}</span>
                {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                {item.value ? ` (${item.value})` : ''}
              </p>
            ))}
          </div>
        </Section>
      )}

      {/* ── Personality ── */}
      {(character.personality_traits || character.ideals || character.bonds || character.flaws) && (
        <Section title="Personnalité">
          <div className="grid grid-cols-2 gap-x-4 text-xs">
            {character.personality_traits && <p><span className="font-semibold">Traits :</span> {character.personality_traits}</p>}
            {character.ideals && <p><span className="font-semibold">Idéaux :</span> {character.ideals}</p>}
            {character.bonds && <p><span className="font-semibold">Liens :</span> {character.bonds}</p>}
            {character.flaws && <p><span className="font-semibold">Défauts :</span> {character.flaws}</p>}
          </div>
        </Section>
      )}

      {/* ── Notes ── */}
      {character.notes && (
        <Section title="Notes">
          <p className="text-xs text-stone-700 whitespace-pre-line">{character.notes}</p>
        </Section>
      )}
    </div>
  )
}
