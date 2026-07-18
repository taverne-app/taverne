import { useCallback, useMemo, useState } from 'react'
import { useSharedSheets, type SharedSheet } from './sharedSheets'

/**
 * « Quel personnage est ce visiteur, dans cette campagne ? »
 *
 * Le lien de campagne est le MÊME pour toute la table : le serveur ne peut pas savoir
 * qui regarde. L'identité vient donc du jeton du PERSONNAGE, que le MJ ne remet qu'à
 * son joueur — le posséder EST la permission d'agir sur cette fiche.
 *
 * On ne demande rien au joueur : `sharedSheets` retient déjà toute fiche dont il a
 * ouvert le lien sur cet appareil (c'est ce qui alimente la barre latérale partagée).
 * Il suffit d'y chercher celles qui appartiennent à la campagne en cours.
 *
 * Ce module est la SEULE réponse à cette question : le dock de combat et le carnet de
 * notes s'en servent tous les deux. Deux implémentations divergeraient.
 */

/** Choix explicite, utile seulement quand plusieurs fiches partagent une campagne. */
const claimKey = (campaignToken: string) => `taverne:combat-perso:${campaignToken}`

export interface PlayerIdentity {
  /** Le jeton de la fiche du joueur, ou null s'il reste un choix à faire. */
  token: string | null
  /** Les fiches de cette campagne connues de cet appareil. */
  candidates: SharedSheet[]
  pick: (token: string) => void
  unpick: () => void
}

export function usePlayerCharacter(campaignToken: string | undefined): PlayerIdentity {
  const sheets = useSharedSheets()
  const [picked, setPicked] = useState<string | null>(
    () => (campaignToken ? localStorage.getItem(claimKey(campaignToken)) : null),
  )

  const candidates = useMemo(
    () => (campaignToken ? sheets.filter(s => s.campaignShareToken === campaignToken) : []),
    [sheets, campaignToken],
  )

  // Une seule fiche dans cette campagne : c'est forcément celle du joueur. Un choix
  // explicite ne sert qu'à départager, et il est ignoré s'il ne correspond plus à
  // rien — une fiche révoquée ne doit pas bloquer la reconnaissance.
  const token = candidates.length === 1
    ? candidates[0].token
    : (picked && candidates.some(s => s.token === picked) ? picked : null)

  const pick = useCallback((t: string) => {
    if (campaignToken) localStorage.setItem(claimKey(campaignToken), t)
    setPicked(t)
  }, [campaignToken])

  const unpick = useCallback(() => {
    if (campaignToken) localStorage.removeItem(claimKey(campaignToken))
    setPicked(null)
  }, [campaignToken])

  return { token, candidates, pick, unpick }
}
