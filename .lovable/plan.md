

## Correction : persistance des actions client dans l'espace membre

### Problème identifié

L'edge function `update-client-action` cherche la mission uniquement par `client_token` (UUID). Or, si le client accède via un slug (URL courte), le paramètre `token` est un slug, pas un UUID — la requête ne trouve rien et l'update échoue silencieusement.

De plus, le frontend ne vérifie pas la réponse de l'edge function, donc l'UI affiche "fait" alors que rien n'a été sauvegardé.

### Plan

**1. Corriger `supabase/functions/update-client-action/index.ts`**

Appliquer la même logique que `get-client-space` : détecter si le token est un UUID ou un slug, et requêter le bon champ.

```typescript
const isUuid = /^[0-9a-f]{8}-...$/i.test(token);
const query = supabase.from("missions").select("id, client_link_active");
const { data: mission } = isUuid
  ? await query.eq("client_token", token).single()
  : await query.eq("client_slug", token).single();
```

Ajouter aussi la vérification `client_link_active` comme dans `get-client-space`.

**2. Corriger `src/pages/ClientView.tsx` — gestion d'erreur**

Dans `handleToggleAction` et `handleSaveComment`, vérifier que la réponse de l'edge function ne contient pas d'erreur avant de mettre à jour le state local :

```typescript
const { data: result, error } = await supabase.functions.invoke('update-client-action', { ... });
if (error || result?.error) throw new Error(result?.error || 'Erreur');
```

### Fichiers modifiés
- `supabase/functions/update-client-action/index.ts` — support slug + vérification lien actif
- `src/pages/ClientView.tsx` — gestion d'erreur sur les réponses d'update

