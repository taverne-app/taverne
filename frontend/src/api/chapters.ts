import { apiFetch, ApiError } from './client'
import type { PrepScene } from './campaigns'

/** Le matériau d'un chapitre : ce que le MJ prépare pour le jouer. */
export interface ChapterPrep {
  scenes: PrepScene[]
  npc_names: string[]
  location_names: string[]
  encounter_names: string[]
}

/**
 * Un chapitre : une section du scénario. Pas de date — il a un rang, que le MJ
 * remanie quand les joueurs prennent un autre chemin. Une fois `done`, il tombe en
 * fin de liste sans perdre sa place face aux autres chapitres terminés.
 */
export interface Chapter {
  id: number
  campaign_id: number
  title: string
  notes: string | null
  xp_awarded: number | null
  loot_notes: string | null
  xp_distributed: boolean
  position: number
  done: boolean
  prep: ChapterPrep | null
  created_at: string
  updated_at: string
}

export async function listChapters(campaignId: number): Promise<Chapter[]> {
  const res = await apiFetch(`/campaigns/${campaignId}/chapters`)
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function createChapter(
  campaignId: number,
  data: { title: string; notes?: string | null; xp_awarded?: number | null; loot_notes?: string | null; done?: boolean; prep?: ChapterPrep | null },
): Promise<Chapter> {
  const res = await apiFetch(`/campaigns/${campaignId}/chapters`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateChapter(
  campaignId: number,
  chapterId: number,
  data: { title?: string; notes?: string | null; xp_awarded?: number | null; loot_notes?: string | null; xp_distributed?: boolean; done?: boolean; prep?: ChapterPrep | null },
): Promise<Chapter> {
  const res = await apiFetch(`/campaigns/${campaignId}/chapters/${chapterId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function deleteChapter(campaignId: number, chapterId: number): Promise<void> {
  const res = await apiFetch(`/campaigns/${campaignId}/chapters/${chapterId}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new ApiError(res.status, await res.json())
}

/**
 * Réordonne les chapitres. Les joueurs partent ailleurs, prennent une quête plus tôt :
 * le MJ remonte ou descend un chapitre sans rien ressaisir.
 */
export async function reorderChapters(campaignId: number, ids: number[]): Promise<Chapter[]> {
  const res = await apiFetch(`/campaigns/${campaignId}/chapters/reorder`, {
    method: 'POST',
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}
