import { apiFetch, ApiError } from './client'

export interface LibraryImage {
  id: number
  url: string
  original_name: string
  mime: string
  size: number
  created_at: string
}

/** `max: null` = illimité (plans payants). */
export interface ImageQuota {
  used: number
  max: number | null
}

export interface ImageLibrary {
  images: LibraryImage[]
  quota: ImageQuota
}

export async function listImages(): Promise<ImageLibrary> {
  const res = await apiFetch('/images')
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const body = await res.json()
  return { images: body.data, quota: body.meta }
}

export async function uploadImage(file: File): Promise<{ image: LibraryImage; quota: ImageQuota }> {
  const form = new FormData()
  form.append('file', file)

  // Pas de Content-Type manuel : le navigateur doit poser lui-même la boundary
  // multipart. apiFetch conserve l'en-tête Authorization.
  const res = await apiFetch('/images', { method: 'POST', body: form })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const body = await res.json()
  return { image: body.data, quota: body.meta }
}

export async function deleteImage(id: number): Promise<ImageQuota> {
  const res = await apiFetch(`/images/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).meta
}
