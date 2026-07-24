import { apiFetch, ApiError } from './client'

/**
 * Une page du codex de campagne.
 *
 * `parent_id` porte à lui seul l'arborescence : le serveur renvoie les pages à plat,
 * le front remonte l'arbre (cf. buildCodexTree). `visibility` n'est jamais 'mj' dans
 * une réponse joueur — ces pages ne sortent pas du tout côté partagé.
 */
export interface CodexPage {
  id: number
  campaign_id: number
  parent_id: number | null
  title: string
  body: string | null
  visibility: 'mj' | 'table'
  position: number
  last_editor: string | null
  created_at: string
  updated_at: string
}

export interface CodexNode extends CodexPage {
  children: CodexNode[]
}

/**
 * Remonte l'arbre depuis la liste plate. Une page dont le parent manque (le MJ l'a
 * rendue secrète, ou supprimée) est rattachée à la racine plutôt que perdue : mieux
 * vaut une page mal rangée qu'une page devenue invisible.
 */
export function buildCodexTree(pages: CodexPage[]): CodexNode[] {
  const byId = new Map<number, CodexNode>()
  pages.forEach(p => byId.set(p.id, { ...p, children: [] }))

  const roots: CodexNode[] = []
  byId.forEach(node => {
    const parent = node.parent_id != null ? byId.get(node.parent_id) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  })

  const sort = (nodes: CodexNode[]) => {
    nodes.sort((a, b) => a.position - b.position || a.id - b.id)
    nodes.forEach(n => sort(n.children))
  }
  sort(roots)

  return roots
}

// ---------------------------------------------------------------- côté MJ

export async function getCodexPages(campaignId: number): Promise<CodexPage[]> {
  const res = await apiFetch(`/campaigns/${campaignId}/codex-pages`)
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function createCodexPage(
  campaignId: number,
  page: { title: string; body?: string | null; parent_id?: number | null; visibility?: 'mj' | 'table' },
): Promise<CodexPage> {
  const res = await apiFetch(`/campaigns/${campaignId}/codex-pages`, {
    method: 'POST',
    body: JSON.stringify(page),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateCodexPage(
  campaignId: number,
  pageId: number,
  patch: { title?: string; body?: string | null; parent_id?: number | null; visibility?: 'mj' | 'table' },
): Promise<CodexPage> {
  const res = await apiFetch(`/campaigns/${campaignId}/codex-pages/${pageId}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function deleteCodexPage(campaignId: number, pageId: number): Promise<void> {
  const res = await apiFetch(`/campaigns/${campaignId}/codex-pages/${pageId}`, { method: 'DELETE' })
  if (!res.ok) throw new ApiError(res.status, await res.json())
}

// ------------------------------------------------------------ côté joueurs

export async function getSharedCodexPages(token: string): Promise<CodexPage[]> {
  const res = await fetch(`/api/share/${token}/codex`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Codex indisponible.')
  return (await res.json()).data
}

/** `characterToken` ne sert qu'à signer la page — le lien de campagne ne dit pas qui écrit. */
export async function createSharedCodexPage(
  token: string,
  page: { title: string; body?: string | null; parent_id?: number | null },
  characterToken: string | null,
): Promise<CodexPage> {
  const res = await fetch(`/api/share/${token}/codex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...page, character_token: characterToken }),
  })
  if (!res.ok) throw new Error('Page non créée.')
  return (await res.json()).data
}

export async function updateSharedCodexPage(
  token: string,
  pageId: number,
  patch: { title?: string; body?: string | null },
  characterToken: string | null,
): Promise<CodexPage> {
  const res = await fetch(`/api/share/${token}/codex/${pageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...patch, character_token: characterToken }),
  })
  if (!res.ok) throw new Error('Page non enregistrée.')
  return (await res.json()).data
}
