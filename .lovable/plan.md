# Téléchargement des réponses + flux kit Claude

## Réponse à ta 2e question

**Oui, les réponses servent bien au kit projet Claude — mais via une étape intermédiaire.**

Le flux exact :
1. Client·e remplit le questionnaire → `kickoffs.questionnaire_responses` (JSON brut)
2. Tu cliques **"Structurer les réponses"** → Claude transforme ça en sections lisibles → `kickoffs.structured_notes`
3. Lors de la génération du kit projet Claude, c'est `structured_notes` (+ `raw_notes` si dictés en mode visio) qui est injecté dans le contexte.

⚠️ Donc si tu oublies l'étape 2, les réponses du questionnaire **ne sont pas reprises** dans le kit Claude. Veux-tu que je rende cette structuration **automatique** dès soumission du questionnaire ? (à valider, pas inclus par défaut dans ce plan)

## Ce que je vais faire

Ajouter un bouton **"Télécharger en .md"** dans le bloc "Questionnaire client·e" de l'onglet Kick-off, visible uniquement quand le statut est `completed`.

### Comportement

- Génération **côté client** (pas d'edge function nécessaire), à partir des données déjà chargées
- Format Markdown structuré par thème, avec date de complétion en en-tête :
  ```md
  # Questionnaire — {client_name}
  Complété le 12 mai 2026

  ## Ton histoire
  **Quelle est ton histoire ?**
  …réponse…

  **As-tu des anecdotes ?**
  …réponse…

  ## Ton identité
  …
  ```
- Nom de fichier : `questionnaire-{client_slug}-{YYYY-MM-DD}.md`
- Téléchargement direct via Blob + `<a download>` (zéro dépendance ajoutée)

### Détails techniques

**Fichier modifié : `src/components/kickoff/QuestionnaireStatus.tsx`**
- Ajouter prop `clientName: string` (passée depuis `KickoffTab.tsx`)
- Ajouter une constante locale qui re-déclare la liste des questions fixes/déclic + leur thème (même structure que `get-questionnaire/index.ts`) pour résoudre `questionId → texte + thème`. Pour les questions IA (`ai_*`), récupérer le texte depuis `kickoff.ai_questions`.
- Nouveau bouton à côté de "Structurer les réponses", icône `Download` (lucide-react), variant `outline`
- Handler `handleDownload()` : construit la string MD, crée un Blob `text/markdown`, déclenche le téléchargement

**Fichier modifié : `src/components/kickoff/KickoffTab.tsx`**
- Passer `clientName={mission.client_name}` au composant `QuestionnaireStatus`

### Hors scope
- Pas de modification de la structuration ni du flux Claude
- Pas d'export PDF/DOCX (MD demandé)
- Pas d'auto-structuration à la soumission (à confirmer séparément si tu le veux)
