Oui, c’est bien ce fichier MD qui ne fait pas assez son travail aujourd’hui : `public/assets/instructions-ateliers-binome.md`.

Je vais le durcir pour que Claude ne puisse plus passer directement à la trame d’atelier tant que le cadrage n’est pas vraiment validé.

## Plan

1. Renforcer le principe central du MD
  - Ajouter une règle très explicite : ce fichier sert d’abord à cadrer l’atelier avec toi, pas à produire immédiatement.
  - Interdire la génération d’une trame dès le premier message si les réponses de cadrage ne sont pas complètes.
2. Transformer l’étape 1 en vrai échange de cadrage + j'aimerais ici qu'il m'explique ou on en est et ce qu'il recommande
  - Remplacer les 5 questions actuelles, trop rapides, par un cadrage plus profond :
    - intention de l’atelier
    - état émotionnel / niveau d’autonomie de la cliente
    - ce que tu veux absolument faire vivre
    - ce que tu ne veux surtout pas
    - livrable concret attendu
    - niveau de co-création pendant la visio
    - contraintes de temps, énergie, supports existants
  - Demander à Claude de poser les questions en conversation, pas comme un formulaire froid.
3. Ajouter une validation obligatoire avant production
  - Après les réponses, Claude devra reformuler :
    - “si je comprends bien, tu veux un atelier qui…”
    - objectif
    - livrable
    - ambiance
    - déroulé pressenti
    - points de vigilance
  - Puis il devra attendre ton accord avant de proposer une trame.
4. Découper le workflow en étapes non négociables
  - Étape 1 : questions de cadrage uniquement.
  - Étape 2 : reformulation + accord.
  - Étape 3 : 2 ou 3 approches possibles.
  - Étape 4 : choix d’une approche.
  - Étape 5 : exercices / blocs proposés.
  - Étape 6 : trame complète seulement après validation.
5. Ajouter des phrases d’arrêt très claires
  - Par exemple :
    - “Je ne produis pas encore la trame.”
    - “J’attends ta validation avant de rédiger.”
    - “Si une info manque, je pose une question au lieu d’inventer.”
6. Garder le format final existant
  - Je conserve la structure de trame actuelle, les scripts, la boussole émotionnelle, le Plan B, les exercices et le style Nowadays.
  - Je change surtout le comportement en amont : plus de cadrage, moins de production automatique.

## Détail technique

Fichier modifié :

- `public/assets/instructions-ateliers-binome.md`

Pas besoin de changer la base de données.
Pas besoin de modifier l’interface.
Le bouton “Instructions ateliers” téléchargera automatiquement la nouvelle version du MD après modification.