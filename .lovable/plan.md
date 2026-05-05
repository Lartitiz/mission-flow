## Contexte

Sur la session actuelle (Riviera Solution RH), les "Notes structurées" sont très longues (quasi-verbatim). Tu veux :

1. Une version plus **synthétique** (résumé clair, pas un mur de texte).
2. Que les actions à mener proposées par l'IA incluent bien celles des **décisionnaires** (client), pas seulement les tiennes. En fait, ici, je vois aussi que ça peut générer des actions dans les tâches, dans les missions. 

## Ce que je vais changer

### 1. `supabase/functions/structure-session-notes/index.ts` — mode synthétique

Aujourd'hui le prompt impose une exhaustivité totale ("si les notes font 1500 mots, la fiche doit faire au moins 1300 mots"). On bascule sur un mode **résumé structuré** :

- Nouvelles règles : restituer l'essentiel (décisions, chiffres clés, livrables, ressentis client marquants en verbatim court), **PAS** tout reformuler. Cible ≈ 30-40% de la longueur des notes brutes.
- Sections resserrées et fusionnées :
  - **Résultats clés** (1 paragraphe synthétique)
  - **Décisions prises** (liste à puces courtes)
  - **Retours client** (verbatims marquants seulement)
  - **Points de vigilance / blocages**
  - **Actions à mener** (qui fait quoi)
- Garder verbatims uniquement quand ils sont révélateurs.
- `max_tokens` réduit de 6000 → 2500 pour limiter naturellement la longueur.

> Note mémoire : ceci entre en conflit avec la règle Core "AI Structuring: 100% exhaustif". Je vais mettre à jour cette mémoire pour distinguer **discovery/kickoff** (exhaustif) vs **sessions de suivi** (synthétique). À confirmer.

### 2. `supabase/functions/extract-actions-from-cr/index.ts` — pousser les actions client

Le prompt extrait déjà `assignee: "laetitia" | "client"`, mais en pratique l'IA propose surtout des actions pour Laetitia. J'ajoute une règle explicite :

- "Identifie systématiquement les actions à mener par les **décisionnaires côté client** (validations, retours à donner, contenus à fournir, décisions à prendre, infos à transmettre). Ne te limite pas aux tâches de Laetitia."
- "Pour chaque sujet abordé, demande-toi : 'qu'est-ce que le/la client·e doit faire de son côté ?' avant de passer au suivant."

Aucun changement UI nécessaire : les actions extraites avec `assignee: "client"` apparaissent déjà dans le tableau Actions des décisionnaires via le panneau `AiExtractionResults` puis `handleApplyExtraction`.

## Hors scope

- Pas de changement sur la structuration discovery/kickoff (exhaustivité conservée).
- Pas de changement UI sur `SessionHistory.tsx`.

## Validation

Après déploiement, re-clique "Re-structurer" sur la session Riviera pour générer une version synthétique, et vérifie que des actions "client" apparaissent dans le panneau de suggestions.