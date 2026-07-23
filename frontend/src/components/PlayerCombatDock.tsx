import { useEffect, useState } from 'react'
import type { Character } from '../api/characters'
import { getSharedCharacter } from '../api/characters'
import { updateSharedCharacterHp, rollSharedDice, rollSharedInitiative, castSharedSpell } from '../api/share'
import { usePlayerCharacter } from '../lib/playerIdentity'
import { parseDamageDice } from '../lib/dice'
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
 * En revanche « seulement à son tour » est une contrainte d'INTERFACE, pas une garantie.
 * Le tour actif est bien persisté sur la campagne (c'est ce qui permet à cette page de
 * savoir où on en est en arrivant), mais AUCUNE route ne le vérifie à l'écriture : un
 * joueur décidé peut agir hors tour. C'est un garde-fou contre l'étourderie, pas contre
 * la triche — ne jamais présenter ce grisage comme une sécurité.
 */

/*
 * POSITIONNEMENT — ce composant ne s'ancre PAS lui-même : la page l'empile sous le ruban
 * d'initiative dans une seule barre `fixed`. Lui redonner un `fixed bottom-0` le ferait
 * passer sous le ruban, qui en a déjà un.
 *
 * RECONNAISSANCE DU JOUEUR — on ne lui demande rien : `lib/playerIdentity` répond, à
 * partir des fiches déjà ouvertes sur cet appareil. Le carnet de notes s'en sert aussi ;
 * cette question n'a qu'une seule implémentation, et elle n'est pas ici.
 */

interface Props {
  campaignToken: string
  /** Rafraîchi en direct par la page : sert à savoir si c'est le tour du joueur. */
  activeId: number | null
  activeKind: string | null
  /** Le personnage a bougé (PV) : la page redessine son ruban sans attendre l'écho. */
  onCharacterChange?: (character: Character) => void
}

