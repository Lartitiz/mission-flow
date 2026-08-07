# Simplifier la partie Ateliers / Sessions

Aujourd'hui la même chose est représentée à trois endroits différents dans l'onglet Suivi :

1. **Ateliers : 4/6** — compteur + prochain atelier + liste des ateliers à venir
2. **Prochaine session** — une date + un ordre du jour stockés *sur la dernière session passée* (champs séparés)
3. **Sessions** — l'historique, modifiable, mais seulement pour les sessions passées

Résultat : on ne peut pas modifier un atelier à venir (ni sa date, ni son titre, ni son ordre du jour, ni le supprimer), et « prochaine session » raconte une deuxième version de la même info que « prochain atelier ».

## Ce que je propose

Une seule carte **Ateliers**, avec une timeline unique où chaque atelier — passé ou à venir — est une ligne identique et modifiable.

```text
Ateliers        4/6        [+ Planifier un atelier]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░  4 faits · 1 planifié · 1 à planifier

À VENIR
 8 sept.  Atelier 5 : calendrier éditorial          [modifier] [supprimer]
          Ordre du jour : valider les 3 piliers…    [Suggérer l'agenda]
          + message de réservation (lien Calendly)

DÉJÀ FAITS
 7 juil.  Atelier Mois 4                            [notes structurées]
21 mai    Atelier Mois 3
```

### Concrètement

- **Tout est modifiable au même endroit** : date, titre, type (visio/présentiel), ordre du jour, suppression — pour les ateliers à venir comme pour les passés. Plus besoin d'aller dans deux blocs différents.
- **« Prochaine session » disparaît en tant que bloc séparé.** Son contenu (choix de date, bouton « Suggérer l'agenda », zone d'ordre du jour, message de réservation Calendly) se retrouve directement sur le prochain atelier à venir, mis en avant en haut de la liste.
- **Suggérer des dates** : lors de la planification, des dates proposées en un clic (dans 1 semaine, 2 semaines, 1 mois, même jour que le dernier atelier + 3 semaines) en plus du calendrier libre.
- **S'il n'y a aucun atelier planifié**, la carte affiche un encart clair « Aucun atelier planifié » avec le bouton de planification et les dates suggérées — au lieu du texte discret actuel.
- **Le compteur reste éditable** (« sur 6 prévus »), inchangé.
- L'historique détaillé (notes, dictée, structuration IA, extraction d'actions) reste tel quel, replié sous chaque atelier passé.

## Détails techniques

- Fusion de `AteliersCard` + `NextSessionCard` dans une seule `AteliersCard`, et `SessionHistory` devient la partie « déjà faits » rendue à l'intérieur de cette carte (pas de réécriture de sa logique de notes/IA).
- Les ateliers à venir sont des lignes `sessions` avec `session_date > aujourd'hui` : l'édition passe par `updateSession` / `deleteSession` déjà présents dans `useSessions`.
- L'ordre du jour d'un atelier à venir est stocké dans son propre `next_session_agenda` (convention déjà utilisée à la création). `suggest-session-agenda` est appelé pour l'atelier à venir sélectionné, plus pour la dernière session passée.
- `next_session_date` sur les sessions passées n'est plus utilisé pour l'affichage (aucune migration, aucune donnée supprimée).
- `NextSessionBookingMessage` est déplacé sous le prochain atelier ; aucun changement de son contenu.
