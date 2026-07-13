import { apiFetch, ApiError } from './client'
import type { PrepScene } from './campaigns'

/** Une séance se prépare (« planned »), puis se joue : le journal, ce sont les jouées. */
export type SessionStatus = 'planned' | 'played'

/** Le matériau d'une séance à venir. Les séances jouées n'en ont pas forcément. */
export interface SessionPrepData {
  scenes: PrepScene[]
  npc_names: string[]
  location_names: string[]
  encounter_names: string[]
}

export interface CampaignSession {
  id: number
  campaign_id: number
  title: string
  session_date: string | null
  notes: string | null
  xp_awarded: number | null
  loot_notes: string | null
  xp_distributed: boolean
  /** Rang dans la file des séances à venir. 0 pour les séances jouées. */
  position: number
  status: SessionStatus
  prep: SessionPrepData | null
  created_at: string
  updated_at: string
}

export async function listSessions(campaignId: number): Promise<CampaignSession[]> {
  const res = await apiFetch(`/campaigns/${campaignId}/sessions`)
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function createSession(
  campaignId: number,
  data: { title: string; session_date?: string | null; notes?: string | null; xp_awarded?: number | null; loot_notes?: string | null; status?: SessionStatus; prep?: SessionPrepData | null },
): Promise<CampaignSession> {
  const res = await apiFetch(`/campaigns/${campaignId}/sessions`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateSession(
  campaignId: number,
  sessionId: number,
  data: { title?: string; session_date?: string | null; notes?: string | null; xp_awarded?: number | null; loot_notes?: string | null; xp_distributed?: boolean; status?: SessionStatus; prep?: SessionPrepData | null },
): Promise<CampaignSession> {
  const res = await apiFetch(`/campaigns/${campaignId}/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function deleteSession(campaignId: number, sessionId: number): Promise<void> {
  const res = await apiFetch(`/campaigns/${campaignId}/sessions/${sessionId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new ApiError(res.status, await res.json())
}

/**
 * Réordonne les séances à venir. Les joueurs partent ailleurs, prennent une quête
 * plus tôt : le MJ remonte ou descend une séance sans rien ressaisir.
 */
export async function reorderSessions(campaignId: number, ids: number[]): Promise<CampaignSession[]> {
  const res = await apiFetch(`/campaigns/${campaignId}/sessions/reorder`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}
