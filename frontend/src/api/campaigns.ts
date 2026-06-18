import { apiFetch, ApiError } from './client'
import type { Character } from './characters'
import type { Combatant } from './combatants'
import type { CampaignSession } from './sessions'

export type { CampaignSession }

export interface Campaign {
  id: number
  name: string
  description: string | null
  share_token: string | null
  characters: Character[]
  combatants?: Combatant[]
  sessions?: CampaignSession[]
  created_at: string
  updated_at: string
}

export async function listCampaigns(): Promise<Campaign[]> {
  const res = await apiFetch('/campaigns')
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function createCampaign(name: string, description?: string): Promise<Campaign> {
  const res = await apiFetch('/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function getCampaign(id: number): Promise<Campaign> {
  const res = await apiFetch(`/campaigns/${id}`)
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateCampaign(id: number, data: { name?: string; description?: string }): Promise<Campaign> {
  const res = await apiFetch(`/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function deleteCampaign(id: number): Promise<void> {
  const res = await apiFetch(`/campaigns/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new ApiError(res.status, await res.json())
}

export async function addCharacterToCampaign(campaignId: number, characterId: number): Promise<Campaign> {
  const res = await apiFetch(`/campaigns/${campaignId}/characters`, {
    method: 'POST',
    body: JSON.stringify({ character_id: characterId }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function removeCharacterFromCampaign(campaignId: number, characterId: number): Promise<Campaign> {
  const res = await apiFetch(`/campaigns/${campaignId}/characters/${characterId}`, { method: 'DELETE' })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}
