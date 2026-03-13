export interface DefaultClientAction {
  id: string;
  task: string;
  description: string;
  category: string;
  checked: boolean;
  phase: string;
}

export const DEFAULT_CLIENT_ACTIONS: DefaultClientAction[] = [
  // Accès & documents
  {
    id: 'access',
    task: 'Transmettre les accès',
    description: 'Identifiants site web, Instagram (rôle collaborateur), Facebook, Google Analytics, emailing, etc. Tout ce qui me permet de travailler sur tes canaux.',
    category: 'Accès',
    checked: true,
    phase: 'mois_1_2',
  },
  {
    id: 'logo',
    task: 'Envoyer le logo en HD',
    description: 'Logo principal + déclinaisons si tu en as (monochrome, icône, horizontal, vertical). Formats PNG ou SVG de préférence.',
    category: 'Accès',
    checked: true,
    phase: 'mois_1_2',
  },
  {
    id: 'charte',
    task: 'Envoyer la charte graphique',
    description: 'Si tu as une charte ou un guide de style (couleurs, typos, éléments visuels). Sinon, pas de souci, on construira ensemble.',
    category: 'Accès',
    checked: true,
    phase: 'mois_1_2',
  },
  {
    id: 'photos',
    task: 'Envoyer les photos professionnelles',
    description: "Photos de toi, de tes produits, de ton atelier, de tes créations. Tout ce qui me permettra d'illustrer ta communication.",
    category: 'Accès',
    checked: true,
    phase: 'mois_1_2',
  },
  // Réflexion stratégique
  {
    id: 'identite',
    task: 'Première réflexion sur ton identité',
    description: 'Qui est ton audience idéale ? Quelle est ta mission ? Ton combat ? Ce qui te différencie ? Écris tes premières réflexions librement, on les structurera ensemble.',
    category: 'Réflexion',
    checked: true,
    phase: 'mois_1_2',
  },
  {
    id: 'inspirations',
    task: "Lister 3-5 comptes ou marques qui t'inspirent",
    description: "Des comptes Instagram, des sites, des marques dont tu aimes la communication. Et surtout : dis-moi pourquoi. C'est ce qui m'intéresse.",
    category: 'Réflexion',
    checked: true,
    phase: 'mois_1_2',
  },
  {
    id: 'concurrents',
    task: 'Lister 3-5 concurrent·es direct·es',
    description: 'Les liens de leurs sites ou comptes Instagram. Pas pour copier, pour comprendre comment tu te positionnes par rapport à eux.',
    category: 'Réflexion',
    checked: true,
    phase: 'mois_1_2',
  },
  {
    id: 'offres',
    task: 'Lister tes offres / services avec les prix',
    description: 'Toutes tes offres, même celles que tu ne communiques pas encore. Avec les prix, les formats, ce qui est inclus.',
    category: 'Réflexion',
    checked: true,
  },
  {
    id: 'best_content',
    task: 'Rassembler tes meilleurs contenus',
    description: 'Les posts, articles, vidéos qui ont le mieux marché. Ceux dont tu es fière. Ceux qui ont généré des ventes ou des messages.',
    category: 'Réflexion',
    checked: true,
  },
];
