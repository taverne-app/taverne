import { apiFetch, ApiError } from './client'
import type { Character } from './characters'
import type { Combatant } from './combatants'

export interface SavedEncounter {
  name: string
  entries: { monster_name: string; count: number; cr?: string }[]
}

export interface Npc {
  name: string
  role: string
  status: 'allié' | 'neutre' | 'ennemi' | 'inconnu'
  location?: string
  faction?: string
  notes: string
}

/** Nature d'une scène de préparation — détermine son icône et ses actions. */
export type SceneKind = 'combat' | 'event' | 'npc' | 'exploration'

export interface PrepScene {
  id: string
  /**
   * Optionnel : les scènes créées avant l'introduction des types n'en ont pas.
   * Elles sont traitées comme des événements.
   */
  kind?: SceneKind
  title: string
  location_name: string
  npc_names: string[]
  encounter_name: string
  treasure: string
  hook: string
  notes: string
  done: boolean
}

export interface RandomTableEntry {
  weight: number
  text: string
}

export interface RandomTable {
  name: string
  entries: RandomTableEntry[]
}

export interface GameCalendar {
  date: string
  time: 'matin' | 'après-midi' | 'soir' | 'nuit'
  weather: string
  notes: string
}

export interface TreasureItem {
  name: string
  quantity: number
  /** Valeur unitaire en pièces d'or. `null` = objet sans valeur chiffrée. */
  value_gp: number | null
  notes: string
}



export interface Location {
  name: string
  type: 'ville' | 'donjon' | 'forêt' | 'taverne' | 'temple' | 'château' | 'autre'
  status: 'inconnu' | 'connu' | 'exploré'
  reputation: 'héros' | 'respecté' | 'neutre' | 'suspect' | 'recherché'
  notes: string
  /**
   * Carte du lieu (plan de ville, de donjon…). URL relative (/storage/…) — jamais
   * absolue (piège #4), sinon elle casse chez les joueurs. Absente sur les lieux
   * d'avant l'ajout de ce champ, d'où l'optionnel. Exposée telle quelle aux joueurs
   * via SharedCampaignResource.
   */
  map_url?: string
}

export interface MonsterAttack {
  name: string
  bonus: string
  damage: string
  notes?: string
}

export interface CustomMonster {
  name: string
  cr: string
  ac: number
  hp_avg: number
  initiative_mod: number
  xp: number
  speed?: number
  notes?: string
  attacks?: MonsterAttack[]
  /** Vignette du monstre. URL relative (/storage/…) — jamais absolue (piège #4). */
  image_url?: string
  /** Zone où on le rencontre — le nom d'un lieu de la campagne (section Monde). */
  zone?: string
}

export interface Faction {
  name: string
  description: string
  reputation: number
  notes: string
}

export interface MapPin {
  id: string
  label: string
  location_name?: string
  x: number
  y: number
  color: 'amber' | 'red' | 'blue' | 'green' | 'purple' | 'sky'
}

export interface CampaignMap {
  image_url: string
  pins: MapPin[]
}

export type TokenColor = 'amber' | 'red' | 'blue' | 'green' | 'purple' | 'sky'

export interface BattleToken {
  id: string
  /** A token either mirrors a live combatant/character, or stands alone (décor, PNJ). */
  ref_type: 'combatant' | 'character' | null
  ref_id: number | null
  label: string
  x: number
  y: number
  color: TokenColor
  size: 'sm' | 'md' | 'lg'
  /** DM-only token (ambush, hidden trap) — never sent to the players' view. */
  hidden?: boolean
}

/** Gabarits de sorts : les formes de zone de la 5e. */
export type ZoneShape = 'sphere' | 'cone' | 'line' | 'cube'

export interface BattleZone {
  id: string
  shape: ZoneShape
  /** Centre (sphère, cube) ou origine (cône, ligne), en % du plateau. */
  x: number
  y: number
  /** En MÈTRES : rayon (sphère), longueur (cône, ligne), côté (cube). */
  size: number
  /** Largeur en mètres — ligne uniquement. */
  width?: number
  /** Orientation en degrés (0 = vers la droite) — cône et ligne. */
  angle?: number
  color?: TokenColor
}

