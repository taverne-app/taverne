export interface GeneratedNpc {
  name: string
  race: string
  gender: string
  profession: string
  appearance: string
  personality: string
  bond: string
  flaw: string
  voice: string
}

const RACES = ['Humain', 'Elfe', 'Nain', 'Halfelin', 'Gnome', 'Demi-elfe', 'Demi-orque', 'Tiefelin', 'Draconique']

// Ces listes sont bâties sur de l'onomastique historique réelle (domaine public),
// une aire linguistique par race : franc/médiéval, gallois, vieux norrois, anglais
// rural, slave occidental, breton, turco-mongol, grec byzantin, persan.
// Ne JAMAIS y recopier une table de noms d'un manuel : le SRD 5.1 n'en contient
// aucune, elles ne sont donc pas couvertes par la licence CC BY qu'annonce LICENSE.
const NAMES: Record<string, { m: string[]; f: string[] }> = {
  Humain: {
    m: ['Thibaut', 'Gauvain', 'Renaud', 'Foulques', 'Amaury', 'Bertran', 'Guiral', 'Enguerrand', 'Aymeric', 'Baudouin', 'Clovis', 'Eudes', 'Gontran', 'Hervé', 'Jocelin', 'Lambert', 'Mainard', 'Odilon', 'Perceval', 'Raoul', 'Sévrin', 'Tancrède', 'Vivien', 'Wandrille', 'Yvon'],
    f: ['Aliénor', 'Berthe', 'Clémence', 'Douce', 'Ermengarde', 'Flore', 'Guiburc', 'Héloïse', 'Isabeau', 'Jehanne', 'Laurence', 'Mahaut', 'Nicolette', 'Oriane', 'Perrine', 'Radegonde', 'Sibylle', 'Tiphaine', 'Ursule', 'Viviane', 'Ysolde', 'Adelis', 'Blanchefleur', 'Emeline', 'Garsende'],
  },
  Elfe: {
    m: ['Aneurin', 'Bleddyn', 'Caradoc', 'Elidir', 'Gwalchmai', 'Idris', 'Llywel', 'Maredudd', 'Nudd', 'Owain', 'Rhydderch', 'Sulien', 'Taliesin', 'Urien', 'Yestin', 'Cadfael', 'Deiniol', 'Emrys', 'Gwynfor', 'Iolo'],
    f: ['Aderyn', 'Blodwen', 'Ceridwen', 'Delyth', 'Eluned', 'Ffion', 'Gwenllian', 'Heulwen', 'Iona', 'Meinir', 'Nesta', 'Olwen', 'Rhiannon', 'Seren', 'Tegwen', 'Wynne', 'Arianwen', 'Briallen', 'Enid', 'Morwenna'],
  },
  Nain: {
    m: ['Arnvid', 'Bersi', 'Dagfinn', 'Eyvind', 'Folkvar', 'Grimkel', 'Halvard', 'Ingvar', 'Jorund', 'Kolbein', 'Ludin', 'Magnvald', 'Njal', 'Ottar', 'Ragnvald', 'Sigvard', 'Thrand', 'Ulfar', 'Vermund', 'Yngvar', 'Bardi', 'Hrolf', 'Skapti', 'Torfinn', 'Gudbrand', 'Hallgrim', 'Ozur', 'Sturla', 'Vigfus', 'Asgeir'],
    f: ['Asta', 'Bergljot', 'Dagny', 'Eir', 'Frida', 'Gudrun', 'Halldis', 'Ingebjorg', 'Jorunn', 'Katla', 'Ljufa', 'Ragnhild', 'Sigrun', 'Solveig', 'Thordis', 'Unnur', 'Valdis', 'Yrsa', 'Astrid', 'Groa', 'Herdis'],
  },
  Halfelin: {
    m: ['Ambrose', 'Barnaby', 'Cobb', 'Dillon', 'Emory', 'Fenwick', 'Hollis', 'Jasper', 'Marlow', 'Orson', 'Quillon', 'Rowan', 'Sylvan', 'Tobias', 'Willem', 'Yarrow', 'Nolan'],
    f: ['Amity', 'Briar', 'Clover', 'Daisy', 'Elowen', 'Fennel', 'Gilly', 'Hazel', 'Ivy', 'Juniper', 'Linnet', 'Mabel', 'Nettle', 'Opal', 'Poppy', 'Rosalind', 'Tansy', 'Willa'],
  },
  Gnome: {
    m: ['Bogdan', 'Cvetko', 'Dobrik', 'Fedko', 'Gostko', 'Hodek', 'Ivko', 'Jarek', 'Kuzma', 'Lubko', 'Milko', 'Nedko', 'Ondrek', 'Pavko', 'Radko', 'Stanko', 'Tomko', 'Vitko', 'Zdenko', 'Branko', 'Danko', 'Lesko', 'Mirko'],
    f: ['Bogna', 'Cvetka', 'Dobrava', 'Fenka', 'Goldana', 'Hedvika', 'Ivka', 'Jarka', 'Kalina', 'Ludmila', 'Milena', 'Nedka', 'Olenka', 'Petka', 'Radka', 'Slavka', 'Toska', 'Vesna', 'Zlata', 'Branka', 'Danica', 'Lesna'],
  },
  'Demi-elfe': {
    m: ['Aurel', 'Brennan', 'Cadwal', 'Doryan', 'Emrik', 'Fintan', 'Gaelan', 'Hywel', 'Ilan', 'Joran', 'Kerrin', 'Lucan', 'Merrick', 'Nevyn', 'Orvyn', 'Tristan'],
    f: ['Aeline', 'Bryluen', 'Carys', 'Delwyn', 'Elinor', 'Faelis', 'Gwenaig', 'Hesper', 'Ilwen', 'Jocelyne', 'Kerensa', 'Lowena', 'Melisande', 'Nolwenn', 'Orlaith', 'Sabine'],
  },
  'Demi-orque': {
    m: ['Bataar', 'Churek', 'Dorgo', 'Erkhen', 'Gorkha', 'Hulgan', 'Karguz', 'Mongke', 'Nogai', 'Sartaq', 'Temur', 'Yesun'],
    f: ['Alagh', 'Borte', 'Chagan', 'Eshi', 'Gerel', 'Khulan', 'Munkha', 'Oyuun', 'Sarnai', 'Tselmeg', 'Uyanga', 'Yalta', 'Zolzaya'],
  },
  Tiefelin: {
    m: ['Anthemios', 'Balthios', 'Cyriakos', 'Doriphos', 'Elpidios', 'Hyrkanos', 'Kaleb', 'Lysandros', 'Menachem', 'Nikanor', 'Ozias', 'Phineas', 'Symeon', 'Tharsis'],
    f: ['Amissa', 'Berenike', 'Chrysanthe', 'Doriane', 'Elissa', 'Hekabe', 'Ioanna', 'Kassandre', 'Melitene', 'Nephele', 'Ourania', 'Photine', 'Thaleia'],
  },
  Draconique: {
    m: ['Arvand', 'Bahman', 'Dariush', 'Esfandiar', 'Faramarz', 'Goshtasp', 'Hushang', 'Iraj', 'Kavus', 'Manuchehr', 'Nariman', 'Piran', 'Rostam', 'Sohrab', 'Tahmuras', 'Vahram', 'Zarir'],
    f: ['Arnavaz', 'Banu', 'Dinaz', 'Farangis', 'Golnar', 'Homai', 'Katayoun', 'Manizheh', 'Nahid', 'Parisa', 'Rudabeh', 'Shirin', 'Tahmineh', 'Vashti', 'Yasna', 'Zarrin', 'Anahita'],
  },
}

