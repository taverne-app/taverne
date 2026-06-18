import { apiFetch, ApiError } from './client'

export type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
export type SkillName =
  | 'acrobatics' | 'animal_handling' | 'arcana' | 'athletics' | 'deception'
  | 'history' | 'insight' | 'intimidation' | 'investigation' | 'medicine'
  | 'nature' | 'perception' | 'performance' | 'persuasion' | 'religion'
  | 'sleight_of_hand' | 'stealth' | 'survival'

export interface InventoryItem {
  name: string
  quantity: number
  weight: number
  value: string
  equipped: boolean
}

export interface SpellSlot {
  max: number
  used: number
}

export interface Spell {
  name: string
  level: number
  prepared: boolean
}

export interface Feature {
  name: string
  source: string
  description: string
}

export interface Currency {
  pc: number
  pa: number
  pe: number
  po: number
  pp: number
}

export interface Character {
  id: number
  name: string
  race: string
  character_class: string
  subclass: string | null
  level: number
  background: string | null
  alignment: string | null
  experience_points: number
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
    initiative_roll: number | null
    speed: number
    inspiration: boolean
    is_alive: boolean
    hit_dice_type: number
    hit_dice_remaining: number
    hit_dice_max: number
  }
  state: {
    conditions: string[]
    death_saves_successes: number
    death_saves_failures: number
  }
  spellcasting: {
    ability: AbilityName | null
    modifier: number
    save_dc: number
    attack_bonus: number
    slots: Record<string, SpellSlot>
    spells: Spell[]
  }
  inventory: {
    items: InventoryItem[]
    capacity: number
  }
  features: Feature[]
  currency: Currency
  damage_modifiers: {
    resistances: string[]
    immunities: string[]
    vulnerabilities: string[]
  }
  notes: string | null
}

export interface CreateCharacterPayload {
  name: string
  race: string
  character_class: string
  max_hp: number
  armor_class: number
  level?: number
}

export interface IdentityPayload {
  name?: string
  race?: string
  character_class?: string
  subclass?: string | null
  level?: number
  background?: string | null
  alignment?: string | null
  experience_points?: number
  speed?: number
  max_hp?: number
  armor_class?: number
  hit_dice_type?: number
}

export async function updateIdentity(id: number, payload: IdentityPayload): Promise<Character> {
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
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

export async function setInitiativeRoll(
  id: number,
  roll: number | null,
): Promise<Character> {
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ initiative_roll: roll }),
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

export interface DiceRoll {
  character_id: number
  character_name: string
  label: string
  count: number
  sides: number
  rolls: number[]
  modifier: number
  total: number
  advantage: boolean
  disadvantage: boolean
  timestamp: string
}

export async function updateInventory(id: number, items: InventoryItem[]): Promise<Character> {
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ inventory: items }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function shortRest(
  id: number,
  diceSpent: number,
): Promise<{ character: Character; rolls: number[]; modifier: number; total_healed: number }> {
  const res = await apiFetch(`/characters/${id}/short-rest`, {
    method: 'POST',
    body: JSON.stringify({ dice_spent: diceSpent }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return res.json()
}

export async function updateDamageModifiers(
  id: number,
  modifiers: { resistances: string[]; immunities: string[]; vulnerabilities: string[] },
): Promise<Character> {
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ damage_modifiers: modifiers }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateCurrency(id: number, currency: Currency): Promise<Character> {
  const res = await apiFetch(`/characters/${id}/currency`, {
    method: 'PATCH',
    body: JSON.stringify(currency),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateFeatures(id: number, features: Feature[]): Promise<Character> {
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ features }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateNotes(id: number, notes: string): Promise<Character> {
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function rollDice(
  id: number,
  params: {
    sides: number
    count?: number
    modifier?: number
    label?: string
    advantage?: boolean
    disadvantage?: boolean
  },
): Promise<DiceRoll> {
  const res = await apiFetch(`/characters/${id}/roll`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return res.json()
}

export async function useSpellSlot(
  id: number,
  level: number,
  action: 'use' | 'restore',
): Promise<Character> {
  const res = await apiFetch(`/characters/${id}/spell-slot`, {
    method: 'PATCH',
    body: JSON.stringify({ level, action }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function longRest(id: number): Promise<Character> {
  const res = await apiFetch(`/characters/${id}/rest`, { method: 'POST' })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateSpells(
  id: number,
  spells: Spell[],
  spellcastingAbility?: AbilityName | null,
): Promise<Character> {
  const body: Record<string, unknown> = { spells_known: spells }
  if (spellcastingAbility !== undefined) body.spellcasting_ability = spellcastingAbility
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateSpellSlots(
  id: number,
  slots: Record<string, SpellSlot>,
  spellcastingAbility?: AbilityName | null,
): Promise<Character> {
  const body: Record<string, unknown> = { spell_slots: slots }
  if (spellcastingAbility !== undefined) body.spellcasting_ability = spellcastingAbility
  const res = await apiFetch(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
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
