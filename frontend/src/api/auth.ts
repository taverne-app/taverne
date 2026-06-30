import { apiFetch, ApiError } from './client'

export interface User {
  id: number
  name: string
  email: string
  plan: 'free' | 'adventurer' | 'guild'
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, password_confirmation: password }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return res.json()
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return res.json()
}

export async function fetchCurrentUser(): Promise<User> {
  const res = await apiFetch('/user')
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return res.json()
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' })
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}