const PROFESSIONS = [
  'marchand de tissus', 'forgeron', 'aubergiste', 'fermier', 'pêcheur', 'boulanger',
  'tailleur', 'apothicaire', 'bibliothécaire', 'cordonnier', 'charpentier', 'maçon',
  'chasseur', 'garde de la ville', 'messager', 'maquignon', 'orfèvre', 'tanneur',
  'potier', 'tisserand', 'clerc d\'un temple', 'scribe', 'cuisinier de taverne',
  'collecteur de taxes', 'ancien du village', 'capitaine de la milice locale',
  'herboriste', 'marin retraité', 'mendiant philosophe', 'éclaireur forestier',
  'prêteur sur gages', 'passeur de rivière', 'maître d\'école', 'horloger',
]

const HAIR = [
  'cheveux noirs et courts', 'chevelure rousse bouclée', 'cheveux gris tressés',
  'crâne rasé avec une cicatrice', 'longs cheveux blancs soyeux', 'cheveux bruns et gras',
  'tignasse blonde ébouriffée', 'chignon de cheveux châtains', 'dreadlocks noires',
  'nuque rasée et couronne de boucles noires', 'cheveux cuivrés et lisses',
  'mèches grises dans des cheveux noirs', 'coupe soignée châtain clair',
]

const EYES = [
  'yeux verts perçants', 'yeux bruns chaleureux', 'yeux gris acier froids',
  'yeux bleus enfoncés', 'regard noisette distrait', 'un œil marron, un œil vert',
  'yeux noirs profonds', 'yeux dorés inhabituels', 'pupilles fendues comme un chat',
  'regard violet énigmatique', 'yeux fatigués cerclés de rouge',
]

