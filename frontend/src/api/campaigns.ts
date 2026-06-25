import { apiFetch, ApiError } from './client'
import type { Character } from './characters'
import type { Combatant } from './combatants'
import type { CampaignSession } from './sessions'

export type { CampaignSession }

export interface SavedEncounter {
  name: string
  entries: { monster_name: string; count: number; cr?: string }[]
}

export interface Npc {
  name: string
  role: string
  status: 'allié' | 'neutre' | 'ennemi' | 'inconnu'
  location?: string
  notes: string
}

export interface SessionPrep {
  title: string
  date: string
  notes: string
  npc_names: string[]
  location_names: string[]
  encounter_names: string[]
}

export interface GameCalendar {
  date: string
  time: 'matin' | 'après-midi' | 'soir' | 'nuit'
  weather: string
  notes: string
}

export interface TreasureItem {
  name: string
  quantity: number
  value: string
  notes: string
}

export interface Location {
  name: string
  type: 'ville' | 'donjon' | 'forêt' | 'taverne' | 'temple' | 'château' | 'autre'
  status: 'inconnu' | 'connu' | 'exploré'
  reputation: 'héros' | 'respecté' | 'neutre' | 'suspect' | 'recherché'
  notes: string
}

export interface Campaign {
  id: number
  name: string
  description: string | null
  dm_notes: string | null
  saved_encounters: SavedEncounter[]
  npcs: Npc[]
  game_calendar: Partial<GameCalendar>
  party_treasury: TreasureItem[]
  locations: Location[]
  session_prep: SessionPrep | null
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

export async function updateCampaign(id: number, data: { name?: string; description?: string; dm_notes?: string | null; saved_encounters?: SavedEncounter[]; npcs?: Npc[]; game_calendar?: Partial<GameCalendar>; party_treasury?: TreasureItem[]; locations?: Location[]; session_prep?: SessionPrep | null }): Promise<Campaign> {
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

export async function broadcastCombatTurn(
  campaignId: number,
  payload: { active_kind: 'character' | 'combatant' | null; active_id: number | null; round: number },
): Promise<void> {
  await apiFetch(`/campaigns/${campaignId}/combat-turn`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
