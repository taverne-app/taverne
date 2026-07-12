import type { Dispatch, SetStateAction } from 'react'
import type { Campaign } from '../../api/campaigns'
import type { Character } from '../../api/characters'

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
