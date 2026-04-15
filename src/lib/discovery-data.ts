export interface QuestionBlock {
  title: string;
  questions: string[];
}

export const DISCOVERY_QUESTIONS: QuestionBlock[] = [
  {
    title: 'Cadrage',
    questions: [
      "L'objectif de cet appel, c'est qu'on puisse voir ensemble si je peux vraiment t'aider, et comment. Est-ce que ça te va si je te pose des questions ?",
    ],
  },
  {
    title: 'Découverte',
    questions: [
      "Qu'est-ce qui t'amène à moi aujourd'hui ?",
      'Peux-tu me raconter ton histoire et celle de ton entreprise ?',
      'Peux-tu me parler de tes offres ?',
      "De quoi as-tu le plus besoin aujourd'hui ?",
      "Comment tes client·es te découvrent-iels aujourd'hui ?",
      'As-tu des objectifs clairs en termes de communication ?',
      'Quelles sont tes problématiques principales ?',
      "Qu'est-ce qu'il se passe si ça ne se fait pas ?",
      'Si tu avais une baguette magique, à quoi ressemblerait la solution idéale ?',
      'Peux-tu me parler de ta communication actuelle ? (site, réseaux, emailing, influence)',
      "Qu'est-ce qui te bloque dans ta com' ?",
      "Parmi tout ce qu'on a identifié, quel serait le point le plus important à résoudre ?",
      "Qu'est-ce qui a déclenché le fait de nous contacter ?",
      'Où veux-tu être dans 6 mois ?',
      "Combien de temps passes-tu par semaine sur ta com' ?",
      "C'est quoi tes compétences aujourd'hui ?",
      "As-tu déjà travaillé avec des freelances ou agences de com' ?",
      'Quel est ton budget ?',
      'Travailles-tu seul·e ou avec des collaborateur·ices ?',
      'Y a-t-il une échéance particulière ?',
      "Quel type d'accompagnement tu cherches ?",
      'Comment tu nous as découvert ?',
    ],
  },
  {
    title: 'Reformulation',
    questions: [
      "Donc si j'ai bien compris, pour résumer, ce que tu souhaites...",
      "Est-ce que ça te dit que je te fasse quelques recommandations ?",
    ],
  },
];

export interface SalesScript {
  title: string;
  content: string;
}

export const SALES_SCRIPTS: SalesScript[] = [
  {
    title: 'Transition',
    content:
      "Bon, sache que tu n'es pas la seule dans ce cas. C'est souvent la même chose : on passe trop de temps sur sa com', pour peu de résultats. On n'a pas vraiment de plan, on avance en tâtonnant. On est seul·e face à tout ça.",
  },
  {
    title: 'Présentation Nowadays',
    content:
      "Est-ce que ça te dit que je te présente un peu Nowadays ? On est une agence de communication éthique depuis 2017. On a accompagné + de 50 projets engagés. On les accompagne à travers des stratégies de communication responsables, parce que la communication agressive, ça va 2 minutes.",
  },
  {
    title: 'Pitch Binôme',
    content:
      "Ce que je peux te proposer, c'est l'accompagnement Ta Binôme de Com' : 6 mois où on construit et on applique ensemble ta stratégie de communication. Mois 1-2 : je construis ton plan de com' sur mesure. Mois 3-6 : on applique ensemble avec une visio de 2h par mois + WhatsApp jours ouvrés. 290€/mois pendant 6 mois.",
  },
  {
    title: 'Pitch Agency',
    content:
      "Pour une structure comme la vôtre, ce que je propose c'est un pilotage complet de votre communication. Je fais pour vous : stratégie, contenus, réseaux sociaux, site, emailing. Vous validez les grandes lignes, je m'occupe du reste. Entre 1 500€ et 20 000€ selon l'ampleur. Je vous envoie une proposition sur mesure.",
  },
  {
    title: 'Gestion des objections',
    content:
      "Technique : « J'entends que [objection]. Mais du coup, comment tu vas faire [conséquence] ? »",
  },
  {
    title: 'Closing',
    content:
      "Ça te dit que je te fasse une proposition personnalisée ? Je te l'envoie d'ici [délai]. Est-ce que tu me permets de te recontacter dans 2 jours si je n'ai pas de réponse ?",
  },
];
