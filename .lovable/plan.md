

## Fix dictée vocale qui s'efface au fur et à mesure

### Problème

Quand tu dictes plusieurs phrases d'affilée, les nouveaux morceaux **remplacent** les précédents au lieu de s'ajouter. La dictée semble « se manger elle-même ».

### Cause

Dans `NotesEditor.tsx`, le callback passé à la dictée vocale lit `notes` depuis une closure :

```ts
onResult: (transcript) => {
  const newNotes = notes ? `${notes} ${transcript}` : transcript;
  onChange(newNotes);
}
```

Le hook `useSpeechRecognition` garde bien la dernière version du callback en ref (bien joué), mais cette dernière version voit toujours la **valeur de `notes` au moment du dernier render**. Si deux transcripts arrivent rapprochés (avant que le parent re-rende avec la nouvelle valeur sauvegardée), le second lit la même `notes` initiale → il écrase le premier.

C'est typique des saisies parent contrôlées avec sauvegarde asynchrone : le state remonte, redescend en prop, mais le timing entre deux events Web Speech est plus court que le cycle parent.

### Solution

Lire la valeur **fraîche** de `notes` au moment où le transcript arrive, via un ref synchronisé à chaque render — pattern déjà utilisé pour le callback dans le hook lui-même.

**Fichier modifié** : `src/components/discovery/NotesEditor.tsx`

```tsx
const notesRef = useRef(notes);
useEffect(() => { notesRef.current = notes; }, [notes]);

const { isListening, isSupported, toggle } = useSpeechRecognition({
  onResult: (transcript) => {
    const current = notesRef.current;
    const newNotes = current ? `${current} ${transcript}` : transcript;
    notesRef.current = newNotes;        // mise à jour optimiste immédiate
    onChange(newNotes);
  },
});
```

La mise à jour optimiste de `notesRef.current` juste avant `onChange` garantit que **deux transcripts qui arrivent dans la même milliseconde** s'enchaînent correctement, sans attendre le re-render parent.

### Pas de changement nécessaire

- `useSpeechRecognition.ts` : déjà robuste (ref callback + auto-restart 60s).
- `DiscoveryTab.tsx`, `KickoffTab.tsx`, `SessionHistory.tsx` : continuent d'utiliser `NotesEditor` tel quel.

### Résultat attendu

Tu peux dicter en continu pendant 5, 10, 30 minutes : chaque phrase finalisée s'ajoute proprement à la fin des notes existantes, sans jamais en écraser.

