# Rendre les cartes du pipeline bien lisibles

## Le problème

Les cartes de mission sont blanches sur un fond blanc, avec une ombre très légère et aucun contour. Résultat : on ne distingue pas où commence et où finit une carte, et les colonnes du kanban se confondent entre elles.

## Ce qu'on change

**1. Un fond de colonne, des cartes qui ressortent**
Chaque colonne du kanban reçoit un fond légèrement teinté (gris rosé très clair, dans la palette existante) avec un titre de colonne mieux marqué et un compteur en pastille. Les cartes blanches se détachent alors nettement dessus.

**2. Des cartes avec un contour net**
- Fin liseré sur chaque carte + ombre un peu plus présente.
- Au survol : l'ombre se renforce et la carte se soulève légèrement (petit décalage vers le haut).
- Pendant le glisser-déposer : rotation légère et ombre marquée pour bien voir ce qu'on déplace.

**3. Une hiérarchie plus claire dans la carte**
- Nom de la cliente plus grand et plus contrasté (police titre).
- Montant affiché comme une donnée forte, aligné à droite sur sa propre ligne, séparé du badge de type par un fin filet.
- Badge de retard ("Sans nouvelle depuis X j") plus compact et posé sur la ligne du bas avec la date, pour arrêter d'encombrer la ligne des badges.
- Bouton "..." toujours visible sur mobile (aujourd'hui il n'apparaît qu'au survol, donc inaccessible au doigt).

**4. Zone de dépôt plus lisible**
Quand on survole une colonne en glissant une carte, la colonne affiche un contour en pointillé dans la couleur d'accent plutôt qu'un simple aplat.

## Détails techniques

- `src/components/pipeline/KanbanColumn.tsx` : fond de colonne via un token, en-tête retravaillé, état `isOver` en bordure pointillée.
- `src/components/pipeline/MissionCard.tsx` : structure interne réorganisée (nom / badge+montant / bas de carte), bordure, transitions hover et drag.
- `src/index.css` : ajout d'un token de surface pour le fond de colonne et d'un token d'ombre survol, en HSL, déclinés en clair et sombre. Aucune couleur codée en dur dans les composants.

Aucune logique métier, aucune requête et aucune donnée n'est modifiée.
