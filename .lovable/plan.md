## Objectif

Ajouter une règle dans le prompt système du Kit Projet Claude pour que les documents générés soient utilisables à la fois en interne (Laetitia) ET directement lisibles par la cliente.

## Modification

Fichier : `supabase/functions/generate-claude-project/index.ts`

Dans la section "Production" des règles de travail (règles 4-7), ajouter une règle **6bis** :

> **6bis. Double lecture des livrables** — Chaque document produit doit fonctionner sur deux plans simultanément :
> - **Lisible en interne** : Laetitia peut s'en servir comme document de travail, de référence ou de pilotage.
> - **Lisible par la cliente** : le document peut être transmis tel quel sans réécriture. Pas de notes internes en clair, pas de jargon agence, pas de TODO visibles, pas de commentaires entre crochets destinés à Laetitia mêlés au contenu final.
> Si une info est strictement interne (budget, marge, stratégie commerciale, red flags), la mettre dans une section dédiée clairement marquée "INTERNE — ne pas transmettre" en début ou fin de document, jamais noyée dans le corps.

Cette règle complète la 12bis (adresse directe à la cliente) et la 17 (lecteur froid), mais cible spécifiquement la **double destination** du même fichier.

## Aucun autre changement

Pas de modification de la chaîne en 2 étapes, du modèle, ni des autres règles. Juste l'insertion de cette règle 6bis.