export function PlayerCombatDock({ campaignToken, activeId, activeKind, onCharacterChange }: Props) {
  const { token: charToken, candidates: mine, pick, unpick } = usePlayerCharacter(campaignToken)
  const [character, setCharacter] = useState<Character | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [hpInput, setHpInput] = useState('')
  const [lastRoll, setLastRoll] = useState<string | null>(null)

  const myTurn = !!character && activeKind === 'character' && activeId === character.id

  /**
   * « Tour inconnu » n'est pas « ce n'est pas votre tour ». Tant que le MJ n'a pas
   * changé de tour une première fois, rien ne dit où on en est — griser alors bloquait
   * le joueur sans raison, et c'est le bug qui rendait ses dés inertes. Dans le doute
   * on laisse agir : ce grisage est un garde-fou contre l'étourderie, jamais une
   * sécurité (le serveur, lui, n'arbitre pas le tour).
   */
  const turnKnown = activeKind !== null
  const blocked = turnKnown && !myTurn

  useEffect(() => {
    if (!charToken) { setCharacter(null); return }
    let cancelled = false
    getSharedCharacter(charToken)
      .then(c => {
        if (cancelled) return
        // Le registre local peut être périmé (fiche retirée de la campagne depuis).
        // On revérifie sur la réponse du serveur : une fiche étrangère au combat en
        // cours ne doit pas ouvrir de dock ici.
        if (c.campaign_share_token !== campaignToken) {
          setError('Cette fiche n’appartient plus à cette campagne.')
          setCharacter(null)
          return
        }
        setError(null)
        setCharacter(c)
      })
      .catch(() => {
        if (cancelled) return
        setError('Fiche introuvable ou lien révoqué.')
        setCharacter(null)
      })
    return () => { cancelled = true }
  }, [charToken, campaignToken])

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

  /**
   * Le joueur lance SON initiative depuis la vue Combat : c'est ce qui l'inscrit dans
   * l'ordre. Le MJ ne lance plus l'initiative des joueurs — « Lancer le combat » ne fait
   * qu'ouvrir l'accès, à chacun de tirer la sienne ici. Le serveur tire (pas de triche).
   */
  async function rollInitiative() {
    if (!charToken) return
    setBusy(true)
    setError(null)
    try {
      const updated = await rollSharedInitiative(charToken)
      setCharacter(updated)
      onCharacterChange?.(updated)
      setLastRoll(`Initiative → ${updated.combat.initiative_roll}`)
    } catch {
      setError('Initiative non enregistrée.')
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

  async function cast(spell: { name: string; level: number }) {
    if (!charToken) return
    setBusy(true)
    setError(null)
    try {
      const updated = await castSharedSpell(charToken, spell)
      setCharacter(updated)
      onCharacterChange?.(updated)
      setLastRoll(spell.level > 0
        ? `${spell.name} lancé (emplacement niv.${spell.level} dépensé)`
        : `${spell.name} lancé`)
    } catch (e) {
      // « Plus d'emplacement disponible » vient du serveur : le dire tel quel.
      setError(e instanceof Error ? e.message : 'Sort non lancé.')
    } finally {
      setBusy(false)
    }
  }

  /** Emplacements restants pour un niveau — null pour un tour de magie (illimité). */
  function slotsLeft(level: number): number | null {
    if (level === 0) return null
    const slot = (character?.spellcasting.slots as Record<string, { max: number; used: number }> | undefined)?.[String(level)]
    if (!slot) return 0
    return Math.max(0, slot.max - (slot.used ?? 0))
  }

  if (!character) {
    return (
      <div className="border-t border-stone-800/80 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2 flex-wrap">
          {mine.length === 0 ? (
            // Seul cul-de-sac possible : aucune fiche de cette campagne n'a jamais été
            // ouverte ici. On ne peut pas deviner le personnage — on dit quoi faire.
            <p className="text-stone-500 text-sm">
              Ouvrez une fois le lien de votre fiche de personnage, celui que votre MJ vous a
              donné : cet appareil s’en souviendra et vous pourrez agir depuis cette page.
            </p>
          ) : mine.length > 1 && !charToken ? (
            <>
              <span className="text-stone-400 text-sm shrink-0">Vous jouez :</span>
              {mine.map(s => (
                <button
                  key={s.token}
                  onClick={() => pick(s.token)}
                  className="bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-amber-600/50 text-stone-200 text-sm rounded-lg px-3 py-1.5 transition-colors"
                >{s.name}</button>
              ))}
            </>
          ) : (
            <p className="text-stone-600 text-sm">Chargement de votre fiche…</p>
          )}
          {error && <p className="text-red-400 text-xs basis-full">⚠ {error}</p>}
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
    <div className={`border-t transition-colors ${myTurn ? 'border-amber-500/60 bg-amber-500/[0.04]' : 'border-stone-800/80'}`}>
      <div className="max-w-3xl mx-auto px-4 py-2.5 space-y-2">
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          <div className="min-w-0 leading-tight">
            <p className="text-white font-semibold truncate">
              {character.name}
              {myTurn && <span className="text-amber-400 text-xs font-normal ml-2">— à vous de jouer</span>}
              {blocked && <span className="text-stone-600 text-xs font-normal ml-2">— ce n’est pas votre tour</span>}
              {!turnKnown && <span className="text-stone-600 text-xs font-normal ml-2">— tour non commencé</span>}
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

          {/* Jet d'initiative : l'action qui inscrit le joueur dans l'ordre du combat.
              Tant qu'il n'a pas tiré, le bouton pulse pour l'appeler à le faire ; ensuite
              il montre le résultat et permet de relancer. */}
          {character.combat.initiative_roll == null ? (
            <button onClick={rollInitiative} disabled={busy} className="text-xs font-semibold bg-amber-600/25 border border-amber-600/50 text-amber-300 rounded px-2.5 py-1 hover:bg-amber-600/40 disabled:opacity-40 transition-colors animate-pulse">⚅ Lancer mon initiative</button>
          ) : (
            <button onClick={rollInitiative} disabled={busy} title="Relancer mon initiative" className="text-xs bg-stone-800 border border-stone-700 text-stone-300 rounded px-2 py-1 hover:text-white disabled:opacity-40 transition-colors">⚅ Init. <span className="text-amber-300 font-bold">{character.combat.initiative_roll}</span></button>
          )}

          {/* Rien à changer quand une seule fiche de la campagne est connue ici : le
              dock la reprendrait aussitôt. Le bouton n'apparaît que s'il y a un choix. */}
          {mine.length > 1 && (
            <button onClick={unpick} title="Ce n’est pas mon personnage" className="ml-auto text-stone-600 hover:text-stone-400 text-xs transition-colors">Changer</button>
          )}
        </div>

        {lastRoll && <p className="text-amber-300 text-sm font-semibold">{lastRoll}</p>}
        {error && <p className="text-red-400 text-xs">⚠ {error}</p>}

        {/* Attaques et sorts : grisés hors tour. Garde-fou d'interface uniquement. */}
        <div className={`flex items-center gap-1 flex-wrap ${blocked ? 'opacity-40 pointer-events-none' : ''}`}>
          {character.attack_macros.map((macro, i) => {
            const dmg = parseDamageDice(macro.damage_dice)
            return (
              <span key={`m${i}`} className="inline-flex items-center gap-0.5">
                <button onClick={() => roll(`${macro.name} — attaque`, 20, macro.attack_bonus ?? 0)} disabled={busy} className="text-xs bg-rose-900/50 border border-rose-700/40 text-rose-300 rounded-l px-1.5 py-0.5 hover:bg-rose-800/60 disabled:opacity-50 transition-colors">{macro.name}</button>
                {dmg ? (
                  <button
                    onClick={() => roll(`${macro.name} — dégâts`, dmg.sides, dmg.modifier, dmg.count)}
                    disabled={busy}
                    title={`Lancer les dégâts (${macro.damage_dice})`}
                    className="text-xs bg-orange-900/40 border border-orange-700/30 text-orange-300/80 rounded-r px-1.5 py-0.5 hover:bg-orange-800/70 hover:text-orange-200 disabled:opacity-50 transition-colors"
                  >{macro.damage_dice}</button>
                ) : (
                  <span title="Dés non reconnus — à lancer à la main" className="text-xs bg-orange-900/40 border border-orange-700/30 text-orange-300/80 rounded-r px-1.5 py-0.5">{macro.damage_dice}</span>
                )}
              </span>
            )
          })}
          {castable.map((spell, i) => {
            const dice = spell.level === 0 ? scaleCantripDamage(spell.damage_dice ?? '', character.level) : (spell.damage_dice ?? '')
            const dmg = parseDamageDice(dice)
            const left = slotsLeft(spell.level)
            return (
              <span key={`s${i}`} className="inline-flex items-center gap-0.5">
                {/* LANCER est l'action principale, pas le jet d'attaque : la plupart des
                    sorts n'ont ni attaque ni dégâts (Armure de mage, Bouclier…) et leur
                    seul geste est de dépenser l'emplacement et de le dire à la table. */}
                <button
                  onClick={() => cast({ name: spell.name, level: spell.level })}
                  disabled={busy || left === 0}
                  title={left === 0
                    ? `Plus d’emplacement de niveau ${spell.level}`
                    : left === null
                      ? 'Lancer ce tour de magie (à volonté)'
                      : `Lancer — ${left} emplacement${left > 1 ? 's' : ''} de niveau ${spell.level} restant${left > 1 ? 's' : ''}`}
                  className="text-xs bg-violet-900/50 border border-violet-700/40 text-violet-300 rounded-l px-1.5 py-0.5 hover:bg-violet-800/60 disabled:opacity-40 transition-colors"
                >✦ {spell.name}{left !== null && <span className="text-violet-400/70 ml-1">{left}</span>}</button>
                {/* Le jet d'attaque n'existe que pour les sorts d'attaque, et exige la
                    caractéristique d'incantation. Les dégâts, eux, n'en ont pas besoin. */}
                {dmg && sc.ability && (
                  <button
                    onClick={() => roll(`${spell.name} — attaque`, 20, sc.attack_bonus)}
                    disabled={busy}
                    title={`Jet d’attaque : 1d20+${sc.attack_bonus} · DD ${sc.save_dc}`}
                    className="text-xs bg-violet-900/30 border border-violet-700/30 text-violet-300/80 px-1.5 py-0.5 hover:bg-violet-800/50 disabled:opacity-50 transition-colors"
                  >att</button>
                )}
                {dmg ? (
                  <button
                    onClick={() => roll(`${spell.name} — dégâts`, dmg.sides, dmg.modifier, dmg.count)}
                    disabled={busy}
                    title={`Lancer les dégâts (${dice})`}
                    className="text-xs bg-indigo-900/40 border border-indigo-700/30 text-indigo-300/80 rounded-r px-1.5 py-0.5 hover:bg-indigo-800/70 hover:text-indigo-200 disabled:opacity-50 transition-colors"
                  >{dice}</button>
                ) : dice ? (
                  // Des dés écrits mais illisibles : on les montre sans bouton plutôt
                  // que de proposer un clic qui ne ferait rien.
                  <span title="Dés non reconnus — à lancer à la main" className="text-xs bg-indigo-900/40 border border-indigo-700/30 text-indigo-300/80 rounded-r px-1.5 py-0.5">{dice}</span>
                ) : null}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
