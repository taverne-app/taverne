import { apiFetch, ApiError } from './client'

export interface Character {
  id: number
  name: string
  race: string
  character_class: string
  level: number
  proficiency_bonus: number
  abilities: {
    strength: number | null
    dexterity: number | null
    constitution: number | null
    intelligence: number | null
    wisdom: number | null
    charisma: number | null
  }
  modifiers: {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
  }
  combat: {
    current_hp: number
    max_hp: number
    temporary_hp: number
    armor_class: number
    speed: number
    initiative: number
    inspiration: boolean
  }
  state: {
    conditions: string[]
    death_saves_successes: number
    death_saves_failures: number
  }
}

export interface CreateCharacterPayload {
  name: string
  race: string
  character_class: string
  max_hp: number
  armor_class: number
  level?: number
}

export async function listCharacters(): Promise<Character[]> {
  const res = await apiFetch('/characters')
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const json = await res.json()
  return json.data
}

export async function createCharacter(payload: CreateCharacterPayload): Promise<Character> {
  const res = await apiFetch('/characters', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const json = await res.json()
  return json.data
}

export async function getCharacter(id: number): Promise<Character> {
  const res = await apiFetch(`/characters/${id}`)
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const json = await res.json()
  return json.data
}

export async function deleteCharacter(id: number): Promise<void> {
  const res = await apiFetch(`/characters/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new ApiError(res.status, await res.json())
}

export async function updateHp(
  id: number,
  amount: number,
  type: 'damage' | 'heal' | 'temporary',
): Promise<Character> {
  const res = await apiFetch(`/characters/${id}/hp`, {
    method: 'PATCH',
    body: JSON.stringify({ amount, type }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const json = await res.json()
  return json.data
}

export async function updateConditions(id: number, conditions: string[]): Promise<Character> {
  const res = await apiFetch(`/characters/${id}/conditions`, {
    method: 'PATCH',
    body: JSON.stringify({ conditions }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const json = await res.json()
  return json.data
}

export async function updateAbilities(
  id: number,
  abilities: Partial<Record<keyof Character['abilities'], number>>,
): Promise<Character> {
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(abilities),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const json = await res.json()
  return json.data
}

export async function updateDeathSaves(
  id: number,
  successes: number,
  failures: number,
): Promise<Character> {
  const res = await apiFetch(`/characters/${id}/death-saves`, {
    method: 'PATCH',
    body: JSON.stringify({ successes, failures }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  const json = await res.json()
  return json.data
}
