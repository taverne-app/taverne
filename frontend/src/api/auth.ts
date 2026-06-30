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

export async function updateProfile(name: string, email: string): Promise<User> {
  const res = await apiFetch('/user', {
    method: 'PATCH',
    body: JSON.stringify({ name, email }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return res.json()
}

export async function updatePassword(
  current_password: string,
  password: string,
  password_confirmation: string,
): Promise<void> {
  const res = await apiFetch('/user/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password, password, password_confirmation }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
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