export interface BattleMap {
  image_url: string
  /**
   * Null = no grid. When set, tokens snap to cells and distances are measured.
   * `offset_x`/`offset_y` décalent la grille (en % du plateau) pour la faire coïncider
   * avec celle dessinée sur l'image de fond ; absents sur les cartes d'avant l'outil
   * de calage, d'où l'optionnel — 0 est le comportement historique.
   */
  grid: { cols: number; rows: number; offset_x?: number; offset_y?: number } | null
  tokens: BattleToken[]
  /**
   * Zones diffusées aux joueurs. L'aperçu que le MJ est en train de viser n'est PAS
   * ici : il reste local tant qu'il n'a pas cliqué « Lancer », pour ne pas dévoiler
   * sa visée aux joueurs.
   */
  zones?: BattleZone[]
}

/** The combatant/character whose turn it is, so its token can be highlighted. */
export interface ActiveRef {
  kind: 'combatant' | 'character'
  id: number
}

export interface Campaign {
  /** Nombre de chapitres — compté côté serveur pour le badge de la barre latérale. */
  chapters_count?: number
  id: number
  name: string
  description: string | null
  dm_notes: string | null
  saved_encounters: SavedEncounter[]
  npcs: Npc[]
  game_calendar: Partial<GameCalendar>
  party_treasury: TreasureItem[]
  locations: Location[]
  custom_monsters: CustomMonster[]
  factions: Faction[]
  random_tables: RandomTable[]
  campaign_map: CampaignMap | null
  battle_map: BattleMap | null
  share_token: string | null
  time_of_day: string | null
  /** Vrai quand un combat est lancé : c'est ce qui ouvre la vue Combat aux joueurs. */
  combat_active: boolean
  /**
   * Le tour en cours, persisté à chaque changement de tour du MJ. Sans lui, une page
   * joueur ouverte en cours de combat resterait sur « tour inconnu » jusqu'au prochain
   * clic du MJ — et griserait ses actions entre-temps.
   */
  combat_active_kind?: 'character' | 'combatant' | null
  combat_active_id?: number | null
  combat_round?: number
  /**
   * Nom du lieu (section Monde) qui sert de théâtre au combat. Mémorisé quand le MJ
   * reprend la carte d'un lieu comme fond de plateau ; effacé s'il choisit une image
   * qui n'est celle d'aucun lieu. Exposé aux joueurs via SharedCampaignResource.
   */
  combat_location?: string | null
  characters: Character[]
  combatants?: Combatant[]
  created_at: string
  updated_at: string
}

export async function listCampaigns(): Promise<Campaign[]> {
  const res = await apiFetch('/campaigns')
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function createCampaign(name: string, description?: string): Promise<Campaign> {
  const res = await apiFetch('/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function getCampaign(id: number): Promise<Campaign> {
  const res = await apiFetch(`/campaigns/${id}`)
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function updateCampaign(id: number, data: { name?: string; description?: string; dm_notes?: string | null; saved_encounters?: SavedEncounter[]; npcs?: Npc[]; game_calendar?: Partial<GameCalendar>; party_treasury?: TreasureItem[]; locations?: Location[]; custom_monsters?: CustomMonster[]; factions?: Faction[]; random_tables?: RandomTable[]; campaign_map?: CampaignMap | null; battle_map?: BattleMap | null; combat_active?: boolean; combat_location?: string | null }): Promise<Campaign> {
  const res = await apiFetch(`/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function deleteCampaign(id: number): Promise<void> {
  const res = await apiFetch(`/campaigns/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new ApiError(res.status, await res.json())
}

export async function addCharacterToCampaign(campaignId: number, characterId: number): Promise<Campaign> {
  const res = await apiFetch(`/campaigns/${campaignId}/characters`, {
    method: 'POST',
    body: JSON.stringify({ character_id: characterId }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return (await res.json()).data
}

export async function broadcastCombatTurn(
  campaignId: number,
  payload: { active_kind: 'character' | 'combatant' | null; active_id: number | null; round: number },
): Promise<void> {
  await apiFetch(`/campaigns/${campaignId}/combat-turn`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function setCampaignTimeOfDay(campaignId: number, timeOfDay: string | null): Promise<void> {
  const res = await apiFetch(`/campaigns/${campaignId}/time-of-day`, {
    method: 'PATCH',
    body: JSON.stringify({ time_of_day: timeOfDay }),
  })
  if (!res.ok) throw new ApiError(res.status, await res.json())
}