const BUILD = [
  'corpulence robuste et musclée', 'silhouette élancée et gracieuse',
  'carrure imposante voûtée par les années', 'taille petite mais nerveuse',
  'embonpoint confortable', 'corps sec et noueux', 'grande taille dégingandée',
  'stature moyenne et ordinaire',
]

const DISTINCTIVE = [
  'une cicatrice en travers du nez', 'un tatouage de serpent sur l\'avant-bras',
  'une oreille manquante', 'des mains constamment tachées d\'encre',
  'une démarche claudicante prononcée', 'des bagues à chaque doigt',
  'un tic de cligner de l\'œil droit', 'une barbe soigneusement tressée',
  'porte toujours un vieux chapeau défraîchi', 'une voix qui craque sous l\'émotion',
  'sourit en montrant une dent en or', 'tourne sans cesse une pièce de monnaie',
  'fait craquer ses articulations quand il réfléchit', 'a l\'habitude de renifler bruyamment',
  'garde les yeux mi-clos comme s\'il dormait', 'des veines visibles sur les tempes',
]

const TRAITS = [
  'jovial et extraverti, parle à tout le monde', 'méfiant et calculateur, observe avant d\'agir',
  'curieux insatiable, pose des questions sans fin', 'pragmatique et direct, sans fioritures',
  'nostalgique, ramène tout à son passé', 'anxieux, anticipe le pire en permanence',
  'fier et sûr de lui jusqu\'à l\'arrogance', 'humble et réservé, préfère écouter',
  'cynique, ne croit plus à grand-chose', 'idéaliste, voit le bon en chacun',
  'ironique et sarcastique mais bienveillant', 'obsessionnel, fixé sur un seul sujet',
  'généreux à l\'excès avec ses ressources', 'avide de ragots et de nouvelles',
]

const BONDS = [
  'loyal envers sa famille par-dessus tout', 'doit une dette de vie à un inconnu',
  'cherche à retrouver un objet volé par le passé', 'protège secrètement quelqu\'un de vulnérable',
  'vénère un mentor disparu depuis longtemps', 'souhaite réparer une injustice passée',
  'épargne pour racheter la liberté d\'un proche', 'garde un secret honteux sur sa ville natale',
  'dévoué à sa guilde ou son ordre', 'rêve de quitter cette vie pour une autre',
]

const FLAWS = [
  'incapable de résister à l\'alcool', 'ment instinctivement, même sans raison',
  'perd ses moyens face aux nobles ou à l\'autorité', 'avide, jamais assez d\'argent',
  'rancunier, n\'oublie jamais un affront', 'peureux, évite tout conflit physique',
  'maniaque de l\'ordre jusqu\'à la paralysie', 'cède aux plaisirs de la chair ou du jeu',
  'susceptible, prend tout commentaire pour une attaque', 'paresseux quand personne ne regarde',
]

const VOICES = [
  'voix grave et posée, chaque mot pesé', 'parle très vite en gesticulant',
  'chuchote presque en permanence, force l\'écoute', 'rit nerveusement entre les phrases',
  'coupe sans cesse ses interlocuteurs', 'utilise des proverbes à tout va',
  'accent de province prononcé', 'voix haut perchée en décalage avec sa carrure',
  'prononce les mots comme s\'il les dégustait', 'marque de longues pauses avant de répondre',
  'répète la fin des phrases en écho', 'tutoie tout le monde d\'emblée',
  'formule sèche, dix mots quand cent suffiraient', 'exagère tout avec des superlatifs',
]

export const NPC_RACES = Object.keys(NAMES)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateNpcName(race?: string, gender?: 'Homme' | 'Femme'): string {
  const r = race && NAMES[race] ? race : pick(NPC_RACES)
  const g = gender ?? (Math.random() < 0.5 ? 'Homme' : 'Femme')
  const pool = NAMES[r]
  return pick(g === 'Homme' ? pool.m : pool.f)
}

export function generateNpc(): GeneratedNpc {
  const race = pick(RACES)
  const gender = Math.random() < 0.5 ? 'Homme' : 'Femme'
  const namePool = NAMES[race] ?? NAMES['Humain']
  const name = pick(gender === 'Homme' ? namePool.m : namePool.f)
  const profession = pick(PROFESSIONS)
  const distinctive = pick(DISTINCTIVE)
  const appearance = `${pick(BUILD)}, ${pick(HAIR)}, ${pick(EYES)}. ${distinctive.charAt(0).toUpperCase() + distinctive.slice(1)}.`
  const personality = pick(TRAITS)
  const bond = pick(BONDS)
  const flaw = pick(FLAWS)
  const voice = pick(VOICES)
  return { name, race, gender, profession, appearance, personality, bond, flaw, voice }
}
