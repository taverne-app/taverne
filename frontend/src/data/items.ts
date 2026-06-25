export type ItemRarity = 'commun' | 'peu commun' | 'rare' | 'très rare' | 'légendaire'
export type ItemType = 'arme' | 'armure' | 'potion' | 'anneau' | 'baguette' | 'bâton' | 'parchemin' | 'merveilleux'

export interface MagicItem {
  name: string
  type: ItemType
  rarity: ItemRarity
  attunement?: boolean
  description: string
}

export const MAGIC_ITEMS: MagicItem[] = [
  // Potions
  { name: 'Potion de soin', type: 'potion', rarity: 'commun', description: 'Rend 2d4+2 PV.' },
  { name: 'Potion de soin supérieure', type: 'potion', rarity: 'peu commun', description: 'Rend 4d4+4 PV.' },
  { name: 'Potion de soin suprême', type: 'potion', rarity: 'rare', description: 'Rend 8d4+8 PV.' },
  { name: 'Potion de soin légendaire', type: 'potion', rarity: 'très rare', description: 'Rend 10d4+20 PV.' },
  { name: 'Potion de force géante (Colline)', type: 'potion', rarity: 'peu commun', description: 'FOR 21 pendant 1 heure.' },
  { name: 'Potion de force géante (Pierre)', type: 'potion', rarity: 'rare', description: 'FOR 23 pendant 1 heure.' },
  { name: 'Potion de force géante (Feu)', type: 'potion', rarity: 'rare', description: 'FOR 25 pendant 1 heure.' },
  { name: 'Potion de force géante (Givre)', type: 'potion', rarity: 'rare', description: 'FOR 23 pendant 1 heure.' },
  { name: 'Potion de force géante (Nuage)', type: 'potion', rarity: 'très rare', description: 'FOR 27 pendant 1 heure.' },
  { name: 'Potion de force géante (Tempête)', type: 'potion', rarity: 'légendaire', description: 'FOR 29 pendant 1 heure.' },
  { name: 'Potion d\'invulnérabilité', type: 'potion', rarity: 'rare', description: 'Résistance à tous les dégâts pendant 1 heure.' },
  { name: 'Potion de rapidité', type: 'potion', rarity: 'très rare', description: 'Effet de Hâte pendant 1 heure.' },
  { name: 'Potion de vol', type: 'potion', rarity: 'très rare', description: 'Vitesse de vol de 18 m pendant 1 heure.' },
  { name: 'Potion d\'invisibilité', type: 'potion', rarity: 'très rare', description: 'Invisibilité pendant 1 heure.' },
  { name: 'Potion de souffle de feu', type: 'potion', rarity: 'peu commun', description: 'Souffler du feu (3d6) jusqu\'à 3 fois pendant 1 heure.' },
  { name: 'Potion de résistance', type: 'potion', rarity: 'peu commun', description: 'Résistance à un type de dégâts pendant 1 heure.' },
  { name: 'Potion de taille de géant', type: 'potion', rarity: 'peu commun', description: 'Taille Grande pendant 10 minutes.' },

  // Armes
  { name: 'Arme +1', type: 'arme', rarity: 'peu commun', description: '+1 aux jets d\'attaque et de dégâts.' },
  { name: 'Arme +2', type: 'arme', rarity: 'rare', description: '+2 aux jets d\'attaque et de dégâts.' },
  { name: 'Arme +3', type: 'arme', rarity: 'très rare', description: '+3 aux jets d\'attaque et de dégâts.' },
  { name: 'Épée vorpale', type: 'arme', rarity: 'légendaire', attunement: true, description: '+3, tranche la tête sur un 20 naturel.' },
  { name: 'Lame porte-bonheur', type: 'arme', rarity: 'légendaire', attunement: true, description: '+3, ajoute +1d4 aux attaques, dégâts et jets de sauvegarde.' },
  { name: 'Épée dansante', type: 'arme', rarity: 'très rare', attunement: true, description: '+3, peut se battre seule (action bonus).' },
  { name: 'Épée acérée', type: 'arme', rarity: 'rare', attunement: true, description: '+1, inflige des dégâts maximaux sur un 20 naturel.' },
  { name: 'Épée solaire', type: 'arme', rarity: 'rare', attunement: true, description: '+2 contre les morts-vivants et les fées, émet de la lumière solaire.' },
  { name: 'Marteau du tonnerre', type: 'arme', rarity: 'légendaire', attunement: true, description: '+3 contre les géants, peut être lancé et revient, effets spéciaux.' },

  // Armures
  { name: 'Armure +1', type: 'armure', rarity: 'rare', description: '+1 à la CA.' },
  { name: 'Armure +2', type: 'armure', rarity: 'très rare', description: '+2 à la CA.' },
  { name: 'Armure +3', type: 'armure', rarity: 'légendaire', description: '+3 à la CA.' },
  { name: 'Armure d\'écailles de dragon', type: 'armure', rarity: 'rare', attunement: true, description: 'CA 13+DEX, résistance à un type de souffle draconique.' },
  { name: 'Armure éthérée', type: 'armure', rarity: 'légendaire', attunement: true, description: 'CA 13+DEX, peut se déplacer à travers les créatures et objets.' },
  { name: 'Armure de vulnérabilité', type: 'armure', rarity: 'rare', attunement: true, description: 'CA 19, résistance à deux types de dégâts, vulnérabilité au troisième.' },
  { name: 'Mithral (armure)', type: 'armure', rarity: 'peu commun', description: 'N\'impose pas de désavantage aux jets de Discrétion, retire la condition de porteur non entraîné.' },
  { name: 'Adamantium (armure)', type: 'armure', rarity: 'peu commun', description: 'Les coups critiques deviennent des coups normaux contre vous.' },

  // Anneaux
  { name: 'Anneau de protection', type: 'anneau', rarity: 'rare', attunement: true, description: '+1 à la CA et aux jets de sauvegarde.' },
  { name: 'Anneau de résistance aux sorts', type: 'anneau', rarity: 'rare', attunement: true, description: 'Avantage aux jets de sauvegarde contre les sorts.' },
  { name: 'Anneau d\'invisibilité', type: 'anneau', rarity: 'légendaire', attunement: true, description: 'Devient invisible à volonté.' },
  { name: 'Anneau de sauvetage', type: 'anneau', rarity: 'rare', attunement: true, description: 'Retombe à 1 PV à la mort, se détruit ensuite.' },
  { name: 'Anneau de nage', type: 'anneau', rarity: 'peu commun', description: 'Vitesse de nage 40 m.' },
  { name: 'Anneau de légèreté', type: 'anneau', rarity: 'peu commun', description: 'Chute de plume, nage à 12 m.' },
  { name: 'Anneau de convocation de djinni', type: 'anneau', rarity: 'légendaire', attunement: true, description: 'Permet de convoquer un djinni.' },

  // Baguettes
  { name: 'Baguette de boules de feu', type: 'baguette', rarity: 'rare', attunement: true, description: '7 charges, boule de feu 8d6 (CD 15).' },
  { name: 'Baguette de paralysie', type: 'baguette', rarity: 'rare', attunement: true, description: '7 charges, paralysie pendant 1 minute (CD 15).' },
  { name: 'Baguette de projectiles magiques', type: 'baguette', rarity: 'peu commun', description: '7 charges, Missiles magiques.' },
  { name: 'Baguette du mage de guerre +1', type: 'baguette', rarity: 'peu commun', attunement: true, description: '+1 aux jets d\'attaque de sorts.' },
  { name: 'Baguette du mage de guerre +2', type: 'baguette', rarity: 'rare', attunement: true, description: '+2 aux jets d\'attaque de sorts.' },
  { name: 'Baguette du mage de guerre +3', type: 'baguette', rarity: 'très rare', attunement: true, description: '+3 aux jets d\'attaque de sorts.' },
  { name: 'Baguette de détection', type: 'baguette', rarity: 'peu commun', description: '3 charges, Détection de la magie.' },
  { name: 'Baguette de métamorphose', type: 'baguette', rarity: 'très rare', attunement: true, description: '7 charges, effets de métamorphose.' },

  // Objets merveilleux
  { name: 'Cape de protection', type: 'merveilleux', rarity: 'peu commun', attunement: true, description: '+1 à la CA et aux jets de sauvegarde.' },
  { name: 'Bottes de l\'elfe', type: 'merveilleux', rarity: 'peu commun', attunement: true, description: 'Déplacement silencieux, ne laisse pas de traces.' },
  { name: 'Bottes de vitesse', type: 'merveilleux', rarity: 'rare', attunement: true, description: 'Double la vitesse, peut utiliser une action bonus pour "dash".' },
  { name: 'Cape de déplacement', type: 'merveilleux', rarity: 'rare', attunement: true, description: 'Avantage aux jets de sauvegarde, les attaquants ont désavantage.' },
  { name: 'Amulette de santé', type: 'merveilleux', rarity: 'rare', attunement: true, description: 'CON à 19.' },
  { name: 'Ceinturon de vigueur', type: 'merveilleux', rarity: 'rare', attunement: true, description: 'FOR à 21.' },
  { name: 'Bandeau d\'intelligence', type: 'merveilleux', rarity: 'peu commun', attunement: true, description: 'INT à 19.' },
  { name: 'Diadème de la sagesse', type: 'merveilleux', rarity: 'peu commun', attunement: true, description: 'SAG à 19.' },
  { name: 'Sac sans fond', type: 'merveilleux', rarity: 'peu commun', description: 'Peut contenir jusqu\'à 500 kg sur un espace de 2 m³.' },
  { name: 'Cape de l\'araignée', type: 'merveilleux', rarity: 'rare', attunement: true, description: 'Peut escalader à vitesse normale, marcher aux plafonds.' },
  { name: 'Gants de natation et d\'escalade', type: 'merveilleux', rarity: 'peu commun', attunement: true, description: 'Vitesse de nage et d\'escalade 30 m.' },
  { name: 'Lunettes de nuit', type: 'merveilleux', rarity: 'peu commun', description: 'Vision dans le noir 60 m.' },
  { name: 'Carquois efficace', type: 'merveilleux', rarity: 'peu commun', description: 'Sort Carquois enchanté : stocke flèches, carreaux et javelines.' },
  { name: 'Pierre de chance', type: 'merveilleux', rarity: 'peu commun', attunement: true, description: '3 charges/jour, +1 aux jets d\'attaque, compétence et sauvegardes.' },
  { name: 'Torche éternelle', type: 'merveilleux', rarity: 'commun', description: 'Émet de la lumière en permanence sans consommer de ressources.' },
  { name: 'Corde d\'enchevêtrement', type: 'merveilleux', rarity: 'rare', description: '30 m de corde animée, peut ligoter des créatures.' },
  { name: 'Heaume de compréhension des langues', type: 'merveilleux', rarity: 'peu commun', description: 'Comprend toutes les langues parlées et écrites.' },
  { name: 'Cor de destruction', type: 'merveilleux', rarity: 'rare', description: '5 charges, souffle de vent violent, 5d4+5 dégâts aux structures.' },
  { name: 'Médaillon de pensées', type: 'merveilleux', rarity: 'peu commun', attunement: true, description: '3 charges/jour, Détection des pensées (CD 13).' },

  // Bâtons
  { name: 'Bâton des forêts', type: 'bâton', rarity: 'rare', attunement: true, description: '10 charges, sorts druidiques variés.' },
  { name: 'Bâton du grand mage', type: 'bâton', rarity: 'légendaire', attunement: true, description: '+2 aux sorts, 50 charges, puissants sorts d\'évocation.' },
  { name: 'Bâton de guérison', type: 'bâton', rarity: 'rare', attunement: true, description: '10 charges, sorts de guérison variés.' },
  { name: 'Bâton du python', type: 'bâton', rarity: 'peu commun', attunement: true, description: 'Se transforme en grand serpent constricteur au commandement.' },
]
