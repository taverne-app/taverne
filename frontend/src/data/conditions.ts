export const CONDITIONS_FR: Record<string, string> = {
  blinded:       'Aveuglé',
  charmed:       'Charmé',
  deafened:      'Assourdi',
  exhaustion:    'Épuisé',
  frightened:    'Effrayé',
  grappled:      'Agrippé',
  incapacitated: 'Hors de combat',
  invisible:     'Invisible',
  paralyzed:     'Paralysé',
  petrified:     'Pétrifié',
  poisoned:      'Empoisonné',
  prone:         'À terre',
  restrained:    'Entravé',
  stunned:       'Étourdi',
  unconscious:   'Inconscient',
}

export const CONDITIONS_RULES: Record<string, string[]> = {
  blinded: [
    'Ne peut pas voir.',
    'Rate automatiquement les jets nécessitant la vue.',
    'Les jets d\'attaque contre la créature ont l\'avantage.',
    'Ses jets d\'attaque ont le désavantage.',
  ],
  charmed: [
    'Ne peut pas attaquer le charmeur ni le cibler avec des capacités nuisibles.',
    'Le charmeur a l\'avantage sur les jets de caractéristique pour interagir socialement avec elle.',
  ],
  deafened: [
    'Ne peut pas entendre.',
    'Rate automatiquement les jets nécessitant l\'ouïe.',
  ],
  exhaustion: [
    'Niv. 1 — Désavantage aux jets de caractéristique.',
    'Niv. 2 — Vitesse divisée par 2.',
    'Niv. 3 — Désavantage aux jets d\'attaque et de sauvegarde.',
    'Niv. 4 — Maximum de PV divisé par 2.',
    'Niv. 5 — Vitesse réduite à 0.',
    'Niv. 6 — Mort.',
  ],
  frightened: [
    'Désavantage aux jets de caractéristique et d\'attaque quand la source de peur est en vue.',
    'Ne peut pas s\'approcher volontairement de la source de sa peur.',
  ],
  grappled: [
    'Vitesse réduite à 0.',
    'Prend fin si l\'agrippeur est neutralisé ou si la créature est éloignée hors de portée.',
  ],
  incapacitated: [
    'Ne peut pas effectuer d\'actions ni de réactions.',
  ],
  invisible: [
    'Impossible à voir sans magie ou sens spécial.',
    'Les jets d\'attaque contre elle ont le désavantage.',
    'Ses jets d\'attaque ont l\'avantage.',
  ],
  paralyzed: [
    'Est neutralisée et ne peut pas bouger ni parler.',
    'Rate automatiquement les JS de Force et Dextérité.',
    'Les jets d\'attaque contre elle ont l\'avantage.',
    'Tout coup à 1,50 m ou moins est un coup critique.',
  ],
  petrified: [
    'Transformée en substance inerte. Neutralisée.',
    'Ne peut pas bouger, parler ni avoir conscience de son environnement.',
    'Rate automatiquement les JS de Force et Dextérité.',
    'Résistance à tous les dégâts. Immunité au poison et aux maladies.',
  ],
  poisoned: [
    'Désavantage aux jets d\'attaque et aux jets de caractéristique.',
  ],
  prone: [
    'Ne peut que ramper, ou dépenser la moitié de sa vitesse pour se relever.',
    'Désavantage aux jets d\'attaque.',
    'Les attaques de corps-à-corps contre elle ont l\'avantage.',
    'Les attaques à distance contre elle ont le désavantage.',
  ],
  restrained: [
    'Vitesse réduite à 0.',
    'Désavantage aux jets d\'attaque et aux JS de Dextérité.',
    'Les jets d\'attaque contre elle ont l\'avantage.',
  ],
  stunned: [
    'Est neutralisée et ne peut pas bouger. Ne parle qu\'avec hésitation.',
    'Rate automatiquement les JS de Force et Dextérité.',
    'Les jets d\'attaque contre elle ont l\'avantage.',
  ],
  unconscious: [
    'Est neutralisée, ne peut pas bouger ni parler. Tombe à terre.',
    'Lâche tout ce qu\'elle tient. N\'a plus conscience de son environnement.',
    'Rate automatiquement les JS de Force et Dextérité.',
    'Les jets d\'attaque contre elle ont l\'avantage.',
    'Tout coup à 1,50 m ou moins est un coup critique.',
  ],
}
