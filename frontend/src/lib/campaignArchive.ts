import type { Campaign } from '../api/campaigns'
import type { Character } from '../api/characters'
import type { Chapter } from '../api/chapters'
import { createZip, readZip, type ZipEntry } from './zip'

export const ARCHIVE_VERSION = 3

const CAMPAIGN_FILE = 'campagne.json'
const CHARACTER_DIR = 'personnages/'

/** Flat shape accepted by POST /campaigns/{id}/characters/import. */
export type CharacterArchive = Record<string, unknown>

export interface ParsedArchive {
  campaign: Record<string, unknown>
  characters: CharacterArchive[]
}

function slugify(name: string, fallback: string): string {
  const slug = name.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || fallback
}

/**
 * The API serves a character as a nested, computed view (`skills.stealth.proficient`).
 * Import needs the raw columns back, so flatten and re-derive the proficiency lists.
 */
export function characterToArchive(c: Character): CharacterArchive {
  const proficientKeys = (record: Record<string, { proficient?: boolean; expert?: boolean }>, flag: 'proficient' | 'expert') =>
    Object.entries(record).filter(([, v]) => v[flag]).map(([k]) => k)

  return {
    name: c.name,
    portrait_url: c.portrait_url,
    race: c.race,
    character_class: c.character_class,
    subclass: c.subclass,
    secondary_class: c.secondary_class,
    secondary_level: c.secondary_level,
    level: c.level,
    background: c.background,
    alignment: c.alignment,
    experience_points: c.experience_points,

    strength: c.abilities.strength ?? 10,
    dexterity: c.abilities.dexterity ?? 10,
    constitution: c.abilities.constitution ?? 10,
    intelligence: c.abilities.intelligence ?? 10,
    wisdom: c.abilities.wisdom ?? 10,
    charisma: c.abilities.charisma ?? 10,

    save_proficiencies: proficientKeys(c.saving_throws, 'proficient'),
    skill_proficiencies: proficientKeys(c.skills, 'proficient'),
    skill_expertise: proficientKeys(c.skills, 'expert'),

    max_hp: c.combat.max_hp,
    current_hp: c.combat.current_hp,
    temporary_hp: c.combat.temporary_hp,
    temp_max_hp_bonus: c.combat.temp_max_hp_bonus,
    armor_class: c.combat.armor_class,
    speed: c.combat.speed,
    inspiration: c.combat.inspiration,
    initiative_roll: c.combat.initiative_roll,
    hit_dice_type: c.combat.hit_dice_type,
    hit_dice_remaining: c.combat.hit_dice_remaining,

    conditions: c.state.conditions,
    condition_durations: c.state.condition_durations,
    death_saves_successes: c.state.death_saves_successes,
    death_saves_failures: c.state.death_saves_failures,
    concentrating_on: c.state.concentrating_on,
    exhaustion_level: c.state.exhaustion_level,

    spellcasting_ability: c.spellcasting.ability,
    spell_slots: c.spellcasting.slots,
    spells_known: c.spellcasting.spells,

    inventory: c.inventory.items,
    attack_macros: c.attack_macros,
    resources: c.resources,
    features: c.features,
    currency: c.currency,
    damage_modifiers: c.damage_modifiers,

    notes: c.notes,
    dm_notes: c.dm_notes,
    personality_traits: c.personality_traits,
    ideals: c.ideals,
    bonds: c.bonds,
    flaws: c.flaws,
    languages: c.languages,
    tool_proficiencies: c.tool_proficiencies,
  }
}

export function campaignToArchive(campaign: Campaign, chapters: Chapter[]): Record<string, unknown> {
  return {
    _version: ARCHIVE_VERSION,
    name: campaign.name,
    description: campaign.description,
    dm_notes: campaign.dm_notes,
    npcs: campaign.npcs,
    locations: campaign.locations,
    party_treasury: campaign.party_treasury,
    saved_encounters: campaign.saved_encounters,
    custom_monsters: campaign.custom_monsters,
    factions: campaign.factions,
    random_tables: campaign.random_tables,
    game_calendar: campaign.game_calendar,
    campaign_map: campaign.campaign_map,
    chapters,
  }
}

export function buildCampaignZip(campaign: Campaign, characters: Character[], chapters: Chapter[]): Blob {
  const entries: ZipEntry[] = [
    { name: CAMPAIGN_FILE, text: JSON.stringify(campaignToArchive(campaign, chapters), null, 2) },
  ]

  const used = new Set<string>()
  for (const character of characters) {
    let slug = slugify(character.name, `personnage-${character.id}`)
    while (used.has(slug)) slug = `${slug}-${character.id}`
    used.add(slug)
    entries.push({ name: `${CHARACTER_DIR}${slug}.json`, text: JSON.stringify(characterToArchive(character), null, 2) })
  }

  return createZip(entries)
}

export function archiveFilename(campaignName: string): string {
  return `${slugify(campaignName, 'campagne')}.zip`
}

export class ArchiveError extends Error {}

/**
 * Accepts a zip written by buildCampaignZip and, for archives exported before
 * characters were bundled, a bare campaign JSON.
 */
export async function parseCampaignArchive(file: File): Promise<ParsedArchive> {
  if (file.name.toLowerCase().endsWith('.json')) {
    const campaign = JSON.parse(await file.text())
    return { campaign, characters: [] }
  }

  const files = await readZip(file)

  const campaignJson = files.get(CAMPAIGN_FILE)
  if (!campaignJson) throw new ArchiveError(`L'archive ne contient pas de ${CAMPAIGN_FILE}.`)

  const characters: CharacterArchive[] = []
  for (const [name, text] of files) {
    if (!name.startsWith(CHARACTER_DIR) || !name.endsWith('.json')) continue
    const parsed = JSON.parse(text)
    if (!parsed?.name) throw new ArchiveError(`« ${name} » n'a pas de nom de personnage.`)
    characters.push(parsed)
  }

  return { campaign: JSON.parse(campaignJson), characters }
}
