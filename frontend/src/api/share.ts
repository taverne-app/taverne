import { apiFetch, ApiError } from './client'
import type { Campaign } from './campaigns'

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
