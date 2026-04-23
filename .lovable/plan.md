
## Rendre la dictée robuste quand tu changes d’onglet

### Point important

On ne peut pas garantir que le navigateur continue à écouter le micro pendant qu’un autre onglet est actif : c’est une limite du Web Speech API / des navigateurs. En revanche, on peut faire en sorte que :

- rien de déjà transcrit ne disparaisse
- les notes soient sauvegardées tout de suite, pas seulement après 2s
- la dictée reprenne automatiquement quand tu reviens sur l’onglet
- si le navigateur bloque la reprise, l’interface te le dise clairement

### Plan

**1. Renforcer `useSpeechRecognition` pour les changements d’onglet**

Dans `src/hooks/useSpeechRecognition.ts` :

- ajouter une vraie notion d’“intention d’écoute” (`shouldListenRef`) séparée de l’état visuel `isListening`
- gérer `visibilitychange` :
  - quand l’onglet passe en arrière-plan, arrêter proprement la reconnaissance pour éviter les états cassés
  - quand l’onglet redevient visible, tenter une reprise automatique si l’utilisateur était en train de dicter
- fiabiliser `onend` :
  - redémarrer seulement si l’utilisateur n’a pas cliqué sur stop
  - éviter les boucles de restart quand le navigateur a suspendu la reconnaissance
- gérer explicitement les erreurs de reprise (`NotAllowedError`, `InvalidStateError`) et exposer un état du type `restartBlocked`

Résultat : la dictée ne “saute” plus silencieusement au retour sur l’onglet.

**2. Ajouter une persistance locale immédiate dans `NotesEditor`**

Dans `src/components/discovery/NotesEditor.tsx` :

- conserver la logique actuelle avec `notesRef`
- ajouter une persistance locale immédiate à chaque frappe / transcript (clé de brouillon dédiée)
- restaurer automatiquement le brouillon local au montage s’il est plus récent que ce qui vient du backend
- déclencher un flush immédiat quand la page devient cachée ou quitte l’écran (`visibilitychange`, `pagehide`, éventuellement `beforeunload`)

Objectif : même si le navigateur throttle les timers ou coupe la dictée en arrière-plan, le texte déjà capté reste présent et récupérable.

**3. Ne plus dépendre uniquement des sauvegardes debouncées**

Aujourd’hui, découverte et kick-off sauvegardent avec debounce 2s. Il faut ajouter un chemin de sauvegarde immédiat.

- `src/hooks/useDiscoveryCall.ts` :
  - exposer une méthode de flush immédiat des notes (`flushNotesNow` ou équivalent)
  - garder le debounce pour le confort, mais permettre à `NotesEditor`/au parent de pousser tout de suite avant perte de focus page

- `src/hooks/useKickoff.ts` :
  - même principe : une méthode de flush immédiat des notes
  - garder le pattern existant de pending refs

Résultat : au changement d’onglet, les dernières phrases déjà reçues ne restent pas “en attente” dans un timer de 2 secondes.

**4. Corriger aussi le cas des notes de session**

`SessionHistory.tsx` utilise aussi `NotesEditor`, mais sa logique locale mérite d’être durcie :

- remplacer le flush on unmount basé sur une closure figée par une version avec ref (`localNotesRef`)
- ajouter un flush immédiat des notes de la session ouverte quand la page passe en arrière-plan
- brancher la persistance locale avec une clé par session

Résultat : même comportement robuste sur l’historique des sessions, pas seulement en découverte/kick-off.

**5. Ajouter un retour UI clair**

Dans `NotesEditor.tsx` :

- si la dictée est interrompue par un changement d’onglet et reprend : petit état discret “Dictée reprise”
- si la reprise auto est bloquée par le navigateur : message clair du type  
  “La dictée se met en pause quand tu quittes l’onglet. Reviens ici puis clique pour reprendre.”
- conserver le statut de sauvegarde existant

Ça évite l’impression que “ça continue” alors que le navigateur a mis le micro en pause.

### Fichiers concernés

- `src/hooks/useSpeechRecognition.ts`
- `src/components/discovery/NotesEditor.tsx`
- `src/hooks/useDiscoveryCall.ts`
- `src/hooks/useKickoff.ts`
- `src/components/discovery/DiscoveryTab.tsx`
- `src/components/kickoff/KickoffTab.tsx`
- `src/components/followup/SessionHistory.tsx`

### Comportement attendu après correction

```text
Tu dictes
→ chaque morceau transcrit est ajouté et stocké localement tout de suite
→ si tu changes d’onglet, ce qui a déjà été capté reste sauvegardé
→ au retour sur l’onglet, la dictée reprend automatiquement si possible
→ sinon l’app te demande explicitement de cliquer pour reprendre
→ aucune note déjà transcrite ne disparaît
```

### Détail technique

- Limite navigateur assumée : pas de “dictée en continu dans un autre onglet”
- Garantie visée : persistance du texte déjà reçu + reprise fiable au retour
- Architecture :
  - `useRef` pour intention d’écoute et derniers contenus
  - sauvegarde locale immédiate
  - flush backend sur masquage de page
  - reprise conditionnelle de la reconnaissance à la re-visibilité

### Validation

Tester sur les 3 usages qui emploient `NotesEditor` :

1. **Découverte** : dicter, changer d’onglet 5–10 s, revenir  
2. **Kick-off** : idem  
3. **Session** : idem  

Critères de succès :
- aucune phrase déjà transcrite ne disparaît
- le texte est encore là après retour onglet
- la dictée reprend, ou demande clairement une action
- pas de doublons lors de la reprise
