

## Ajouter une Phase 0 « Kick-off » au kit projet Claude

### Objectif

Quand on génère le kit projet Claude pour une cliente (typiquement juste après signature, avant l'atelier de lancement), le **tout premier prompt** de la chaîne doit aider à préparer cet atelier :

1. Générer les questions pertinentes à poser pendant le kick-off
2. Produire un document de support pour l'atelier de lancement

Aujourd'hui, la chaîne commence directement par la Phase A (Recherche), ce qui suppose que le kick-off est déjà fait.

### Plan

**1. Nouvelle Phase 0 (Kick-off) dans `generate-claude-project-chain`**

Ajouter une 4ᵉ entrée dans `PHASE_PROMPTS` avec la clé `'K'` (kick-off) :

- **Prompt 1 — Questions d'atelier** (output_format `chat`) : à partir de la proposition commerciale et de l'appel découverte (déjà dans le prompt système), générer 10-15 questions pertinentes regroupées par thème (identité de marque, cible, canaux, contraintes, etc.) que Laetitia posera pendant l'atelier. Les questions doivent éviter de re-poser ce qui a déjà été couvert lors de la découverte.
- **Prompt 2 — Document de support kick-off** (output_format `.docx`) : produire le document que Laetitia partagera/utilisera pendant l'atelier de lancement. Structure : intro courte + récap de ce qui a été vendu + chaque thème avec ses questions + zones de prise de notes. Ton « tu », inclusif, esthétique papier minimaliste cohérente avec la charte Nowadays.
- Les prompts s'appuient sur le verbatim du discovery / de la proposition (déjà cités dans le prompt système), pas sur des suppositions.
- Format JSON identique aux autres phases.

**2. Orchestration côté frontend (`ClaudeProjectExport.tsx`)**

Modifier `handleGenerate` pour appeler la nouvelle Phase 'K' **avant** Phase A :

```
système → Phase K (kick-off) → Phase A (recherche) → Phase B (stratégie) → Phase C (production)
```

Mettre à jour :
- L'enum `step` : ajouter `'phase_k'`
- Le label de progression : « Phase Kick-off : préparation de l'atelier... »
- L'interface `PromptChainItem` : étendre `phase` à `'K' | 'A' | 'B' | 'C'`
- Les constantes `PHASE_COLORS` et `PHASE_LABELS` : ajouter `K: 'Kick-off'` (couleur ex. ambre/rose)
- Passer la liste des prompts Phase K en `previous_prompts` aux phases suivantes pour qu'elles sachent qu'il existe déjà des étapes amont.

**3. Compatibilité données existantes**

Les kits déjà générés (en base `claude_projects`) n'ont pas de Phase K. Le frontend doit continuer à les afficher correctement (les badges `K` n'apparaissent que sur les nouvelles générations). Aucune migration nécessaire.

### Détails techniques

- **Fichier edge function** : `supabase/functions/generate-claude-project-chain/index.ts` — ajouter `PHASE_PROMPTS.K` et accepter `phase === 'K'` dans la validation.
- **Fichier frontend** : `src/components/followup/ClaudeProjectExport.tsx` — ajouter l'étape Phase K dans `handleGenerate`, étendre les types et constantes, ajuster les labels.
- **Pas de changement** : `generate-claude-project` (prompt système), schéma DB, autres composants.

### Comportement utilisateur

Après génération, la prompt chain affichera dans l'ordre :
1. `[Phase K] Questions d'atelier kick-off` (chat)
2. `[Phase K] Support de l'atelier kick-off` (.docx)
3. `[Phase A] ...` (recherche)
4. `[Phase B] ...` (stratégie)
5. `[Phase C] ...` (production)

Laetitia coche les deux premiers prompts une fois l'atelier passé, puis continue la chaîne normalement.

