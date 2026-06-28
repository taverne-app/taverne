import { apiFetch, ApiError } from './client'

export type CombatantFaction = 'ennemi' | 'allié' | 'neutre'

export interface Combatant {
  id: number
  campaign_id: number
  name: string
  faction: CombatantFaction
  max_hp: number
  current_hp: number
  armor_class: number | null
  initiative_roll: number | null
  conditions: string[]
  condition_durations: Record<string, number>
  created_at: string
  updated_at: string
}

export async function listCombatants(campaignId: number): Promise<Combatant[]> {
  const res = await apiFetch(`/campaigns/${campaignId}/combatants`)
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function createCombatant(
  campaignId: number,
  data: { name: string; faction?: CombatantFaction; max_hp: number; armor_class?: number | null; initiative_roll?: number | null },
): Promise<Combatant> {
  const res = await apiFetch(`/campaigns/${campaignId}/combatants`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateCombatantHp(
  campaignId: number,
  combatantId: number,
  amount: number,
  type: 'damage' | 'heal',
): Promise<Combatant> {
  const res = await apiFetch(`/campaigns/${campaignId}/combatants/${combatantId}/hp`, {
    method: 'PATCH',
    body: JSON.stringify({ amount, type }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateCombatantInitiative(
  campaignId: number,
  combatantId: number,
  initiative_roll: number | null,
): Promise<Combatant> {
  const res = await apiFetch(`/campaigns/${campaignId}/combatants/${combatantId}/initiative`, {
    method: 'PATCH',
    body: JSON.stringify({ initiative_roll }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateCombatantConditions(
  campaignId: number,
  combatantId: number,
  conditions: string[],
  condition_durations?: Record<string, number>,
): Promise<Combatant> {
  const res = await apiFetch(`/campaigns/${campaignId}/combatants/${combatantId}/conditions`, {
    method: 'PATCH',
    body: JSON.stringify({ conditions, condition_durations }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateCombatantFaction(
  campaignId: number,
  combatantId: number,
  faction: CombatantFaction,
): Promise<Combatant> {
  const res = await apiFetch(`/campaigns/${campaignId}/combatants/${combatantId}/faction`, {
    method: 'PATCH',
    body: JSON.stringify({ faction }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateCombatantName(
  campaignId: number,
  combatantId: number,
  name: string,
): Promise<Combatant> {
  const res = await apiFetch(`/campaigns/${campaignId}/combatants/${combatantId}/name`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function deleteCombatant(campaignId: number, combatantId: number): Promise<void> {
  const res = await apiFetch(`/campaigns/${campaignId}/combatants/${combatantId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new ApiError(res.status, await res.json())
}
