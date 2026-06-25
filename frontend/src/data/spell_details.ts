export interface SpellDetail {
  school: string
  castingTime: string
  range: string
  components: string
  duration: string
  description: string
}

export const SPELL_DETAILS: Record<string, SpellDetail> = {
  // ── Cantrips ─────────────────────────────────────────────────────────────────
  'Aspersion acide': {
    school: 'Invocation', castingTime: '1 action', range: '18 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Projetez une sphère d\'acide sur une ou deux créatures adjacentes. Chacune effectue un jet de DEX DC égal à votre DC de sort ou subit 1d6 dégâts d\'acide. Les dégâts augmentent à 2d6 (niv. 5), 3d6 (niv. 11), 4d6 (niv. 17).',
  },
  'Contact glacial': {
    school: 'Nécromancie', castingTime: '1 action', range: '36 m',
    components: 'V, S', duration: '1 round',
    description: 'Invoquez une main spectrale qui agrippe la cible. Jet d\'attaque de sort à distance : 1d8 dégâts nécrotiques, et la cible ne peut regagner de PV jusqu\'à votre prochain tour. Mort-vivants : désavantage aux attaques jusqu\'à votre prochain tour. Dégâts : 2d8 (niv. 5), 3d8 (niv. 11), 4d8 (niv. 17).',
  },
  'Lumières dansantes': {
    school: 'Évocation', castingTime: '1 action', range: '36 m',
    components: 'V, S, M (bout de phosphore)', duration: 'Concentration, 1 min',
    description: 'Créez jusqu\'à 4 lumières de la taille d\'une torche dans un rayon de 6 m. Chaque lumière illumine un cercle de 3 m de lumière vive et 3 m de faible lumière. Déplacez-les jusqu\'à 18 m par action bonus.',
  },
  'Trait de feu': {
    school: 'Évocation', castingTime: '1 action', range: '36 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Jet d\'attaque de sort à distance : 1d10 dégâts de feu. Avantage contre les créatures portant une armure métallique. Dégâts : 2d10 (niv. 5), 3d10 (niv. 11), 4d10 (niv. 17).',
  },
  'Guidance': {
    school: 'Divination', castingTime: '1 action', range: 'Contact',
    components: 'V, S', duration: 'Concentration, 1 min',
    description: 'Touchez une créature consentante. Une fois avant la fin du sort, la cible peut ajouter 1d4 au résultat d\'un test de caractéristique.',
  },
  'Lumière': {
    school: 'Évocation', castingTime: '1 action', range: 'Contact',
    components: 'V, M (ver luisant)', duration: '1 heure',
    description: 'Un objet ne dépassant pas 3 m brille d\'une lumière vive dans un rayon de 6 m et d\'une faible lumière sur 6 m supplémentaires. Si une créature hostile tient l\'objet, elle effectue un jet de DEX (DC de sort) ou le sort échoue.',
  },
  'Main de mage': {
    school: 'Invocation', castingTime: '1 action', range: '9 m',
    components: 'V, S', duration: '1 min',
    description: 'Créez une main spectrale flottante. Elle peut saisir des objets ≤ 5 kg, ouvrir des portes et contenants, récupérer des objets, ou verser le contenu de fioles. Elle ne peut pas attaquer ni utiliser des objets magiques.',
  },
  'Réparation': {
    school: 'Transmutation', castingTime: '1 minute', range: 'Contact',
    components: 'V, S, M (deux aimants)', duration: 'Instantanée',
    description: 'Réparez une cassure ou déchirure dans un objet (une fissure dans une gemme, une charnière brisée). Dommages pas plus grands qu\'une fissure réparable en 1 minute.',
  },
  'Message': {
    school: 'Transmutation', castingTime: '1 action', range: '36 m',
    components: 'V, S, M (fil de cuivre)', duration: '1 round',
    description: 'Pointez une créature à portée et murmurez un message. La cible l\'entend et peut répondre en chuchotant ; seul vous entendez la réponse. Sort utilisable à travers des objets solides avec suffisamment de substance.',
  },
  'Illusion mineure': {
    school: 'Illusion', castingTime: '1 action', range: '9 m',
    components: 'S, M (un flocon de laine)', duration: '1 min',
    description: 'Créez un son ou une image dans un cube de 1,50 m. Un son peut être aussi discret qu\'un murmure ou aussi fort qu\'un cri. Une image ne produit pas de son. Tout examen physique révèle l\'illusion.',
  },
  'Jet de poison': {
    school: 'Invocation', castingTime: '1 action', range: '9 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Projetez un jet de venin verdâtre. Jet de CON (DC de sort) ou 1d12 dégâts de poison. Dégâts : 2d12 (niv. 5), 3d12 (niv. 11), 4d12 (niv. 17).',
  },
  'Prestidigitation': {
    school: 'Transmutation', castingTime: '1 action', range: '3 m',
    components: 'V, S', duration: 'Jusqu\'à 1 heure',
    description: 'Créez un effet magique mineur : une sensation sensorielle, un feu inoffensif, nettoyez/salissez un objet de 30 cm cube, refroidissez/chauffez 500 g de matière non vivante, créez une marque ou symbole, ou créez une babiole non magique.',
  },
  'Flamme sacrée': {
    school: 'Évocation', castingTime: '1 action', range: '18 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Une flamme descend sur la cible. Jet de DEX (DC de sort) ou 1d8 dégâts radiants. Aucun couvert ne protège contre ce sort. Dégâts : 2d8 (niv. 5), 3d8 (niv. 11), 4d8 (niv. 17).',
  },
  'Décharge électrique': {
    school: 'Évocation', castingTime: '1 action', range: '9 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Un éclair jaillit de votre doigt. Jet d\'attaque de sort à distance : 1d8 dégâts de foudre. Dégâts : 2d8 (niv. 5), 3d8 (niv. 11), 4d8 (niv. 17).',
  },
  'Épargner les mourants': {
    school: 'Nécromancie', castingTime: '1 action', range: 'Contact',
    components: 'V, S', duration: 'Instantanée',
    description: 'Touchez une créature à 0 PV. Elle devient stable. N\'a aucun effet sur les morts-vivants et les artificiels.',
  },
  'Thaumaturgie': {
    school: 'Transmutation', castingTime: '1 action', range: '9 m',
    components: 'V', duration: 'Jusqu\'à 1 min',
    description: 'Manifestez un prodige mineur : votre voix tonne, des flammes vacillent, tremblement de terre, yeux qui luisent, portes qui s\'ouvrent ou se ferment, ou changement de couleur temporaire. Jusqu\'à 3 effets simultanément.',
  },
  'Lame de tonnerre': {
    school: 'Évocation', castingTime: '1 action', range: 'Personnelle (rayon 1,50 m)',
    components: 'V, S', duration: 'Instantanée',
    description: 'Une vague de force tonique jaillit de vous. Les créatures dans un rayon de 1,50 m effectuent un jet de CON (DC de sort) : subissent 1d6 dégâts de tonnerre et sont repoussées de 3 m (échec) ou la moitié des dégâts sans mouvement (succès). Son entendu à 90 m. Dégâts : 2d6 (niv. 5), 3d6 (niv. 11), 4d6 (niv. 17).',
  },
  'Trait de givre': {
    school: 'Évocation', castingTime: '1 action', range: '18 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Jet d\'attaque de sort à distance : 1d8 dégâts de froid, et la cible ne peut faire de réaction jusqu\'à votre prochain tour. Dégâts : 2d8 (niv. 5), 3d8 (niv. 11), 4d8 (niv. 17).',
  },
  'Résistance': {
    school: 'Abjuration', castingTime: '1 action', range: 'Contact',
    components: 'V, S, M (cape miniature)', duration: 'Concentration, 1 min',
    description: 'Touchez une créature consentante. Une fois avant la fin du sort, lancez un d4 et ajoutez le résultat à un jet de sauvegarde.',
  },
  'Vacherie': {
    school: 'Enchantement', castingTime: '1 action', range: '18 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Attirez l\'attention d\'une créature. Elle doit réussir un jet de SAG (DC de sort) ou avoir désavantage à la prochaine attaque avant la fin de son prochain tour.',
  },
  'Vraie frappe': {
    school: 'Divination', castingTime: '1 action', range: 'Personnelle',
    components: 'S', duration: 'Concentration, 1 round',
    description: 'Vous percevez brièvement les défenses d\'une créature à portée. Lors de votre prochain tour, vous avez l\'avantage à votre premier jet d\'attaque contre la cible.',
  },
  'Infestation': {
    school: 'Invocation', castingTime: '1 action', range: '9 m',
    components: 'V, S, M (un pou vivant)', duration: 'Instantanée',
    description: 'Envoyez un nuage de mites, puces ou autres vermine sur une créature. Jet de CON (DC de sort) : 1d6 dégâts de poison et la cible se déplace de 1,50 m dans une direction aléatoire (échec). Dégâts : 2d6 (niv. 5), 3d6 (niv. 11), 4d6 (niv. 17).',
  },
  'Shillelagh': {
    school: 'Transmutation', castingTime: '1 action bonus', range: 'Personnelle',
    components: 'V, S, M (gui et feuille de houx)', duration: 'Concentration, 1 min',
    description: 'Le bois de votre club ou bâton devient enchanté. Les attaques utilisent votre modificateur de SAG au lieu de FOR, les dégâts passent à 1d8, et l\'arme est considérée magique.',
  },
  'Lame verte': {
    school: 'Transmutation', castingTime: '1 action', range: 'Personnelle (rayon 1,50 m)',
    components: 'V, M (une arme de corps à corps valant ≥ 1 pa)', duration: 'Instantanée',
    description: 'Portez une attaque de corps à corps avec l\'arme composante. Si l\'attaque touche, elle inflige les dégâts normaux plus 1d8 supplémentaires. Aux niveaux 5, 11 et 17, les dégâts bonus augmentent de 1d8 et vous pouvez cibler une seconde créature adjacente.',
  },
  'Bouffée de poison': {
    school: 'Invocation', castingTime: '1 action', range: '3 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Expirez un nuage de gaz toxique. La cible effectue un jet de CON (DC de sort) ou subit 1d12 dégâts de poison. Dégâts : 2d12 (niv. 5), 3d12 (niv. 11), 4d12 (niv. 17).',
  },
  'Produire une flamme': {
    school: 'Invocation', castingTime: '1 action', range: 'Personnelle',
    components: 'V, S', duration: '10 min',
    description: 'Une flamme apparaît dans votre main, éclairant sur 3 m (vif) et 3 m supplémentaires (faible). Elle peut être lancée (portée 9 m) : jet d\'attaque de sort à distance, 1d8 dégâts de feu. Dégâts : 2d8 (niv. 5), 3d8 (niv. 11), 4d8 (niv. 17).',
  },

  // ── Niveau 1 ─────────────────────────────────────────────────────────────────
  'Soin des blessures': {
    school: 'Évocation', castingTime: '1 action', range: 'Contact',
    components: 'V, S', duration: 'Instantanée',
    description: 'Touchez une créature qui regagne 1d8 + modificateur d\'incantation PV. Aucun effet sur les morts-vivants et les artificiels. Surincantation : +1d8 par niveau de sort au-dessus du 1er.',
  },
  'Mot de guérison': {
    school: 'Évocation', castingTime: '1 action bonus', range: '18 m',
    components: 'V', duration: 'Instantanée',
    description: 'Prononcez une parole de restauration : une créature à portée regagne 1d4 + modificateur d\'incantation PV. Aucun effet sur les morts-vivants et les artificiels. Surincantation : +1d4 par niveau au-dessus du 1er.',
  },
  'Missile magique': {
    school: 'Évocation', castingTime: '1 action', range: '36 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Créez 3 fléchettes de force magique. Chacune touche automatiquement sa cible (vous choisissez la répartition) et inflige 1d4+1 dégâts de force. Surincantation : +1 fléchette par niveau au-dessus du 1er.',
  },
  'Bouclier': {
    school: 'Abjuration', castingTime: '1 réaction', range: 'Personnelle',
    components: 'V, S', duration: '1 round',
    description: 'Déclenchée quand vous êtes touché ou ciblé par Missile magique. +5 à la CA jusqu\'au début de votre prochain tour (y compris contre l\'attaque déclenchante). Immunité à Missile magique.',
  },
  'Armure de mage': {
    school: 'Abjuration', castingTime: '1 action', range: 'Contact',
    components: 'V, S, M (morceau de cuir tanné)', duration: '8 heures',
    description: 'Touchez une créature consentante qui ne porte pas d\'armure. Sa CA de base devient 13 + modificateur de DEX. Le sort se termine si la cible enfile une armure.',
  },
  'Charme-personne': {
    school: 'Enchantement', castingTime: '1 action', range: '9 m',
    components: 'V, S', duration: '1 heure',
    description: 'Une créature humanoïde à portée effectue un jet de SAG (désavantage si en combat avec vous). En cas d\'échec, elle est charmée et vous considère comme un ami. Le sort se termine si vous ou vos alliés lui nuisez. Surincantation : +1 cible par niveau au-dessus du 1er.',
  },
  'Sommeil': {
    school: 'Enchantement', castingTime: '1 action', range: '27 m',
    components: 'V, S, M (pétales de fleur)', duration: '1 min',
    description: 'Lancez 5d8 ; les créatures dont les PV actuels sont inférieurs à ce total s\'endorment (en commençant par les plus faibles). Les morts-vivants et immunisés aux charmes ne sont pas affectés. Surincantation : +2d8 par niveau au-dessus du 1er.',
  },
  'Détection de la magie': {
    school: 'Divination', castingTime: '1 action', range: 'Personnelle (rayon 9 m)',
    components: 'V, S', duration: 'Concentration, 10 min',
    description: 'Percevez la présence de la magie à 9 m. Pouvez utiliser une action pour voir une aura dorée autour des objets et créatures magiques, et distinguer leur école. Bloqué par 30 cm de pierre, 2,5 cm de métal, 1 m de bois.',
  },
  'Mains brûlantes': {
    school: 'Évocation', castingTime: '1 action', range: 'Personnelle (cône 4,50 m)',
    components: 'V, S', duration: 'Instantanée',
    description: 'Un cône de flammes jaillit de vos mains. Jet de DEX (DC de sort) : 3d6 dégâts de feu (échec) ou la moitié (succès). Enflamme les objets inflammables non portés. Surincantation : +1d6 par niveau au-dessus du 1er.',
  },
  'Lueurs féeriques': {
    school: 'Évocation', castingTime: '1 action', range: '18 m',
    components: 'V', duration: 'Concentration, 1 min',
    description: 'Chaque objet dans un cube de 6 m brille. Toute créature dans la zone (jet de DEX DC de sort) brille aussi si elle rate. Les créatures affectées ne peuvent être invisibles ; les attaques contre elles ont l\'avantage.',
  },
  'Bénédiction': {
    school: 'Enchantement', castingTime: '1 action', range: '9 m',
    components: 'V, S, M (eau bénite)', duration: 'Concentration, 1 min',
    description: 'Bénissez jusqu\'à 3 créatures consentantes. Chacune peut ajouter 1d4 à ses jets d\'attaque et de sauvegarde. Surincantation : +1 cible par niveau au-dessus du 1er.',
  },
  'Bane': {
    school: 'Enchantement', castingTime: '1 action', range: '9 m',
    components: 'V, S, M (une goutte de sang)',  duration: 'Concentration, 1 min',
    description: 'Jusqu\'à 3 créatures à portée effectuent un jet de CHA (DC de sort). En cas d\'échec, elles doivent retrancher 1d4 de leurs jets d\'attaque et de sauvegarde. Surincantation : +1 cible par niveau au-dessus du 1er.',
  },
  'Fausse vie': {
    school: 'Nécromancie', castingTime: '1 action', range: 'Personnelle',
    components: 'V, S, M (une petite quantité d\'alcool)', duration: '1 heure',
    description: 'Gagnez 1d4+4 PV temporaires. Surincantation : +5 PV temporaires par niveau au-dessus du 1er.',
  },
  'Enchevêtrement': {
    school: 'Invocation', castingTime: '1 action', range: '27 m',
    components: 'V, S', duration: 'Concentration, 1 min',
    description: 'Des herbes et lianes poussent dans un carré de 6 m. Les créatures dans la zone au moment de l\'incantation (jet de FOR DC de sort) sont entravées. D\'autres créatures entrant dans la zone aussi. Une entravée peut tenter de se libérer (FOR) à chaque tour.',
  },
  'Retraite expéditive': {
    school: 'Transmutation', castingTime: '1 action bonus', range: 'Personnelle',
    components: 'V, S', duration: 'Concentration, 10 min',
    description: 'Doublez votre vitesse de déplacement jusqu\'à la fin du sort. Vous pouvez aussi effectuer l\'action Se précipiter en action bonus à chaque tour.',
  },
  'Grand pas': {
    school: 'Transmutation', castingTime: '1 action', range: 'Contact',
    components: 'V, M (poudre de sésame)', duration: '1 heure',
    description: 'Touchez une créature. Sa vitesse augmente de 3 m. Surincantation : +1 cible par niveau au-dessus du 1er.',
  },
  'Marque du chasseur': {
    school: 'Divination', castingTime: '1 action bonus', range: '27 m',
    components: 'V', duration: 'Concentration, 1 heure',
    description: 'Choisissez une créature : vos attaques sur elle infligent +1d6 dégâts. Avantage aux tests de PER et SUV pour la pister. Si elle meurt, déplacez la marque (action bonus). Surincantation : durée augmente (8h au niv. 3, 24h au niv. 5).',
  },
  'Nappe de brouillard': {
    school: 'Invocation', castingTime: '1 action', range: '36 m',
    components: 'V, S', duration: 'Concentration, 1 heure',
    description: 'Créez un cylindre de brouillard dense (rayon 6 m, hauteur 6 m) centré sur un point à portée. La zone est fortement obscurcie. Le brouillard se dissipe par un vent fort.',
  },
  'Faveur divine': {
    school: 'Évocation', castingTime: '1 action bonus', range: 'Personnelle',
    components: 'V, S', duration: 'Concentration, 1 min',
    description: 'Vos armes scintillent. Jusqu\'à la fin du sort, vos attaques d\'arme infligent 1d4 dégâts radiants supplémentaires à chaque coup.',
  },
  'Alarme': {
    school: 'Abjuration', castingTime: '1 min', range: '9 m',
    components: 'V, S, M (clochette en métal)', duration: '8 heures',
    description: 'Protégez une zone (cube 6 m max). Si une créature Taille Minuscule+ entre, une alarme retentit : mentale (vous seul, vous réveille) ou audible (cloche sur 18 m). Choisissez jusqu\'à 8 créatures exemptées.',
  },

  // ── Niveau 2 ─────────────────────────────────────────────────────────────────
  'Invisibilité': {
    school: 'Illusion', castingTime: '1 action', range: 'Contact',
    components: 'V, S, M (cil de crapaud)', duration: 'Concentration, 1 heure',
    description: 'La créature touchée devient invisible jusqu\'à la fin du sort ou jusqu\'à ce qu\'elle attaque ou lance un sort. Equipement porté également invisible. Surincantation : +1 cible par niveau au-dessus du 2e.',
  },
  'Foulée brumeuse': {
    school: 'Invocation', castingTime: '1 action bonus', range: 'Personnelle',
    components: 'V', duration: 'Instantanée',
    description: 'Enveloppé d\'une brume argentée, vous vous téléportez jusqu\'à 9 m dans un espace inoccupé visible.',
  },
  'Arme spirituelle': {
    school: 'Évocation', castingTime: '1 action bonus', range: '18 m',
    components: 'V, S', duration: '1 min',
    description: 'Créez une arme de force flottante dans un espace inoccupé à portée. Attaque de sort au corps à corps (action bonus) : 1d8 + modificateur d\'incantation dégâts de force. Déplacez l\'arme de 6 m. Surincantation : +1d8 par deux niveaux au-dessus du 2e.',
  },
  'Prière de guérison': {
    school: 'Évocation', castingTime: '10 minutes', range: '9 m',
    components: 'V', duration: 'Instantanée',
    description: 'Jusqu\'à 6 créatures à portée regagnent chacune 2d8 + modificateur d\'incantation PV. Aucun effet sur les morts-vivants et les artificiels. Surincantation : +1d8 par niveau au-dessus du 2e.',
  },
  'Suggestion': {
    school: 'Enchantement', castingTime: '1 action', range: '9 m',
    components: 'V, M (langue de serpent)', duration: 'Concentration, 8 heures',
    description: 'Suggérez un cours d\'action à une créature (jet de SAG DC de sort). La créature suivra la suggestion formulée raisonnablement jusqu\'à sa fin. Le sort se termine si la suggestion lui cause du tort.',
  },
  'Immobiliser une personne': {
    school: 'Enchantement', castingTime: '1 action', range: '18 m',
    components: 'V, S, M (petite barre de fer droite)', duration: 'Concentration, 1 min',
    description: 'Un humanoïde est paralysé (jet de SAG DC de sort). Répète son jet à la fin de chaque tour. Surincantation : +1 cible par niveau au-dessus du 2e (1 jet de sauvegarde pour toutes).',
  },
  'Vision dans le noir': {
    school: 'Transmutation', castingTime: '1 action', range: 'Contact',
    components: 'V, S, M (carotte séchée ou agate)', duration: '8 heures',
    description: 'La créature touchée voit en vision dans le noir jusqu\'à 18 m dans l\'obscurité jusqu\'à la fin du sort.',
  },
  'Lévitation': {
    school: 'Transmutation', castingTime: '1 action', range: '18 m',
    components: 'V, S, M (pendentif doré)', duration: 'Concentration, 10 min',
    description: 'Une créature ou objet (≤ 500 kg) s\'élève de 6 m à la verticale. La cible (jet de CON si non consentante) peut monter ou descendre jusqu\'à 6 m par tour avec son action.',
  },
  'Silence': {
    school: 'Illusion', castingTime: '1 action', range: '45 m',
    components: 'V, S', duration: 'Concentration, 10 min',
    description: 'Aucun son ne peut jaillir d\'une sphère de 6 m centrée sur un point à portée, ni y pénétrer. Les créatures dans la zone sont immunisées aux dégâts de tonnerre et sont assourdies. Sorts à composante verbale impossibles dans la zone.',
  },
  'Fracas': {
    school: 'Évocation', castingTime: '1 action', range: '18 m',
    components: 'V, S, M (point de sable)', duration: 'Instantanée',
    description: 'Un son intense éclate en un point à portée. Toute créature dans un rayon de 3 m effectue un jet de CON (DC de sort) : 3d8 dégâts de tonnerre et renversée (échec) ou la moitié sans effet (succès). Objets non portés subissent des dégâts automatiquement. Surincantation : +1d8 par niveau au-dessus du 2e.',
  },
  'Bourrasque': {
    school: 'Évocation', castingTime: '1 action', range: 'Personnelle (ligne 18 m)',
    components: 'V, S, M (graine de légumineuse)', duration: 'Concentration, 1 min',
    description: 'Un vent fort souffle sur 18 m x 3 m dans la direction choisie. Les créatures dans la zone ont désavantage aux attaques à distance. Jet de FOR (DC de sort) ou repoussées de 4,50 m. Dissipe les nuages et sorts de brume.',
  },
  'Cécité/Surdité': {
    school: 'Nécromancie', castingTime: '1 action', range: '9 m',
    components: 'V', duration: '1 min',
    description: 'Rendez une créature aveugle ou sourde (jet de CON DC de sort). Répète son jet à la fin de chaque tour pour mettre fin au sort. Surincantation : +1 cible par niveau au-dessus du 2e.',
  },
  'Modification d\'apparence': {
    school: 'Transmutation', castingTime: '1 action', range: 'Personnelle',
    components: 'V, S', duration: '1 heure',
    description: 'Transformez votre apparence : hauteur ±30 cm, silhouette, couleur de peau, cheveux, yeux, voix, etc. Ne changez pas type de créature. Une action permet de détecter l\'illusion (test INV vs DC de sort).',
  },
  'Aide': {
    school: 'Abjuration', castingTime: '1 action', range: '9 m',
    components: 'V, S, M (bandage blanc)', duration: '8 heures',
    description: 'Jusqu\'à 3 créatures gagnent +5 PV (max et actuels). Surincantation : +5 PV par niveau au-dessus du 2e.',
  },

  // ── Niveau 3 ─────────────────────────────────────────────────────────────────
  'Boule de feu': {
    school: 'Évocation', castingTime: '1 action', range: '45 m',
    components: 'V, S, M (bille de soufre)', duration: 'Instantanée',
    description: 'Une boule de feu explose en un point à portée (rayon 6 m). Jet de DEX (DC de sort) : 8d6 dégâts de feu (échec) ou la moitié (succès). Enflamme les objets inflammables. Surincantation : +1d6 par niveau au-dessus du 3e.',
  },
  'Éclair': {
    school: 'Évocation', castingTime: '1 action', range: 'Personnelle (ligne 30 m)',
    components: 'V, S, M (bâton de verre)', duration: 'Instantanée',
    description: 'Un éclair de 1,50 m de large sur 30 m. Jet de DEX (DC de sort) : 8d6 dégâts de foudre (échec) ou la moitié (succès). Surincantation : +1d6 par niveau au-dessus du 3e.',
  },
  'Dissipation de la magie': {
    school: 'Abjuration', castingTime: '1 action', range: '36 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Mettez fin à tous les sorts de niveau 3 ou moins sur la cible (créature, objet ou effet magique). Pour les sorts de niveau 4+, effectuez un test (DC 10 + niveau du sort) avec votre modificateur d\'incantation.',
  },
  'Hâte': {
    school: 'Transmutation', castingTime: '1 action', range: '9 m',
    components: 'V, S, M (racine de réglisse)', duration: 'Concentration, 1 min',
    description: 'Doublez la vitesse d\'une créature consentante à portée. +2 à la CA, avantage aux jets de DEX. Une action supplémentaire (Attaque ×1, Se précipiter, Se désengager, Utiliser un objet). À la fin : léthargie 1 round (ne peut rien faire).',
  },
  'Vol': {
    school: 'Transmutation', castingTime: '1 action', range: 'Contact',
    components: 'V, S, M (aile de chauve-souris)', duration: 'Concentration, 10 min',
    description: 'Touchez une créature consentante. Elle gagne une vitesse de vol de 18 m. Surincantation : +1 cible par niveau au-dessus du 3e.',
  },
  'Motif hypnotique': {
    school: 'Illusion', castingTime: '1 action', range: '36 m',
    components: 'S, M (bâton d\'encens)', duration: 'Concentration, 1 min',
    description: 'Un motif entortillé tisse une toile de couleurs dans un cube de 9 m. Toute créature dans la zone (jet de SAG DC de sort) est charmée et incapacitée. Le charme se termine si la créature est blessée ou si quelqu\'un utilise son action pour la sortir du motif.',
  },
  'Animation des morts': {
    school: 'Nécromancie', castingTime: '1 min', range: '3 m',
    components: 'V, S, M (goutte de sang)', duration: 'Instantané (24h de contrôle)',
    description: 'Créez un squelette ou un zombie depuis les restes appropriés. Il vous obéit pendant 24h puis agit librement. Surincantation : +2 morts-vivants par niveau au-dessus du 3e.',
  },
  'Contresort': {
    school: 'Abjuration', castingTime: '1 réaction', range: '18 m',
    components: 'S', duration: 'Instantanée',
    description: 'Réaction quand vous voyez une créature lancer un sort. Si le sort est de niveau 3 ou moins, il échoue. Pour les niveaux 4+, effectuez un test (DC 10 + niveau du sort) avec votre modificateur d\'incantation.',
  },
  'Peur': {
    school: 'Illusion', castingTime: '1 action', range: 'Personnelle (cône 9 m)',
    components: 'V, S, M (plume blanche)', duration: 'Concentration, 1 min',
    description: 'Projetez des images de cauchemar dans un cône. Jet de SAG (DC de sort) : les créatures lâchent leurs objets et fuient au maximum de leur vitesse jusqu\'à la fin du sort. Répètent leur jet à chaque tour (hors ligne de vue → fin du sort).',
  },
  'Clairvoyance': {
    school: 'Divination', castingTime: '10 min', range: '1,5 km',
    components: 'V, S, M (clochette en verre d\'une valeur de 100 po)', duration: 'Concentration, 10 min',
    description: 'Créez un sens invisible (visuel ou auditif) dans un endroit que vous connaissez à portée. Pouvez basculer entre vision et ouïe. Peut voir/entendre à travers les sorts de divination.',
  },
  'Soins de groupe': {
    school: 'Évocation', castingTime: '1 action', range: '18 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Jusqu\'à 6 créatures dans un rayon de 9 m regagnent chacune 3d8 + modificateur d\'incantation PV. Surincantation : +1d8 par niveau au-dessus du 3e.',
  },

  // ── Niveau 4 ─────────────────────────────────────────────────────────────────
  'Flétrissement': {
    school: 'Nécromancie', castingTime: '1 action', range: '9 m',
    components: 'V, S', duration: 'Instantanée',
    description: 'Aspirez la vie d\'une créature (jet de CON DC de sort) : 8d8 dégâts nécrotiques (échec) ou la moitié (succès). Aucun effet sur les morts-vivants et les artificiels. Les plantes ont désavantage et subissent les dégâts max. Surincantation : +2d8 par niveau au-dessus du 4e.',
  },
  'Métamorphose': {
    school: 'Transmutation', castingTime: '1 action', range: '18 m',
    components: 'V, S, M (chrysalide)', duration: 'Concentration, 1 heure',
    description: 'Transformez une créature en animal. La cible (jet de SAG si non consentante) adopte les caractéristiques de la bête choisie. Le CR de la bête ne doit pas dépasser son niveau ou CR. Les PV restants lors de la forme transformée déterminent son état quand elle redevient elle-même.',
  },
  'Porte dimensionnelle': {
    school: 'Invocation', castingTime: '1 action', range: '150 m',
    components: 'V', duration: 'Instantanée',
    description: 'Vous vous téléportez ainsi qu\'une créature consentante adjacente vers un endroit à portée (que vous connaissez ou désignez par direction et distance). Si l\'endroit est occupé, vous et la créature subissez 4d6 dégâts de force et le sort échoue.',
  },
  'Banishment': {
    school: 'Abjuration', castingTime: '1 action', range: '18 m',
    components: 'V, S, M (eau bénite)', duration: 'Concentration, 1 min',
    description: 'Tentez de bannir une créature (jet de CHA DC de sort). Les natifs du plan où vous vous trouvez sont bannis dans un demi-plan inoffensif. Les créatures d\'autres plans retournent chez elles (permanence si sort maintenu 1 min entière). Surincantation : +1 cible par niveau au-dessus du 4e.',
  },

  // ── Niveau 5 ─────────────────────────────────────────────────────────────────
  'Cône de froid': {
    school: 'Évocation', castingTime: '1 action', range: 'Personnelle (cône 18 m)',
    components: 'V, S, M (pointe de cristal)', duration: 'Instantanée',
    description: 'Un souffle de froid emplit un cône de 18 m. Jet de CON (DC de sort) : 8d8 dégâts de froid (échec) ou la moitié (succès). Les créatures tuées deviennent des statues de glace fragiles. Surincantation : +1d8 par niveau au-dessus du 5e.',
  },
  'Domination de personne': {
    school: 'Enchantement', castingTime: '1 action', range: '18 m',
    components: 'V, S', duration: 'Concentration, 1 min',
    description: 'Dominée une créature humanoïde (jet de SAG DC de sort). Elle exécute vos ordres. Répète le jet si vous ou vos alliés lui causez du tort. Surincantation : durée → 10 min (niv. 6), 1 heure (niv. 7), 8h (niv. 8 ou 9).',
  },
  'Rétablissement suprême': {
    school: 'Abjuration', castingTime: '1 action', range: 'Contact',
    components: 'V, S, M (diamant d\'une valeur de 100 po consumé)', duration: 'Instantanée',
    description: 'Restaurez l\'énergie d\'une créature : réduisez son niveau d\'épuisement de 1, ou mettez fin à un effet la rendant charmée/pétrifiée, ou réduisez son maximum de PV à zéro, ou mettez fin à une malédiction ou maladie.',
  },
  'Colonne de flamme': {
    school: 'Évocation', castingTime: '1 action', range: '18 m',
    components: 'V, S, M (pincée de sel et de soufre)', duration: 'Instantanée',
    description: 'Un cylindre de feu divin de 3 m de rayon et 12 m de hauteur explose. Jet de DEX (DC de sort) : 4d6 dégâts de feu + 4d6 dégâts radiants (échec) ou la moitié (succès). Surincantation : +1d6 feu et 1d6 radiant par niveau au-dessus du 5e.',
  },
  'Télékinésie': {
    school: 'Transmutation', castingTime: '1 action', range: '18 m',
    components: 'V, S', duration: 'Concentration, 10 min',
    description: 'Déplacez ou manipulez télékinétiquement des objets ou créatures. Objet (≤ 500 kg) : déplacez-le de 9 m par tour. Créature (jet de FOR ou DEX DC de sort) : déplacez-la de 9 m, entravée. Peut manipuler des objets finement.',
  },

  // ── Niveau 6+ ─────────────────────────────────────────────────────────────────
  'Désintégration': {
    school: 'Transmutation', castingTime: '1 action', range: '18 m',
    components: 'V, S, M (magnétite)', duration: 'Instantanée',
    description: 'Jet d\'attaque de sort à distance : 10d6+40 dégâts de force. Si les dégâts réduisent la cible à 0 PV, elle est désintégrée (poussière verte). Objets non magiques ≤ cube 3 m détruits automatiquement. Surincantation : +3d6+10 par niveau au-dessus du 6e.',
  },
  'Mot de pouvoir : tuer': {
    school: 'Enchantement', castingTime: '1 action', range: '18 m',
    components: 'V', duration: 'Instantanée',
    description: 'Prononcez un mot de pouvoir qui tue une créature ayant ≤ 100 PV. Aucun jet de sauvegarde.',
  },
  'Souhait': {
    school: 'Conjuration', castingTime: '1 action', range: 'Personnelle',
    components: 'V', duration: 'Instantanée',
    description: 'Sort le plus puissant disponible pour les mortels. Dupliquez un sort de niveau 8 ou moins sans composantes, ou demandez un effet unique. Risque : 33% de ne plus jamais pouvoir lancer ce sort ; FOR réduite à 3 jusqu\'à un repos long ; épuisement.',
  },
}
