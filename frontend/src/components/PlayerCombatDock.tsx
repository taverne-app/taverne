import { useEffect, useState } from 'react'
import type { Character } from '../api/characters'
import { getSharedCharacter } from '../api/characters'
import { updateSharedCharacterHp, rollSharedDice } from '../api/share'
import { scaleCantripDamage } from '../data/spells'

/**
 * Dock d'action du joueur, en bas de la vue Combat partagée.
 *
 * MODÈLE DE CONFIANCE — à lire avant d'y ajouter quoi que ce soit :
 *
 * Le lien de campagne est le MÊME pour toute la table : le serveur ne peut pas savoir
 * qui regarde. L'identité vient donc du jeton du PERSONNAGE (`/share/character/{token}`),
 * que le MJ ne remet qu'à son joueur. Posséder ce lien EST la permission d'agir sur ce
 * personnage, et c'est le serveur qui le vérifie : les deux écritures d'ici passent par
 * des routes scopées au jeton, jamais par l'API du MJ.
 *
 * En revanche « seulement à son tour » est une contrainte d'INTERFACE, pas une garantie :
 * le tour actif n'est que diffusé, jamais persisté, donc le serveur ne peut pas le
 * vérifier. Un joueur décidé pourrait agir hors tour. C'est un garde-fou contre
 * l'étourderie, pas contre la triche — ne jamais présenter ce grisage comme une sécurité.
 */

/** Où l'on retient le personnage réclamé. Par campagne : on peut suivre deux tables. */
const claimKey = (campaignToken: string) => `taverne:combat-perso:${campaignToken}`

interface Props {
  campaignToken: string
  /** Rafraîchi en direct par la page : sert à savoir si c'est le tour du joueur. */
  activeId: number | null
  activeKind: string | null
  /** Le personnage a bougé (PV) : la page redessine son ruban sans attendre l'écho. */
  onCharacterChange?: (character: Character) => void
}

