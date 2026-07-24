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

const NAMES: Record<string, { m: string[]; f: string[] }> = {
  Humain: {
    m: ['Aldric', 'Beren', 'Calder', 'Doran', 'Edric', 'Farek', 'Garet', 'Hamal', 'Ivar', 'Jorin', 'Keldyn', 'Lorin', 'Marek', 'Norvin', 'Osric', 'Peran', 'Rodyn', 'Soran', 'Taren', 'Ulric', 'Varyn', 'Westan', 'Xander', 'Yoric', 'Zorin'],
    f: ['Aelys', 'Brynn', 'Calia', 'Dara', 'Elara', 'Fern', 'Gilda', 'Hana', 'Isra', 'Jora', 'Kira', 'Lyra', 'Mira', 'Nara', 'Odra', 'Petra', 'Rael', 'Sela', 'Tara', 'Ursa', 'Vela', 'Wren', 'Xyla', 'Yara', 'Zora'],
  },
  Elfe: {
    m: ['Aelar', 'Caelum', 'Erevan', 'Faenor', 'Galindel', 'Hadarai', 'Immeral', 'Jelenneth', 'Keleneth', 'Laucian', 'Mindartis', 'Naeris', 'Orym', 'Paelias', 'Quarion', 'Riardon', 'Soveliss', 'Thamior', 'Varis', 'Zephyros'],
    f: ['Adrie', 'Birel', 'Caelynn', 'Dara', 'Enna', 'Faral', 'Gennal', 'Halia', 'Irann', 'Keyla', 'Leshanna', 'Mialee', 'Naivara', 'Quelenna', 'Raven', 'Sariel', 'Thia', 'Vadania', 'Valanthe', 'Xanaphia'],
  },
  Nain: {
    m: ['Adrik', 'Alberich', 'Baern', 'Barendd', 'Brottor', 'Bruenor', 'Dain', 'Darrak', 'Delg', 'Eberk', 'Einkil', 'Fargrim', 'Flint', 'Gardain', 'Harbek', 'Kildrak', 'Morgran', 'Orsik', 'Oskar', 'Rangrim', 'Rurik', 'Taklinn', 'Thoradin', 'Thorin', 'Tordek', 'Traubon', 'Travok', 'Ulfgar', 'Veit', 'Vondal'],
    f: ['Amber', 'Artin', 'Audhild', 'Bardryn', 'Dagnal', 'Diesa', 'Eldeth', 'Falkrunn', 'Finellen', 'Gunnloda', 'Gurdis', 'Helja', 'Hlin', 'Kathra', 'Kristryd', 'Mardred', 'Riswynn', 'Sannl', 'Torbera', 'Torgga', 'Vistra'],
  },
  Halfelin: {
    m: ['Alton', 'Ander', 'Cade', 'Corrin', 'Eldon', 'Errich', 'Finnan', 'Garret', 'Lindal', 'Lyle', 'Merric', 'Milo', 'Osborn', 'Perrin', 'Reed', 'Roscoe', 'Wellby'],
    f: ['Andry', 'Bree', 'Callie', 'Cora', 'Euphemia', 'Jillian', 'Kithri', 'Lavinia', 'Lidda', 'Merla', 'Nedda', 'Paela', 'Portia', 'Seraphina', 'Shaena', 'Trym', 'Vani', 'Verna'],
  },
  Gnome: {
    m: ['Alston', 'Alvyn', 'Boddynock', 'Brocc', 'Burgell', 'Dimble', 'Eldon', 'Erky', 'Fonkin', 'Frug', 'Gerbo', 'Gimble', 'Glim', 'Jebeddo', 'Kellen', 'Namfoodle', 'Orryn', 'Roondar', 'Seebo', 'Sindri', 'Warryn', 'Wurp', 'Zook'],
    f: ['Bimpnottin', 'Breena', 'Caramip', 'Carlin', 'Donella', 'Duvamil', 'Ella', 'Ellyjobell', 'Ellywick', 'Lilli', 'Loopmottin', 'Lorilla', 'Mardnab', 'Nissa', 'Nyx', 'Oda', 'Orla', 'Roywyn', 'Shamil', 'Tana', 'Waywocket', 'Zanna'],
  },
  'Demi-elfe': {
    m: ['Alas', 'Brynn', 'Cedric', 'Dalen', 'Eiren', 'Farek', 'Galan', 'Haren', 'Ivan', 'Jared', 'Kael', 'Lerin', 'Maron', 'Naren', 'Orin', 'Peren'],
    f: ['Adrie', 'Brena', 'Calla', 'Daera', 'Elowyn', 'Faerel', 'Gara', 'Helan', 'Ilia', 'Jana', 'Kira', 'Lira', 'Mara', 'Nira', 'Orla', 'Peria'],
  },
  'Demi-orque': {
    m: ['Dench', 'Feng', 'Gell', 'Henk', 'Holg', 'Imsh', 'Keth', 'Krusk', 'Mhurren', 'Ront', 'Shump', 'Thokk'],
    f: ['Baggi', 'Emen', 'Engong', 'Kansif', 'Myev', 'Neega', 'Ovak', 'Ownka', 'Shautha', 'Sutha', 'Vola', 'Volen', 'Yevelda'],
  },
  Tiefelin: {
    m: ['Akmenos', 'Amnon', 'Barakas', 'Damakos', 'Ekemon', 'Iados', 'Kairon', 'Leucis', 'Melech', 'Mordai', 'Morthos', 'Pelaios', 'Skamos', 'Therai'],
    f: ['Akta', 'Anakis', 'Bryseis', 'Criella', 'Damaia', 'Ea', 'Kallista', 'Lerissa', 'Makaria', 'Nemeia', 'Orianna', 'Phelaia', 'Rieta'],
  },
  Draconique: {
    m: ['Arjhan', 'Balasar', 'Bharash', 'Donaar', 'Ghesh', 'Heskan', 'Kriv', 'Medrash', 'Mehen', 'Nadarr', 'Pandjed', 'Patrin', 'Rhogar', 'Shamash', 'Shedinn', 'Tarhun', 'Torinn'],
    f: ['Akra', 'Biri', 'Daar', 'Farideh', 'Harann', 'Havilar', 'Jheri', 'Kava', 'Korinn', 'Mishann', 'Nala', 'Perra', 'Raiann', 'Sora', 'Surina', 'Thava', 'Uadjit'],
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
  const appearance = `${pick(BUILD)}, ${pick(HAIR)}, ${pick(EYES)}. ${pick(DISTINCTIVE).charAt(0).toUpperCase() + pick(DISTINCTIVE).slice(1)}.`
  const personality = pick(TRAITS)
  const bond = pick(BONDS)
  const flaw = pick(FLAWS)
  const voice = pick(VOICES)
  return { name, race, gender, profession, appearance, personality, bond, flaw, voice }
}
