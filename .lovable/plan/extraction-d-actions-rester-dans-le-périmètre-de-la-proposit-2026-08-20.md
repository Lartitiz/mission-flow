# Extraction d'actions : rester dans le périmètre de la proposition validée

Objectif : quand l'IA extrait des actions depuis un compte-rendu (onglet Actions, Suivi/sessions, Kick-off), elle ne doit plus inventer de travail supplémentaire. Tout ce qui n'est pas prévu dans la proposition validée doit être clairement signalé comme "hors périmètre" et non coché par défaut. Ou alors, une idée, ce serait de faire une catégorie à faire en atelier. Qu'en penses-tu ? 

## Ce qui change

1. **La proposition validée devient la référence**
  La dernière version de la proposition de la mission est envoyée à l'IA en même temps que le compte-rendu. C'est le cadre de ce qui est dû.
2. **Règle stricte dans le prompt d'extraction**
  - Ne créer une action que si elle correspond à un livrable/engagement présent dans la proposition, ou si elle est explicitement demandée dans le compte-rendu.
  - Interdiction d'ajouter des "bonnes idées" ou des tâches d'amélioration non demandées.
  - Ne pas découper un livrable en dix micro-tâches : rester au niveau des engagements réels.
  - Toute action qui sort du cadre doit être marquée `hors périmètre` avec une justification courte (ex. "demandé en séance, non prévu au contrat").
3. **Affichage dans la revue des suggestions**
  - Les actions dans le périmètre : cochées par défaut, comme aujourd'hui.
  - Les actions hors périmètre : regroupées à part, **décochées par défaut**, avec un badge "Hors proposition" et la raison. Tu choisis de les prendre ou pas.
  - Si aucune proposition n'existe encore pour la mission, comportement actuel conservé (rien n'est bloqué).

## Détails techniques

- `supabase/functions/extract-actions-from-cr/index.ts` :
  - accepte un nouveau champ `proposal_content` (optionnel) dans le body ;
  - le sérialise en texte (`## titre` + contenu) et l'injecte dans le user prompt sous "Périmètre contractuel" ;
  - le SYSTEM_PROMPT gagne une section "RÈGLE CRITIQUE — PÉRIMÈTRE" et le schéma JSON gagne `out_of_scope: boolean` et `out_of_scope_reason: string` sur chaque `new_action` ;
  - la règle d'équilibre Laetitia/client·e est conservée, mais bornée au périmètre.
- Appelants mis à jour pour passer la proposition (`proposals`, dernière `version`, champ `content`) :
  - `src/components/actions/ActionsTab.tsx` (la requête `proposal-for-actions` existe déjà) ;
  - `src/components/followup/SessionHistory.tsx` (ajout d'une requête proposition ou passage via prop depuis `FollowUpTab`) ;
  - `src/components/kickoff/KickoffTab.tsx` (proposition déjà chargée dans ce composant).
- `src/components/actions/AiExtractionResults.tsx` : type `AiNewAction` étendu avec `out_of_scope`/`out_of_scope_reason`, séparation en deux groupes, sélection initiale limitée aux actions dans le périmètre, badge + raison affichés.
- Redéploiement de l'edge function `extract-actions-from-cr`.