export function PlayerCombatDock({ campaignToken, activeId, activeKind, onCharacterChange }: Props) {
  const [charToken, setCharToken] = useState<string | null>(() => localStorage.getItem(claimKey(campaignToken)))
  const [character, setCharacter] = useState<Character | null>(null)
  const [linkDraft, setLinkDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [hpInput, setHpInput] = useState('')
  const [lastRoll, setLastRoll] = useState<string | null>(null)

  const myTurn = !!character && activeKind === 'character' && activeId === character.id

  useEffect(() => {
    if (!charToken) { setCharacter(null); return }
    getSharedCharacter(charToken)
      .then(c => {
        // Un lien d'une AUTRE campagne ne doit pas ouvrir un dock ici : ce serait
        // afficher une fiche étrangère au combat en cours.
        if (c.campaign_share_token !== campaignToken) {
          setError('Ce personnage appartient à une autre campagne.')
          localStorage.removeItem(claimKey(campaignToken))
          setCharToken(null)
          return
        }
        setCharacter(c)
      })
      .catch(() => {
        setError('Lien de personnage invalide ou révoqué.')
        localStorage.removeItem(claimKey(campaignToken))
        setCharToken(null)
      })
  }, [charToken, campaignToken])

  function claim() {
    // On accepte le lien complet autant que le jeton nu : le joueur colle ce qu'il a.
    const raw = linkDraft.trim()
    const token = raw.match(/share\/character\/([^/?#]+)/)?.[1] ?? raw
    if (!token) return
    setError(null)
    localStorage.setItem(claimKey(campaignToken), token)
    setCharToken(token)
    setLinkDraft('')
  }

  function forget() {
    localStorage.removeItem(claimKey(campaignToken))
    setCharToken(null)
    setCharacter(null)
    setError(null)
  }

  async function applyHp(type: 'damage' | 'heal') {
    const amount = parseInt(hpInput, 10)
    if (!charToken || !Number.isFinite(amount) || amount < 1) return
    setBusy(true)
    try {
      const updated = await updateSharedCharacterHp(charToken, amount, type)
      setCharacter(updated)
      onCharacterChange?.(updated)
      setHpInput('')
    } catch {
      setError('PV non enregistrés.')
    } finally {
      setBusy(false)
    }
  }

  async function roll(label: string, sides: number, modifier = 0, count = 1) {
    if (!charToken) return
    setBusy(true)
    try {
      const r = await rollSharedDice(charToken, { label, sides, modifier, count })
      setLastRoll(`${label} → ${r.total}`)
    } catch {
      setError('Jet non enregistré.')
    } finally {
      setBusy(false)
    }
  }

  if (!charToken || !character) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-700/60 bg-stone-900/95 backdrop-blur px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2 flex-wrap">
          <span className="text-stone-400 text-sm shrink-0">Votre personnage :</span>
          <input
            type="text"
            value={linkDraft}
            onChange={e => setLinkDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') claim() }}
            placeholder="Collez le lien de votre fiche…"
            className="flex-1 min-w-[200px] bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-200 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button onClick={claim} className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg px-3 py-2 transition-colors">Lier</button>
          {error && <p className="text-red-400 text-xs basis-full">⚠ {error}</p>}
          <p className="text-stone-600 text-xs basis-full">
            C’est le lien que votre MJ vous a donné pour votre feuille de personnage. Il reste sur cet appareil.
          </p>
        </div>
      </div>
    )
  }

  const hp = character.combat.current_hp
  const maxHp = character.combat.max_hp
  const dying = hp <= 0
  const sc = character.spellcasting
  const castable = sc.spells.filter(s => s.prepared || s.level === 0)

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-30 border-t bg-stone-900/95 backdrop-blur transition-colors ${myTurn ? 'border-amber-500/60 shadow-[0_-8px_24px_rgba(180,120,20,0.25)]' : 'border-stone-700/60'}`}>
      <div className="max-w-3xl mx-auto px-4 py-2.5 space-y-2">
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          <div className="min-w-0 leading-tight">
            <p className="text-white font-semibold truncate">
              {character.name}
              {myTurn
                ? <span className="text-amber-400 text-xs font-normal ml-2">— à vous de jouer</span>
                : <span className="text-stone-600 text-xs font-normal ml-2">— ce n’est pas votre tour</span>}
            </p>
            <p className="text-stone-500 text-xs truncate">{character.race} · {character.character_class} Niv.{character.level}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold ${dying ? 'text-red-400' : 'text-white'}`}>{hp}</span>
            <span className="text-stone-500 text-xs">
              /{maxHp}
              {character.combat.temporary_hp > 0 && <span className="text-sky-400 font-semibold"> +{character.combat.temporary_hp}</span>}
            </span>
            {/* Les PV ne sont PAS bornés au tour : on encaisse des dégâts quand on n'est
                pas de tour (attaque d'opportunité, zone, chute), et se soigner reste au
                joueur. Seules les actions offensives suivent le tour. */}
            <input
              type="number" min={1} value={hpInput} disabled={busy}
              onChange={e => setHpInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyHp('damage') }}
              placeholder="PV"
              className="w-14 bg-stone-800 border border-stone-700 rounded px-1 py-1 text-white text-xs text-center focus:outline-none focus:border-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={() => applyHp('damage')} disabled={busy} className="bg-red-900/60 hover:bg-red-800/80 disabled:opacity-40 border border-red-700/50 text-red-300 text-xs rounded px-2 py-1 transition-colors">Dégâts</button>
            <button onClick={() => applyHp('heal')} disabled={busy} className="bg-emerald-900/60 hover:bg-emerald-800/80 disabled:opacity-40 border border-emerald-700/50 text-emerald-300 text-xs rounded px-2 py-1 transition-colors">Soin</button>
          </div>

          <button onClick={() => roll('Initiative', 20, character.modifiers.dexterity)} disabled={busy} className="text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded px-2 py-1 hover:text-white disabled:opacity-40 transition-colors">⚅ d20</button>

          <button onClick={forget} title="Ce n’est pas mon personnage" className="ml-auto text-stone-600 hover:text-stone-400 text-xs transition-colors">Changer</button>
        </div>

        {lastRoll && <p className="text-amber-300 text-sm font-semibold">{lastRoll}</p>}
        {error && <p className="text-red-400 text-xs">⚠ {error}</p>}

        {/* Attaques et sorts : grisés hors tour. Garde-fou d'interface uniquement. */}
        <div className={`flex items-center gap-1 flex-wrap ${myTurn ? '' : 'opacity-40 pointer-events-none'}`}>
          {character.attack_macros.map((macro, i) => (
            <span key={`m${i}`} className="inline-flex items-center gap-0.5">
              <button onClick={() => roll(`${macro.name} — attaque`, 20, macro.attack_bonus ?? 0)} disabled={busy} className="text-xs bg-rose-900/50 border border-rose-700/40 text-rose-300 rounded-l px-1.5 py-0.5 hover:bg-rose-800/60 transition-colors">{macro.name}</button>
              <span className="text-xs bg-orange-900/40 border border-orange-700/30 text-orange-300/80 rounded-r px-1.5 py-0.5">{macro.damage_dice}</span>
            </span>
          ))}
          {castable.map((spell, i) => {
            const dice = spell.level === 0 ? scaleCantripDamage(spell.damage_dice ?? '', character.level) : (spell.damage_dice ?? '')
            return (
              <span key={`s${i}`} className="inline-flex items-center gap-0.5">
                <button
                  onClick={() => roll(`${spell.name} — attaque`, 20, sc.attack_bonus)}
                  disabled={busy || !sc.ability}
                  title={sc.ability ? `1d20+${sc.attack_bonus} · DD ${sc.save_dc}` : 'Aucune caractéristique d’incantation sur la fiche'}
                  className="text-xs bg-violet-900/50 border border-violet-700/40 text-violet-300 rounded-l px-1.5 py-0.5 hover:bg-violet-800/60 disabled:opacity-50 transition-colors"
                >✦ {spell.name}</button>
                <span className="text-xs bg-indigo-900/40 border border-indigo-700/30 text-indigo-300/80 rounded-r px-1.5 py-0.5">{dice || (spell.level === 0 ? 'TdM' : `N${spell.level}`)}</span>
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
