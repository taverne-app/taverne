import type { Dispatch, SetStateAction } from 'react'
import type { Campaign } from '../../api/campaigns'
import type { Character } from '../../api/characters'
import type { CampaignSession } from '../../api/sessions'

/**
 * Contrat entre la coquille CampaignPage et ses sections.
 *
 * L'analyse du fichier d'origine (5 604 lignes, 214 déclarations) a montré que les
 * onglets étaient déjà indépendants : 195 déclarations n'appartiennent qu'à un seul
 * onglet. Seuls la campagne, les personnages et trois helpers sont réellement
 * partagés — c'est exactement ce que porte ce contrat.
 */
export interface SectionProps {
  campaign: Campaign
  setCampaign: Dispatch<SetStateAction<Campaign | null>>
  characters: Character[]
  setCharacters: Dispatch<SetStateAction<Character[]>>
  /** Indicateur de sauvegarde de la coquille : les sections désactivent leurs boutons pendant. */
  saving: boolean
  /** Modale d'ajout de personnage : elle vit dans la coquille, les sections l'ouvrent. */
  setAllChars: Dispatch<SetStateAction<Character[]>>
  setShowAddModal: Dispatch<SetStateAction<boolean>>
  setSaving: Dispatch<SetStateAction<boolean>>
  /** Séances : chargées par la coquille, éditées par la section Journal. */
  sessions: CampaignSession[]
  setSessions: Dispatch<SetStateAction<CampaignSession[]>>
  copiedKey: string | null
  copyToClipboard: (key: string, text: string) => void
  exportSection: (sectionKey: string, data: unknown[]) => void
  importSectionData: (file: File, section: 'npcs' | 'locations' | 'quests' | 'factions') => Promise<void>
}

export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export function sign(n: number) { return n >= 0 ? `+${n}` : `${n}` }

export function hpColor(current: number, max: number) {
  const pct = max > 0 ? current / max : 0
  if (pct > 0.5) return 'bg-emerald-500'
  if (pct > 0.25) return 'bg-amber-500'
  return 'bg-red-500'
}

export const CONDITIONS_FR: Record<string, string> = {
  blinded: 'Aveuglé', charmed: 'Charmé', deafened: 'Assourdi',
  exhaustion: 'Épuisé', frightened: 'Effrayé', grappled: 'Agrippé',
  incapacitated: 'Hors de combat', invisible: 'Invisible', paralyzed: 'Paralysé',
  petrified: 'Pétrifié', poisoned: 'Empoisonné', prone: 'À terre',
  restrained: 'Entravé', stunned: 'Étourdi', unconscious: 'Inconscient',
}
