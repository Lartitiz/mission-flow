## Objectif

Ajouter dans le prompt système des projets Claude générés une règle claire :

- Les **livrables destinés à la cliente** s'adressent à elle directement au **« vous »** (Laetitia les transmettra tels quels).
- Quand Laetitia s'exprime, c'est au **« je »** — pas de « nous », pas d'« équipe ». Nowadays Agency = Laetitia seule.

## Modifications

### 1. `supabase/functions/generate-claude-project/index.ts`

Dans le `SYSTEM_PROMPT`, enrichir la section **« Ton et style »** (règles 8-12) avec deux nouvelles règles :

```
12bis. Adresse des livrables — TOUS les documents/messages destinés à être transmis 
      à la cliente s'adressent à elle au « tu » (ou « vous » si Laetitia l'a précisé 
      dans le contexte client). Ne jamais écrire un livrable client à la 3e personne 
      ou de manière générique.

12ter. Voix de Laetitia — quand un texte est signé/porté par Laetitia (édito, 
      message, mail, intro de doc), c'est TOUJOURS au « je ». Jamais « nous », 
      jamais « notre équipe », jamais « chez Nowadays on… ». 
      Nowadays Agency = Laetitia seule, pas une équipe.
```

Préciser aussi en tête de la section CONTEXTE CLIENT que le champ « Ton » indique le registre que Laetitia utilise avec **sa cliente** (tu/vous), à ne pas confondre avec la voix des livrables (toujours « je » côté Laetitia).

### 2. Hors scope

- Pas de modif de `generate-claude-project-chain` (les prompts de phase héritent du prompt système, donc la règle s'applique automatiquement quand le projet Claude tourne).
- Pas de changement de modèle ni de structure des sections.

## Vérification

Régénérer le kit Claude sur la mission Cindy et vérifier que la section « Ton et style » contient bien les deux nouvelles règles « vous » / « je ».