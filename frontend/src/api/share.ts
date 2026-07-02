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
