## Contexte

Sur la session structurée, la section "Actions à mener" liste qui doit faire quoi (Adeline / Laetitia). Aujourd'hui ces actions ne partent dans le plan d'action que **lors de la structuration initiale**. Si l'extraction a raté ou si tu veux les renvoyer après-coup, il n'y a pas de bouton.

## Ce que je vais ajouter

**Un bouton "Envoyer les actions vers le plan d'action"** sous les notes structurées de chaque session :

- Re-lance la fonction edge `extract-actions-from-cr` sur le contenu structuré (en passant aussi les actions existantes pour éviter doublons).
- Persiste le résultat dans `structured_notes._pending_extracted` (même mécanisme que déjà en place).
- Bandeau "X suggestions IA en attente" remonte automatiquement dans l'onglet **Plan d'action** où tu valides/rejettes (déjà implémenté).
- Toast de confirmation : "X action(s) proposée(s) — à valider dans le Plan d'action".

### État du bouton
- Visible uniquement si `structured_notes` existe.
- Loading state pendant l'extraction.
- Si suggestions déjà en attente → libellé "Re-extraire les actions".

## Fichier touché
- `src/components/followup/SessionHistory.tsx` : nouveau handler `handleExtractActions(session)` + bouton à côté du bouton "Re-structurer".

## Hors scope
- Pas de duplication de la logique d'application : on réutilise le bandeau existant dans `ActionsTab`.