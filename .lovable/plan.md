## Audit du mode Questionnaire (Kick-off)

### Ce qui marche déjà
- Les questions IA générées **sont bien sauvegardées** en base (`kickoffs.ai_questions`).
- Les cases cochées **sont bien sauvegardées** (`kickoffs.fixed_questions` inclut `ai_0`, `ai_1`, etc.).
- Le mode `questionnaire` est conservé.
- Au rechargement, le `useEffect` dans `KickoffTab` remet bien tout en state.

→ Vérifié sur ta mission en cours : 17 questions IA + 12 cases cochées présentes en DB.

### Les vrais problèmes

**1. Le lien d'envoi est caché tant que tu n'as pas cliqué "Envoyer"**

Aujourd'hui, à droite, tu vois `QuestionnairePreview` (aperçu + gros bouton "Envoyer le questionnaire"). Le **lien à copier/partager n'apparaît qu'après** ce clic, dans `QuestionnaireStatus`. C'est contre-intuitif : tu cherches "où est le lien" sans réaliser qu'il faut d'abord "envoyer".

**2. Le bouton "Envoyer" disparaît si rien n'est coché**

`QuestionnairePreview` affiche un état vide ("Coche des questions à gauche…") sans aucune action visible. Ça donne l'impression qu'il manque quelque chose.

**3. Le clic "Envoyer" ne propose pas de copier le lien tout de suite**

Le toast dit "Copie le lien pour l'envoyer à {client}" mais ne **donne pas le lien** ni un bouton pour le copier dans le toast. Il faut scroller pour le trouver.

**4. Pas de feedback visuel "questions sauvegardées"**

Quand tu coches une case, la sauvegarde est debouncée (500 ms) sans indicateur visible — tu ne sais pas que c'est gardé.

**5. Régénérer les questions IA écrase tout**

Cliquer "Générer les questions" remplace **complètement** `ai_questions`, donc tu perds tes ajouts manuels et tes cases cochées sur les anciennes IA. Risque réel de perte si tu cliques pour "ajouter" alors que ça remplace.

**6. Lecture seule des questions cochées via `ai_${idx}`**

Les cases IA sont indexées par position (`ai_0`, `ai_1`…). Si on régénère, l'ordre change et `ai_0` ne désigne plus la même question → cases mal alignées avec questions différentes. Bug subtil.

---

### Améliorations proposées

**A. Toujours afficher le bloc "Lien du questionnaire" à droite, dès le mode questionnaire**

Nouveau bloc en haut de la colonne droite (visible en `draft`, `ready`, `sent`, `completed`) :
- Lien public (`/questionnaire/{token}`) toujours affiché
- Bouton "Copier le lien" + bouton "Aperçu" (ouvre l'URL)
- Badge de statut (Brouillon / Envoyé / Complété)
- Compteur "X questions sélectionnées"

**B. Bouton "Marquer comme envoyé" séparé du lien**

Ne plus cacher le lien derrière l'action "Envoyer". Garder un bouton secondaire "Marquer comme envoyé à {client}" qui passe juste le statut → utile pour suivre les relances, mais le lien est dispo immédiatement.

**C. Toast d'envoi avec lien copié automatiquement**

Au clic "Marquer comme envoyé" : copier le lien dans le presse-papier + toast "Lien copié, prêt à coller dans ton mail".

**D. Indicateur "Sauvegardé ✓" à côté du titre des questions**

Petit texte gris qui passe à "Sauvegarde…" pendant le debounce, puis "Sauvegardé ✓" — déjà géré par `isSaving` dans le hook, juste à afficher.

**E. Régénération IA : bouton "Ajouter" vs "Remplacer"**

Au clic "Générer les questions", si des questions IA existent déjà, ouvrir un mini-dialog : "Ajouter aux existantes" (par défaut) ou "Remplacer". Préserve les sélections.

**F. Stabiliser l'ID des questions IA**

Au lieu de `ai_${idx}`, hasher le texte (ou générer un UUID court à la création) et l'utiliser comme clé dans `fixed_questions`. Une régénération qui change l'ordre ne casse plus les cases cochées.

---

### Priorisation suggérée

- **P0** (vrai bug visible) : A, C — afficher le lien immédiatement, copier auto à l'envoi.
- **P1** (UX) : B, D — séparer "envoyer" du lien, feedback de sauvegarde.
- **P2** (robustesse) : E, F — éviter la perte de sélections en régénération.

### Fichiers touchés

- `src/components/kickoff/KickoffTab.tsx` — réorganiser la colonne droite, fusionner Preview + Status
- `src/components/kickoff/QuestionnairePreview.tsx` — refonte (intégrer le lien)
- `src/components/kickoff/QuestionnaireStatus.tsx` — peut être absorbé dans Preview
- `src/components/kickoff/KickoffQuestions.tsx` — indicateur sauvegarde, dialog "ajouter/remplacer"
- (P2) `src/hooks/useKickoff.ts` + `supabase/functions/get-questionnaire/index.ts` — migration douce des clés `ai_${idx}` vers IDs stables

Pas de changement DB requis pour P0/P1.

### Question pour toi

Tu veux que j'implémente quoi maintenant ?
1. Juste **P0 + P1** (le lien visible tout de suite + UX d'envoi propre)
2. **P0 + P1 + P2** (tout, y compris robustesse de la régénération)
3. Que P0 (le plus urgent : voir le lien)
