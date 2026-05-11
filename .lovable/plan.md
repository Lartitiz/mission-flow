## Objectif

Dans l'espace client (`ClientView.tsx`), réduire le poids visuel des sessions :
1. Afficher un **résumé ultra-court** généré par IA (pas les `structured_notes` complètes).
2. **Replier automatiquement** les sessions passées : seule la plus récente est dépliée par défaut, les autres apparaissent en ligne compacte cliquable.

## Ma recommandation pour le "cocher"

Plutôt qu'une case à cocher (qui ajoute une action côté client·e et un état à gérer), **repli automatique** : la session la plus récente est ouverte, les précédentes sont condensées en une ligne (date + type + résumé 1 phrase) qu'on peut déplier au clic. C'est plus fluide, ça allège visuellement sans rien demander à la cliente, et ça reste cohérent avec le reste de l'espace.

## Ce qu'on construit

### 1. Génération du résumé court (IA)

- Nouvelle edge function `summarize-session-for-client`
  - Input : `structured_notes` ou `raw_notes` d'une session
  - Output : objet `client_summary` = `{ headline: string, bullets: string[] }`
    - `headline` : 1 phrase qui dit ce qu'on a fait/décidé (≤ 140 car.)
    - `bullets` : 2-4 puces très courtes (≤ 80 car. chacune), orientées client·e (décisions / prochaines étapes / livrables)
  - Filtre : aucune mention budget, heures, marges, notes internes
  - Modèle : `claude-sonnet-4` (rapide, suffisant pour synthèse)
  - Ton : warm, "tu", inclusif, pas de jargon (selon mémoire projet)

- Nouvelle colonne `sessions.client_summary jsonb` (nullable)

- Déclenchement :
  - Bouton dans `SessionHistory.tsx` (côté admin) "Générer le résumé client" sur chaque session structurée
  - Génération automatique juste après la structuration IA d'une session (dans le flux existant `structure-session-notes`)
  - Si `client_summary` est vide côté client view → fallback sur les `structured_notes` existantes (compatibilité)

### 2. Affichage condensé dans `ClientView.tsx`

Remplacer le bloc `sessionsBlock` (lignes 806-831) par :

- Session la plus récente (index 0) : **dépliée**
  - Date + type
  - `headline` en gras
  - `bullets` en liste courte
  - (si pas de `client_summary` → afficher `structured_notes` comme aujourd'hui mais limité à 2 sections max)

- Sessions précédentes : **repliées** par défaut
  - Ligne unique : `date · type · headline tronquée`
  - Caret/chevron à droite, clic pour déplier/replier
  - État local `expandedSessionIds: Set<string>` dans le composant

### 3. Côté admin (mineur)

Dans `SessionHistory.tsx`, afficher le `client_summary` généré avec un bouton "Régénérer" pour que Laetitia puisse contrôler ce que voit la cliente.

## Détails techniques

- **Migration** : `ALTER TABLE sessions ADD COLUMN client_summary jsonb;`
- **Edge function** : `supabase/functions/summarize-session-for-client/index.ts`, `verify_jwt = false`, auth manuelle via token client (cohérent avec les autres fonctions du projet).
- **Edge function existante** `get-client-space` : ajouter `client_summary` au payload retourné pour chaque session (à côté de `structured_notes`).
- **Type `ClientSession`** dans `ClientView.tsx` : ajouter `client_summary?: { headline: string; bullets: string[] } | null`.
- **UI repli** : caret `lucide-react` `ChevronDown` / `ChevronUp`, transition CSS simple (pas d'`Accordion` shadcn pour rester dans le style "papier" inline déjà utilisé).
- **Pas de case à cocher**, pas de nouvel état persisté côté client·e.

## Hors-scope

- Pas de touchage du flux interne admin (`KickoffStructuredNotes`, `SessionHistory` reste presque identique).
- Pas de regénération en masse rétroactive automatique : Laetitia déclenche manuellement pour les sessions existantes via le bouton.
