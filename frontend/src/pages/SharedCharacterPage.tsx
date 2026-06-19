import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedCharacter, type Character, type AbilityName } from '../api/characters'

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

function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
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
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
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
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Abilities */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
          <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">Caractéristiques</h2>
          <div className="grid grid-cols-6 gap-2 text-center">
            {ABILITY_LABELS.map(([key, abbr]) => (
              <div key={key} className="bg-stone-800 rounded-lg p-2">
                <p className="text-stone-500 text-xs mb-1">{abbr}</p>
                <p className="font-bold text-white text-lg leading-none">{character.abilities[key] ?? 10}</p>
                <p className="text-stone-400 text-xs mt-1">{sign(character.modifiers[key])}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Spell slots */}
        {slots.length > 0 && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">Emplacements de sort</h2>
              <span className="text-stone-500 text-xs">
                {character.spellcasting.ability?.toUpperCase()} · DD {character.spellcasting.save_dc} · Att. {sign(character.spellcasting.attack_bonus)}
              </span>
            </div>
            <div className="space-y-2">
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
          </div>
        )}

        {/* Resources */}
        {character.resources.length > 0 && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-3">Ressources de classe</h2>
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
          </div>
        )}

        {/* Notes */}
        {character.notes && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
            <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest mb-2">Notes</h2>
            <p className="text-stone-300 text-sm leading-relaxed whitespace-pre-line">{character.notes}</p>
          </div>
        )}

        <p className="text-center text-stone-700 text-xs pb-4">
          Fiche partagée via Taverne · lecture seule
        </p>
      </main>
    </div>
  )
}
