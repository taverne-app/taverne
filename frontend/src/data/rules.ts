export interface RuleEntry {
  id: string
  name: string
  category: 'action' | 'condition' | 'exhaustion' | 'cover'
  body: string
  tags?: string[]
}

export const RULES: RuleEntry[] = [
  // ── Actions de combat ───────────────────────────────────────────────────────
  {
    id: 'action-attack',
    name: 'Attaquer',
    category: 'action',
    body: 'Effectuez une attaque au corps à corps ou à distance. Avec Extra Attaque, vous pouvez attaquer plusieurs fois. Jet : 1d20 + bonus d\'attaque vs CA de la cible.',
    tags: ['action'],
  },
  {
    id: 'action-cast',
    name: 'Lancer un sort',
    category: 'action',
    body: 'Lancez un sort avec un temps d\'incantation d\'une action, d\'une action bonus ou d\'une réaction selon le sort.',
    tags: ['action', 'sort'],
  },
  {
    id: 'action-dash',
    name: 'Se précipiter',
    category: 'action',
    body: 'Doublez votre vitesse de déplacement pour ce tour. Les effets qui réduisent votre vitesse s\'appliquent avant le doublement.',
    tags: ['action', 'déplacement'],
  },
  {
    id: 'action-disengage',
    name: 'Se désengager',
    category: 'action',
    body: 'Votre déplacement ne provoque pas d\'attaques d\'opportunité pour le reste du tour.',
    tags: ['action', 'déplacement'],
  },
  {
    id: 'action-dodge',
    name: 'Esquiver',
    category: 'action',
    body: 'Jusqu\'à votre prochain tour, les jets d\'attaque contre vous ont désavantage (si vous pouvez vous voir), et vous avez avantage aux jets de sauvegarde de Dextérité. Perd son effet si vous êtes neutralisé ou si votre vitesse tombe à 0.',
    tags: ['action', 'défense'],
  },
  {
    id: 'action-help',
    name: 'Aider',
    category: 'action',
    body: 'Aidez un allié à portée : la prochaine attaque ou vérification de compétence de la créature aidée (avant votre prochain tour) bénéficie de l\'avantage.',
    tags: ['action', 'allié'],
  },
  {
    id: 'action-hide',
    name: 'Se cacher',
    category: 'action',
    body: 'Effectuez un test de Discrétion (DD fixé par le MJ). En cas de succès, vous êtes caché. Les créatures qui ne peuvent pas vous voir ont désavantage à leurs attaques et vous avez avantage contre elles.',
    tags: ['action', 'furtivité'],
  },
  {
    id: 'action-ready',
    name: 'Préparer',
    category: 'action',
    body: 'Choisissez un déclencheur et une réaction. Lorsque le déclencheur se produit, vous pouvez utiliser votre réaction pour agir, ou ignorer. Les sorts préparés requièrent concentration jusqu\'au déclencheur.',
    tags: ['action', 'réaction'],
  },
  {
    id: 'action-search',
    name: 'Chercher',
    category: 'action',
    body: 'Consacrez votre attention à trouver quelque chose. Vérification de Perception ou d\'Investigation selon ce que vous cherchez.',
    tags: ['action'],
  },
  {
    id: 'action-useobject',
    name: 'Utiliser un objet',
    category: 'action',
    body: 'Interagissez avec un objet ou utilisez une capacité spéciale d\'un objet. Les interactions simples (ouvrir une porte, sortir une arme) sont gratuites.',
    tags: ['action', 'objet'],
  },
  {
    id: 'action-opportunity',
    name: 'Attaque d\'opportunité',
    category: 'action',
    body: 'Réaction déclenchée quand une créature hostile quitte votre portée sans se désengager. Une attaque au corps à corps contre elle.',
    tags: ['réaction'],
  },
  {
    id: 'action-grapple',
    name: 'Empoigner',
    category: 'action',
    body: 'Attaque spéciale : test de Force (Athlétisme) vs Force (Athlétisme) ou Dextérité (Acrobaties) de la cible. En cas de succès, la cible est empoignée (vitesse 0). Taille max : une catégorie de plus que vous.',
    tags: ['action'],
  },
  {
    id: 'action-shove',
    name: 'Bousculer',
    category: 'action',
    body: 'Attaque spéciale pour repousser (1,5 m) ou faire tomber (à terre). Test de Force (Athlétisme) vs Force (Athlétisme) ou Dextérité (Acrobaties) de la cible.',
    tags: ['action'],
  },

  // ── Conditions ──────────────────────────────────────────────────────────────
  {
    id: 'cond-blinded',
    name: 'Aveuglé',
    category: 'condition',
    body: '• Ne peut pas voir et rate automatiquement les vérifications qui requièrent la vue.\n• Les jets d\'attaque contre lui ont avantage.\n• Ses jets d\'attaque ont désavantage.',
  },
  {
    id: 'cond-charmed',
    name: 'Charmé',
    category: 'condition',
    body: '• Ne peut pas attaquer ni cibler de façon nuisible le charmeur.\n• Le charmeur a avantage aux vérifications de Charisme pour interagir avec lui.',
  },
  {
    id: 'cond-deafened',
    name: 'Assourdi',
    category: 'condition',
    body: '• Ne peut pas entendre et rate automatiquement les vérifications qui requièrent l\'ouïe.',
  },
  {
    id: 'cond-frightened',
    name: 'Effrayé',
    category: 'condition',
    body: '• Désavantage aux jets d\'attaque et vérifications de caractéristique tant que la source de peur est en vue.\n• Ne peut pas se rapprocher volontairement de la source de peur.',
  },
  {
    id: 'cond-grappled',
    name: 'Empoigné',
    category: 'condition',
    body: '• Vitesse de déplacement devient 0 et ne peut pas bénéficier de bonus à la vitesse.\n• Se termine si l\'empoigneur est neutralisé ou si un effet les sépare.',
  },
  {
    id: 'cond-incapacitated',
    name: 'Neutralisé',
    category: 'condition',
    body: '• Ne peut pas effectuer d\'actions ni de réactions.',
  },
  {
    id: 'cond-invisible',
    name: 'Invisible',
    category: 'condition',
    body: '• Impossible à voir sans magie ou sens spécial. Considéré comme étant dans une zone fortement obscurcie.\n• Ses jets d\'attaque ont avantage.\n• Les jets d\'attaque contre lui ont désavantage.',
  },
  {
    id: 'cond-paralyzed',
    name: 'Paralysé',
    category: 'condition',
    body: '• Est neutralisé et ne peut pas bouger ni parler.\n• Les jets d\'attaque contre lui ont avantage.\n• Toute attaque qui le touche de moins de 1,5 m est un coup critique.\n• Rate automatiquement les JS de Force et Dextérité.',
  },
  {
    id: 'cond-petrified',
    name: 'Pétrifié',
    category: 'condition',
    body: '• Transformé en substance solide avec tous ses objets. Poids ×10.\n• Est neutralisé, ne peut plus parler ni bouger.\n• Résistance à tous les dégâts. Immunité au poison et à la maladie (effets existants suspendus).\n• Les jets d\'attaque contre lui ont avantage. Rate automatiquement les JS de Force et Dextérité.',
  },
  {
    id: 'cond-poisoned',
    name: 'Empoisonné',
    category: 'condition',
    body: '• Désavantage aux jets d\'attaque et vérifications de caractéristique.',
  },
  {
    id: 'cond-prone',
    name: 'À terre',
    category: 'condition',
    body: '• Ne peut se déplacer qu\'en rampant (coût ×2) sauf si se relève (coût = la moitié de la vitesse).\n• Désavantage aux jets d\'attaque.\n• Les attaques au corps à corps contre lui ont avantage ; à distance ont désavantage.',
  },
  {
    id: 'cond-restrained',
    name: 'Entravé',
    category: 'condition',
    body: '• Vitesse de déplacement devient 0.\n• Ses jets d\'attaque ont désavantage.\n• Les jets d\'attaque contre lui ont avantage.\n• Désavantage aux JS de Dextérité.',
  },
  {
    id: 'cond-stunned',
    name: 'Étourdi',
    category: 'condition',
    body: '• Est neutralisé et ne peut pas se déplacer.\n• Ne peut parler que de façon hésitante.\n• Les jets d\'attaque contre lui ont avantage.\n• Rate automatiquement les JS de Force et Dextérité.',
  },
  {
    id: 'cond-unconscious',
    name: 'Inconscient',
    category: 'condition',
    body: '• Est neutralisé, ne peut pas bouger ni parler et n\'a pas conscience de son environnement.\n• Lâche ce qu\'il tient et tombe à terre.\n• Les jets d\'attaque contre lui ont avantage.\n• Toute attaque qui le touche de moins de 1,5 m est un coup critique.\n• Rate automatiquement les JS de Force et Dextérité.',
  },
  {
    id: 'cond-exhaustion',
    name: 'Épuisement',
    category: 'condition',
    body: 'Voir la table Épuisement ci-dessous. Les effets sont cumulatifs. Se rétablit d\'un niveau par repos long (minimum 1 PV).',
  },
  {
    id: 'cond-concentration',
    name: 'Concentration',
    category: 'condition',
    body: '• Lancer un sort nécessitant une concentration brise celle en cours.\n• Prendre des dégâts → JS Constitution DD max(10, moitié des dégâts reçus).\n• Être neutralisé ou tué met fin à la concentration automatiquement.',
  },

  // ── Épuisement ───────────────────────────────────────────────────────────────
  {
    id: 'exh-1',
    name: 'Épuisement niv. 1',
    category: 'exhaustion',
    body: 'Désavantage aux vérifications de caractéristique.',
  },
  {
    id: 'exh-2',
    name: 'Épuisement niv. 2',
    category: 'exhaustion',
    body: 'Vitesse de déplacement réduite de moitié.',
  },
  {
    id: 'exh-3',
    name: 'Épuisement niv. 3',
    category: 'exhaustion',
    body: 'Désavantage aux jets d\'attaque et aux jets de sauvegarde.',
  },
  {
    id: 'exh-4',
    name: 'Épuisement niv. 4',
    category: 'exhaustion',
    body: 'Maximum de PV réduit de moitié.',
  },
  {
    id: 'exh-5',
    name: 'Épuisement niv. 5',
    category: 'exhaustion',
    body: 'Vitesse de déplacement réduite à 0.',
  },
  {
    id: 'exh-6',
    name: 'Épuisement niv. 6',
    category: 'exhaustion',
    body: 'Mort.',
  },

  // ── Couverture ───────────────────────────────────────────────────────────────
  {
    id: 'cover-half',
    name: 'Couverture partielle (½)',
    category: 'cover',
    body: '+2 aux jets d\'attaque et jets de sauvegarde de Dextérité.\nExemples : un autre personnage, un arbre fin, un pilier.',
  },
  {
    id: 'cover-threequarters',
    name: 'Couverture aux ¾',
    category: 'cover',
    body: '+5 aux jets d\'attaque et jets de sauvegarde de Dextérité.\nExemples : un judas, des branches épaisses, un portcullis.',
  },
  {
    id: 'cover-full',
    name: 'Couverture totale',
    category: 'cover',
    body: 'Impossible à cibler directement par une attaque ou un sort. La créature est entièrement masquée par un obstacle.',
  },
]

export const RULE_CATEGORIES = [
  { id: 'action',    label: 'Actions' },
  { id: 'condition', label: 'Conditions' },
  { id: 'exhaustion',label: 'Épuisement' },
  { id: 'cover',     label: 'Couverture' },
] as const
