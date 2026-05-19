## Objectif

Ajouter dans le Kit Projet Claude une recherche obligatoire de **désirabilité de marque** basée sur les **verbatims de l'audience** (avis clients chez les concurrent·es, groupes Facebook, forums Reddit, threads, commentaires YouTube/TikTok, etc.), en plus de l'audit concurrentiel existant.

## Modification

Fichier : `supabase/functions/generate-claude-project-chain/index.ts`, dans `PHASE_PROMPTS.A` (phase Recherche).

### Ajout d'une règle obligatoire dans la phase A

Après le paragraphe "Génère entre 2 et 5 prompts adaptés à CETTE cliente." (ligne 87), insérer :

> **RÈGLE LIVRABLES OBLIGATOIRES** — quelle que soit la cliente, la chaîne de prompts phase A DOIT contenir au minimum deux livrables distincts :
>
> 1. **Audit concurrentiel / paysage** — positionnement, offres, ton, prix, points forts/faibles des concurrent·es directes et indirectes (que Claude doit identifier lui-même à partir des hypothèses kick-off).
>
> 2. **Étude de désirabilité — verbatims audience** (NON NÉGOCIABLE). Objectif : trouver les mots exacts utilisés par l'audience cible pour parler de ses problèmes, désirs, frustrations, attentes — afin de nourrir une communication réellement désirable (pas une projection de la marque sur sa cible).
>
>    Le prompt doit demander à Claude d'aller chercher du verbatim brut dans :
>    - Avis clients sur les sites/marketplaces des concurrent·es (5 étoiles ET 1 étoile)
>    - Commentaires sous les publications Instagram / TikTok / YouTube des concurrent·es et des comptes de référence du sujet
>    - Threads Reddit pertinents (subreddits liés au sujet, à la cible, aux problèmes traités)
>    - Groupes Facebook publics, forums spécialisés, sections commentaires de blogs/médias du secteur
>    - Questions Google "People also ask", AnswerThePublic, autocomplétions
>    - Témoignages / interviews / podcasts où la cible parle elle-même
>
>    Livrable attendu : un document structuré (format `.docx`) avec
>    - **Citations brutes** (verbatim entre guillemets, source mentionnée)
>    - Regroupées par **thème émotionnel** : douleurs/frustrations, désirs/aspirations, objections/freins, déclencheurs d'achat, mots interdits (ce qui agace la cible)
>    - Une synthèse en fin : **lexique désirable** (les mots/expressions à utiliser dans la communication) et **lexique à éviter** (jargon, formulations qui font fuir).
>
>    Si Claude ne trouve pas de verbatim sur certains thèmes, il doit le SIGNALER explicitement plutôt que d'inventer.

Ce livrable s'ajoute aux 2–5 prompts existants (la borne haute peut donc passer de 5 à 6 si nécessaire — ajuster la phrase "Génère entre 2 et 5 prompts" en "Génère entre 3 et 6 prompts, en incluant systématiquement l'audit concurrentiel ET l'étude de désirabilité").

### Cascading

L'étude de désirabilité peut être placée **en parallèle de l'audit concurrentiel** (pas de dépendance entre les deux), mais les prompts de la **phase B (stratégie)** devront s'appuyer sur les DEUX livrables (audit + verbatims). Préciser dans `PHASE_PROMPTS.B` que le positionnement et les messages clés doivent intégrer le lexique désirable issu de l'étude de verbatims.

Ajout court dans la phase B, après la règle "NE PAS PRÉSUPPOSER" :

> Les messages clés et la ligne éditoriale doivent OBLIGATOIREMENT s'appuyer sur le **lexique désirable** issu de l'étude de verbatims (document dans le projet). Si un message clé proposé n'utilise aucun mot du lexique audience, le signaler comme alerte.

## Hors scope

- Pas de changement de modèle, de structure JSON, ni des autres phases (K / C).
- Pas de nouvel outil ni de scraping automatisé : c'est Claude (dans le projet client) qui fait la recherche manuelle/web.
