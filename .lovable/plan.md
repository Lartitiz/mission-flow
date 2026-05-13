## Problème

Dans la fiche structurée de l'appel découverte, l'IA confond Laetitia (la consultante qui mène l'appel) avec la prospect interviewée. Résultat : "Laetitia Mattioli" apparaît partout alors que la cliente est Violaine.

La cause : le system prompt de `structure-discovery-notes` présente Laetitia comme la fondatrice mais ne précise jamais clairement que **le sujet de la fiche est le/la prospect**, pas Laetitia. De plus, le nom du/de la prospect n'est pas transmis à l'IA.

## Correctif

### 1. `supabase/functions/structure-discovery-notes/index.ts`
- Ajouter une **règle de cadrage** très explicite en tête du system prompt :
  > « Le/la prospect interviewé·e dans ces notes s'appelle **{client_name}**. C'est ELLE/IL le sujet de la fiche. Laetitia est la consultante qui mène l'appel — elle ne doit JAMAIS apparaître comme sujet d'une section, sauf dans "Prochaines étapes" pour ses propres actions. »
- Accepter un nouveau paramètre `client_name` dans le body.
- L'injecter dans le `userPrompt` : `Prospect interviewé·e : {client_name}`.

### 2. `src/components/discovery/DiscoveryTab.tsx`
- Passer `client_name: clientName` dans `supabase.functions.invoke('structure-discovery-notes', { body: ... })`.

### 3. Re-générer la fiche actuelle
Une fois corrigé, Laetitia pourra simplement re-cliquer sur **"Structurer mes notes"** pour obtenir une version corrigée (l'ancienne fiche reste éditable manuellement en attendant).

## Hors scope
- Pas de changement sur la structuration kick-off ni session (à vérifier séparément si le même bug s'y produit — dis-moi si tu veux que j'y applique le même correctif).
- Pas de changement de modèle ni de format de sortie.
