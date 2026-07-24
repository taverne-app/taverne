import { apiFetch, ApiError } from './client'
import type { Campaign } from './campaigns'
import type { Character, DiceRoll } from './characters'

export async function getSharedCampaign(token: string): Promise<Campaign> {
  const res = await fetch(`/api/share/${token}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Campagne introuvable ou lien révoqué.')
  return (await res.json()).data
}

/** Journal des 10 derniers jets de la campagne (plus récent en tête), côté joueurs. */
export async function getSharedCampaignRolls(token: string): Promise<DiceRoll[]> {
  const res = await fetch(`/api/share/${token}/rolls`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Historique des jets indisponible.')
  return (await res.json()).data
}

export async function generateShareToken(campaignId: number): Promise<Campaign> {
  const res = await apiFetch(`/campaigns/${campaignId}/share`, { method: 'POST' })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function revokeShareToken(campaignId: number): Promise<Campaign> {
  const res = await apiFetch(`/campaigns/${campaignId}/share`, { method: 'DELETE' })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateSharedCharacterHp(
  token: string,
  amount: number,
  type: 'damage' | 'heal',
): Promise<Character> {
  const res = await fetch(`/api/share/character/${token}/hp`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ amount, type }),
  })
  if (!res.ok) throw new Error('Erreur PV')
  return (await res.json()).data
}

/**
 * Une note du carnet d'aventure d'un joueur. Privée : elle ne transite que par les
 * routes ci-dessous, jamais par la fiche partagée ni par la campagne (qui partent,
 * elles, à toute la table). Toute clé ajoutée ici doit l'être aussi dans la
 * validation de ShareController::updateNotes, sinon elle sera effacée à l'écriture.
 */
export interface AdventureNote {
  id: string
  type: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

export async function getSharedCharacterNotes(token: string): Promise<AdventureNote[]> {
  const res = await fetch(`/api/share/character/${token}/notes`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Notes introuvables')
  return (await res.json()).data
}

/** Remplace le carnet en bloc — le serveur ne sait pas fusionner des notes. */
export async function updateSharedCharacterNotes(
  token: string,
  notes: AdventureNote[],
): Promise<AdventureNote[]> {
  const res = await fetch(`/api/share/character/${token}/notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ notes }),
  })
  if (!res.ok) throw new Error('Notes non enregistrées')
  return (await res.json()).data
}

/**
 * Lance un sort : consomme l'emplacement (niveau ≥ 1) et annonce le sort à la table.
 * Beaucoup de sorts n'ont ni attaque ni dégâts — c'est leur seule action possible.
 */
export async function castSharedSpell(
  token: string,
  spell: { name: string; level: number },
): Promise<Character> {
  const res = await fetch(`/api/share/character/${token}/cast`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(spell),
  })
  if (!res.ok) {
    // 422 = plus d'emplacement : le message du serveur est plus utile que « erreur ».
    const message = await res.json().catch(() => null)
    throw new Error(message?.message ?? 'Sort non lancé')
  }
  return (await res.json()).data
}

export async function rollSharedDice(
  token: string,
  params: { sides: number; count?: number; modifier?: number; label?: string; advantage?: boolean; disadvantage?: boolean },
): Promise<DiceRoll> {
  const res = await fetch(`/api/share/character/${token}/roll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Erreur jet de dés')
  return res.json()
}

/**
 * Le joueur lance SON initiative : le serveur tire (1d20 + mod. Dex) et l'inscrit dans
 * l'ordre du combat. Renvoie la fiche à jour pour rafraîchir le ruban sans attendre l'écho.
 */
export async function rollSharedInitiative(token: string): Promise<Character> {
  const res = await fetch(`/api/share/character/${token}/initiative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Initiative non enregistrée')
  return (await res.json()).data
}

// ── Écritures du joueur sur sa propre fiche ──────────────────────────────────
//
// Toutes envoient une INTENTION (« +15 po », « prépare ce sort », « ajoute cet
// objet »), jamais l'état complet du champ : le MJ écrit sur la même fiche, et un
// onglet resté ouvert ne doit pas pouvoir écraser ce qu'il vient de changer.
// Aucune suppression n'est exposée — le lien de partage est une capacité au porteur.

/** Réponse d'erreur du serveur : son message est toujours plus utile que « erreur ». */
async function playerWrite(url: string, method: 'POST' | 'PATCH', body?: unknown, fallback = 'Modification refusée'): Promise<Character> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const message = await res.json().catch(() => null)
    throw new Error(message?.message ?? fallback)
  }
  return (await res.json()).data
}

export type CoinDeltas = Partial<Record<'pc' | 'pa' | 'pe' | 'po' | 'pp', number>>

/** Mouvements de bourse. Négatifs pour une dépense ; le serveur refuse un solde négatif. */
export function updateSharedCurrency(token: string, deltas: CoinDeltas): Promise<Character> {
  return playerWrite(`/api/share/character/${token}/currency`, 'PATCH', { deltas }, 'Bourse non modifiée')
}

export function prepareSharedSpell(token: string, name: string, prepared: boolean): Promise<Character> {
  return playerWrite(`/api/share/character/${token}/spell-prepared`, 'PATCH', { name, prepared }, 'Préparation non enregistrée')
}

export function addSharedSpell(
  token: string,
  spell: { name: string; level: number; damage_dice?: string },
): Promise<Character> {
  return playerWrite(`/api/share/character/${token}/spells`, 'POST', spell, 'Sort non ajouté')
}

export function addSharedInventoryItem(
  token: string,
  item: { name: string; quantity: number; weight?: number; value_gp?: number | null; notes?: string },
): Promise<Character> {
  return playerWrite(`/api/share/character/${token}/inventory`, 'POST', item, 'Objet non ajouté')
}

export function toggleSharedInventoryEquipped(token: string, name: string, equipped: boolean): Promise<Character> {
  return playerWrite(`/api/share/character/${token}/inventory-equipped`, 'PATCH', { name, equipped }, 'Objet non modifié')
}

export function sharedLongRest(token: string): Promise<Character> {
  return playerWrite(`/api/share/character/${token}/rest`, 'POST', undefined, 'Repos non enregistré')
}

/** Le repos court renvoie le détail des dés — la table veut voir ce qui est sorti. */
export async function sharedShortRest(
  token: string,
  diceSpent: number,
): Promise<{ character: Character; rolls: number[]; modifier: number; total_healed: number }> {
  const res = await fetch(`/api/share/character/${token}/short-rest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ dice_spent: diceSpent }),
  })
  if (!res.ok) {
    const message = await res.json().catch(() => null)
    throw new Error(message?.message ?? 'Repos non enregistré')
  }
  return res.json()
}
