## Contexte

Aujourd'hui, quand l'IA extrait des actions depuis un CR de session (onglet Suivi), le panneau de validation `AiExtractionResults` s'affiche **uniquement dans la session en cours**. Si tu navigues ailleurs ou recharges, les suggestions sont perdues. Tu veux pouvoir **les retrouver et les valider depuis l'onglet Plan d'action**.

## Ce que je vais changer

### 1. Persister les suggestions IA — sans migration

Pas de schéma à modifier : je stocke les suggestions dans le champ `structured_notes` (jsonb) déjà présent sur `sessions`, sous la clé `_pending_extracted` :

```jsonc
{
  "sections": [...],          // notes structurées existantes
  "_pending_extracted": {
    "new_actions": [...],
    "updates": [...],
    "generated_at": "2026-05-12T10:00:00Z"
  }
}
```

Effacé après application ou rejet.

### 2. `SessionHistory.tsx` — écrire les suggestions

Au moment de l'extraction (handleStructure), persister `_pending_extracted` dans `structured_notes`. À l'application/annulation, supprimer la clé.

### 3. `ActionsTab.tsx` — afficher les suggestions en attente

- Nouvelle requête : récupérer toutes les sessions de la mission qui ont `structured_notes._pending_extracted` non vide.
- Bandeau en haut du Plan d'action : "X suggestions IA en attente — issues de la session du JJ/MM".
- Clic → déplie un panneau `AiExtractionResults` (composant existant) pour valider/rejeter.
- À la validation : insère les actions, puis efface `_pending_extracted` sur la session source.
- Realtime : invalider la query quand `sessions` change pour voir les nouvelles suggestions immédiatement.

### 4. Badge sur l'onglet "Plan d'action"

Petit pastille avec le nombre total de suggestions en attente, pour ne pas les oublier.

## Hors scope

- Pas de table dédiée `action_suggestions` (overkill, jsonb suffit).
- Pas de changement UI dans `AiExtractionResults` lui-même.
- Le panneau dans la session reste en place (raccourci immédiat post-extraction).

## Fichiers touchés

- `src/components/followup/SessionHistory.tsx` (persist on extract / clear on apply)
- `src/components/actions/ActionsTab.tsx` (query + bandeau + apply handler)
- éventuellement `src/components/dashboard/MissionTabs.tsx` (badge sur l'onglet) — à confirmer après lecture