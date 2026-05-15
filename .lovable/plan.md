## Audit persistance — Questionnaire kick-off

### Ce qui marche déjà

Vérifié dans `useKickoff.ts` + `KickoffTab.tsx` :

1. **Cases cochées** (`fixed_questions`) → `saveField` debouncé 500 ms.
2. **Questions IA générées** → `saveImmediate({ ai_questions })` (instantané, pas de debounce).
3. **Ajout/suppression de question manuelle** → `saveField` debouncé 500 ms.
4. **Toggle questions déclic** → `saveImmediate` (instantané).
5. **Mode visio/questionnaire** → `saveImmediate` (instantané).
6. **Flush sur démontage** : un `useEffect` cleanup envoie les écritures en attente si tu changes d'onglet ou navigues avant la fin du debounce.
7. **DB confirmée** : sur ta mission actuelle, 17 questions IA + 12 cases cochées bien stockées.

→ Donc en navigation normale (changement d'onglet, retour plus tard) : **rien n'est perdu**.

---

### Les vrais trous (rares mais réels)

**Trou 1 — Refresh dur (F5) pendant la fenêtre de 500 ms**

`saveField` (cases cochées + édition liste IA) attend 500 ms avant d'écrire. Le cleanup `useEffect` flush bien les valeurs en attente quand React démonte le composant — mais sur un **refresh navigateur (F5, fermeture d'onglet)**, React n'a pas le temps de démonter proprement. Si tu coches une case puis tu fais F5 dans la demi-seconde, la coche est perdue.

**Trou 2 — Pas de garde "beforeunload"**

Aucun listener ne détecte la fermeture d'onglet/refresh pour avertir ou flusher synchroneusement.

**Trou 3 — Auto-création silencieuse → risque de doublon kickoff**

Quand tu arrives sur une mission sans kickoff, le hook crée automatiquement la ligne `kickoffs`. Le `creatingRef` empêche les doublons **dans la même instance React** mais pas si :
- 2 onglets ouverts simultanément sur la même mission, ou
- React StrictMode qui monte deux fois en dev.

Pas de contrainte UNIQUE sur `kickoffs.mission_id` en DB → des doublons peuvent se créer. La requête utilise déjà `.order('created_at').limit(1)` (tu prends toujours le premier), donc tu ne **perds** pas les données mais elles peuvent se retrouver "coincées" sur un kickoff orphelin si un doublon est créé après coup.

**Trou 4 — Race "régénération IA pendant écriture cochée en attente"**

Si tu coches `ai_3` puis cliques "Générer" dans les 500 ms : la régénération écrase `ai_questions` immédiatement, mais ton `fixed_questions` débouncé contient encore l'ancien `ai_3`. Quand il flush, il garde la coche pour un index qui pointe maintenant vers une autre question. (C'est aussi le P2-F déjà identifié au tour précédent.)

**Trou 5 — Erreur de sauvegarde silencieuse**

Si `updateMutation` échoue (réseau coupé, erreur serveur), l'erreur n'affiche **aucun toast** à l'utilisateur. Tu crois avoir sauvegardé, en réalité non.

---

### Améliorations proposées

**A. Réduire le debounce à 250 ms pour `fixed_questions` et `ai_questions`** (édition liste).
Les cases sont des micro-actions ponctuelles, pas du texte continu — pas besoin de 500 ms. Ça réduit drastiquement la fenêtre de risque sur F5.

**B. Ajouter un handler `beforeunload` qui flush les écritures pendantes**
Si `pendingFieldsRef.current` ou `pendingNotesRef.current` est non-null, déclencher un fetch synchrone (ou utiliser `navigator.sendBeacon`) avant que la page parte. Bloque la fermeture < 50 ms, invisible pour l'utilisateur.

**C. Indicateur "Sauvegarde…/Sauvegardé ✓" déjà ajouté** au tour précédent → garder.
Possibilité d'ajouter un state "Erreur — réessayer" si la mutation échoue.

**D. Toast d'erreur sur échec de mutation**
Dans `useKickoff`, ajouter `onError` à `updateMutation` → toast "Sauvegarde échouée, réessaie".

**E. Contrainte UNIQUE `kickoffs.mission_id`** (migration)
Empêche définitivement les doublons. Combiné à un `.upsert` côté hook, ça nettoie le cas multi-onglets / StrictMode.

**F. Backup local en sessionStorage** (ceinture + bretelles)
À chaque `saveField`, écrire aussi dans `sessionStorage[kickoff:{id}]`. Au remount, si la DB est vide mais sessionStorage contient quelque chose de plus récent → restaurer + retoaster "Brouillon local restauré". Surtout utile si la DB a un hoquet.

---

### Priorisation

- **P0** (refresh F5 perd des coches) : **A + B** — debounce 250 ms + beforeunload flush. Petit changement, gros effet.
- **P1** (visibilité erreurs) : **D** — toast d'erreur explicite.
- **P2** (robustesse long terme) : **E** — contrainte UNIQUE + upsert.
- **P3** (paranoïa) : **F** — backup sessionStorage. Probablement overkill si A+B+D sont en place.

### Fichiers touchés

- `src/hooks/useKickoff.ts` — debounce 250 ms, `beforeunload` listener, `onError` toast.
- (P2) Migration DB pour la contrainte unique + adaptation du hook (upsert).

### Question pour toi

Tu veux quoi ?
1. **Juste P0** (le vrai bug : protéger contre F5)
2. **P0 + P1** (P0 + erreurs visibles)
3. **P0 + P1 + P2** (tout solidifier, avec migration DB)
