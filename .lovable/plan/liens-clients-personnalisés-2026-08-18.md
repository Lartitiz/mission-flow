# Liens clients personnalisés

Aujourd'hui le lien envoyé aux clientes ressemble à :
`.../client/8f3c1a2e-...-9b7d` — illisible et impersonnel.

Objectif : un lien qui porte le nom de la cliente, tout en restant privé.

## Nouveau format

```text
https://nowadays-mission-flow.lovable.app/client/adeline-durand/8f3c1a2e...
                                                  ↑ nom lisible   ↑ clé d'accès
```

Le nom rend le lien reconnaissable ; la clé reste ce qui protège l'espace
(sans elle, aucun accès). Les anciens liens déjà envoyés continuent de
fonctionner.

## Ce qui change dans l'app

- **Nom du lien modifiable** : dans la fiche mission, à côté du nom de la
  cliente, un champ « adresse du lien » (ex. `adeline-durand`, `studio-violaine`)
  qu'on peut éditer. Vérification d'unicité et normalisation automatique
  (minuscules, tirets, sans accents).
- **Dialogue « Lien client »** : affiche et copie le nouveau lien joli.
- **Email de lancement** et **récap mission** : utilisent le même lien.
- **Espace client** : accessible via `/client/:slug/:token` et toujours via
  `/client/:token`.

## Détails techniques

- Route ajoutée dans `src/App.tsx` : `/client/:slug/:token`, `ClientView` lit le
  dernier segment comme token (aucun changement de logique d'accès).
- `get-client-space` reste inchangé : validation par `client_token` UUID
  uniquement, le slug n'est jamais une clé d'accès.
- Édition du slug : mise à jour de `missions.client_slug` avec normalisation
  côté client + contrainte d'unicité en base ; message d'erreur si déjà pris.
- Fichiers touchés : `src/App.tsx`, `src/pages/MissionDetail.tsx`,
  `src/components/mission/ClientLinkDialog.tsx`,
  `src/components/mission/LaunchEmailDialog.tsx`, et l'edge function
  `send-mission-recap` pour l'URL du lien.
