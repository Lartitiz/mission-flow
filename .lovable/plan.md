# Espace client : alléger « Ce que j'attends de toi »

## Constat

Aujourd'hui l'espace client affiche **toutes** les actions client d'un coup, à plat, sans distinction de mois. Exemple réel : Adeline a 19 actions client non faites réparties sur mois 1-2, mois 3 et mois 4-5 ; Cindy en a 33. Les vieilles tâches d'onboarding (transmettre les accès, envoyer le logo…) restent affichées au même niveau que les tâches du mois en cours, même des mois plus tard. D'où l'effet « c'est trop » à chaque visite.

## Ce qu'on change

### 1. Focus sur le moment présent
La liste « Ce que j'attends de toi » est regroupée par phase (mois 1-2, mois 3, etc.), comme l'est déjà la section de suivi de Laetitia.

- **En haut, dépliée** : la phase en cours (celle qui contient les tâches actives / la plus récente non terminée).
- **Au-dessus, un bandeau discret** : « X tâches des mois précédents encore ouvertes » — repliable, replié par défaut.
- **En dessous, replié** : les phases à venir (« À venir : mois 4-5 »), pour que la cliente sache ce qui arrive sans être noyée.
- Les actions terminées restent dans leur bloc repliable existant.

Résultat quand la cliente arrive : 3 à 6 tâches visibles au lieu de 20.

### 2. Pouvoir retirer une tâche devenue inutile
Beaucoup de tâches anciennes ne seront jamais cochées parce qu'elles ne sont plus d'actualité (accès déjà transmis hors outil, logo envoyé par mail…). On ajoute la possibilité de les **archiver** :

- Nouveau statut « archivée » (colonne `archived_at` sur les actions).
- Dans le plan d'action côté Laetitia : bouton « Archiver » sur chaque ligne + action groupée « Archiver toutes les tâches ouvertes de mois 1-2 ».
- Une action archivée **disparaît totalement de l'espace client** et des compteurs, sans être supprimée (récupérable côté Laetitia via un filtre « Archivées »).

### 3. Rappel doux plutôt que liste infinie
Le badge d'en-tête compte uniquement les tâches de la phase en cours (« 4 restantes »), les retards étant signalés séparément par le bandeau du point 1.

## Détails techniques

- Migration : `alter table actions add column archived_at timestamptz` + index ; les requêtes de l'edge function `get-client-space` filtrent `archived_at is null`.
- `src/pages/ClientView.tsx` : réutiliser la logique `PHASE_ORDER` / `PHASE_CONFIG` déjà présente pour grouper `todoClientActions`, calculer la phase courante (première phase contenant une action non terminée dont la `target_date` est passée ou proche, sinon la plus avancée ayant des actions faites), et rendre trois blocs : retard (replié), en cours (déplié), à venir (replié).
- `src/components/actions/*` (table du plan d'action) : bouton d'archivage par ligne, action groupée par phase, filtre d'affichage des archivées.
- Aucun changement sur l'extraction IA des actions.
