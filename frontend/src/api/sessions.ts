import { apiFetch, ApiError } from './client'

export interface CampaignSession {
  id: number
  campaign_id: number
  title: string
  session_date: string | null
  notes: string | null
  xp_awarded: number | null
  loot_notes: string | null
  xp_distributed: boolean
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
  data: { title: string; session_date?: string | null; notes?: string | null; xp_awarded?: number | null; loot_notes?: string | null },
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
  data: { title?: string; session_date?: string | null; notes?: string | null; xp_awarded?: number | null; loot_notes?: string | null; xp_distributed?: boolean },
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
