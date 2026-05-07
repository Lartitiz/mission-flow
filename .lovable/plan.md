## Constat

Quand on clique sur **"Structurer mes notes"** dans l'onglet Kick-off :
- Les notes structurées sont bien sauvées dans la table `kickoffs.structured_notes` (donc elles persistent côté DB), mais elles ne réapparaissent **nulle part dans l'onglet Suivi**.
- Aucune extraction d'actions n'est lancée (contrairement aux sessions du Suivi).

L'utilisatrice veut donc que la structuration du kick-off pousse automatiquement le contenu :
1. Dans **l'historique des sessions** du Suivi (type visio, sujet "Atelier de lancement").
2. Dans le **Plan d'action** sous forme de suggestions d'actions à valider.

## Plan

### 1. `supabase/functions/structure-kickoff-notes/index.ts` — inchangée
On garde la fonction telle quelle (elle structure déjà bien).

### 2. `src/components/kickoff/KickoffTab.tsx` — étendre `handleStructureNotes` et `handleStructureResponses`
Après la structuration réussie :
- **Créer ou mettre à jour une session de Suivi** liée à ce kick-off :
  - `session_type = 'visio'`
  - `topic = 'Atelier de lancement (kick-off)'`
  - `session_date` = date du kick-off (created_at)
  - `raw_notes` = transcription brute
  - `structured_notes = { sections, _from_kickoff: kickoff.id }`
  - Idempotence : on cherche d'abord une session existante avec `structured_notes._from_kickoff = kickoff.id` ; si trouvée → update, sinon → insert.
- **Lancer `extract-actions-from-cr`** sur les notes structurées (même logique que `SessionHistory.handleStructure`).
- **Stocker les suggestions** dans `structured_notes._pending_extracted` de cette session pour qu'elles s'affichent dans le bandeau de validation déjà existant de l'onglet Plan d'action.
- **Toast récapitulatif** : "Notes structurées · ajoutées au Suivi · X action(s) suggérée(s) à valider".

### 3. `src/components/kickoff/KickoffStructuredNotes.tsx` — petit indicateur visuel
Ajouter un petit badge / texte discret en bas : "✓ Synchronisé avec le Suivi · X action(s) en attente de validation dans le Plan d'action" (lien optionnel pour switcher d'onglet).

## Détails techniques

- Aucun changement de schéma : on utilise le champ `topic` (déjà ajouté aux sessions) + le marqueur `_from_kickoff` dans `structured_notes` JSONB.
- Récupérer `actions` via `useActions(missionId)` dans `KickoffTab` pour passer le contexte à l'extraction.
- Réutiliser exactement le format `_pending_extracted` déjà géré par `ActionsTab` (bandeau "X suggestions IA en attente").
- Pas de doublon : l'idempotence par `_from_kickoff` garantit qu'une re-structuration met à jour la même session du Suivi plutôt que d'en créer une nouvelle.
