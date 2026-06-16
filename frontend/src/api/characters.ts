import { apiFetch, ApiError } from './client'

export type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
export type SkillName =
  | 'acrobatics' | 'animal_handling' | 'arcana' | 'athletics' | 'deception'
  | 'history' | 'insight' | 'intimidation' | 'investigation' | 'medicine'
  | 'nature' | 'perception' | 'performance' | 'persuasion' | 'religion'
  | 'sleight_of_hand' | 'stealth' | 'survival'

export interface Character {
  id: number
  name: string
  race: string
  character_class: string
  level: number
  proficiency_bonus: number
  abilities: Record<AbilityName, number | null>
  modifiers: Record<AbilityName, number>
  saving_throws: Record<AbilityName, { modifier: number; proficient: boolean }>
  skills: Record<SkillName, { modifier: number; proficient: boolean; ability: AbilityName }>
  passive_perception: number
  combat: {
    current_hp: number
    max_hp: number
    temporary_hp: number
    armor_class: number
    initiative: number
    speed: number
    inspiration: boolean
    is_alive: boolean
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

export async function updateProficiencies(
  id: number,
  saveProficiencies: string[],
  skillProficiencies: string[],
): Promise<Character> {
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      save_proficiencies: saveProficiencies,
      skill_proficiencies: skillProficiencies,
    }),
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
