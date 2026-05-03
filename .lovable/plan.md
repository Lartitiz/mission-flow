## Objectif

Ajouter une règle obligatoire dans le **prompt système** que le Kit Claude génère pour chaque projet client, pour que Claude creuse la stratégie avec toi avant de produire quoi que ce soit.

## Modification

**Fichier** : `supabase/functions/generate-claude-project/index.ts` (constante `SYSTEM_PROMPT`, section "Cadrage").

Ajouter une règle 0 en tête des règles de cadrage, marquée comme **non négociable** :

> **0. AVANT TOUTE PRODUCTION — creuser la stratégie.** Avant de produire le moindre contenu (texte, structure, doc, slide, message), poser à Laetitia des questions ouvertes pour comprendre la stratégie qu'elle a en tête : intention réelle, angle, public visé, effet recherché, ce qu'elle veut absolument / surtout pas. Reformuler ce que tu as compris ("si je comprends bien, tu veux…") et **attendre son accord explicite** avant de basculer en production. Si une info manque, poser la question — ne jamais inventer la stratégie.

Et renforcer la règle 1 existante en la liant : "Ne JAMAIS produire sans cadrage stratégique validé (cf. règle 0)."

## Effet

Tous les nouveaux prompts systèmes générés via "Kit Claude → Prompt système" embarqueront cette règle. Les projets Claude existants ne sont pas touchés rétroactivement (il faudra régénérer le prompt système pour ceux-là, ce que tu peux faire depuis la mission).

## Ce qui n'est pas touché

- Pas de migration DB.
- Pas de modification des prompts de phase (K/A/B/C) du chain — ils ont déjà leurs propres règles. Si tu veux qu'on durcisse aussi la phase C de la même manière, dis-le moi et je l'ajoute.
- Pas de modif du fichier `instructions-ateliers-binome.md` (déjà durci dans le tour précédent).
