import { apiFetch, ApiError } from './client'

export async function createCheckoutSession(plan: 'adventurer' | 'guild'): Promise<string> {
  const res = await apiFetch('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const data = await res.json()
  return data.url as string
}

export async function createPortalSession(): Promise<string> {
  const res = await apiFetch('/billing/portal', { method: 'POST' })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const data = await res.json()
  return data.url as string
}
