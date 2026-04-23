

## Téléchargement des instructions « Ateliers Binôme » depuis le kit Claude

### Idée

Quand Laetitia génère le kit Claude d'une cliente en accompagnement « Binôme » (mission_type `done_with_you`), elle a besoin d'ajouter au projet Claude un **document d'instructions statique** qui apprend à Claude comment préparer les trames d'ateliers mensuels (boussole émotionnelle, scripts, banque d'exos, plan B, etc.).

Ce document est le même pour toutes les clientes binôme — c'est un **template réutilisable**, pas un livrable généré par l'IA. Il faut donc juste pouvoir le **télécharger en un clic** depuis le bloc « Kit projet Claude ».

### Plan

**1. Stocker le fichier comme asset statique du projet**

- Copier `instructions-ateliers-binome-nowadays_2.md` dans `public/assets/instructions-ateliers-binome.md`.
- Renommer proprement, sans suffixe `_2`.
- Aucune transformation : c'est un .md prêt à coller dans Claude.

**2. Ajouter un bouton de téléchargement dans `ClaudeProjectExport.tsx`**

À côté du bouton « Exporter en .md » (en haut du bloc, ligne ~380), ajouter un nouveau bouton **« Instructions ateliers (binôme) »** :

- Icône : `BookOpen` (lucide-react)
- Action : `fetch('/assets/instructions-ateliers-binome.md')` puis `saveAs` (file-saver, déjà importé) → fichier `Instructions_Ateliers_Binome.md`.
- Toast de confirmation.

**3. Affichage conditionnel intelligent**

Ce document n'est utile que pour les missions de type binôme. On le récupère via la query `readiness` existante, on lit `mission_type` :

- Si `mission_type === 'done_with_you'` → bouton visible toujours (même avant génération du kit).
- Sinon → bouton masqué.

Étendre la query `readiness` pour récupérer `mission_type` depuis la table `missions`.

**4. Petite note explicative**

Sous le bouton, un mini-texte (12px, muted) :  
*« À glisser dans les fichiers du projet Claude de ta cliente, en plus du prompt système. »*

### Comportement utilisateur

Sur l'onglet Suivi d'une mission binôme :

```text
┌─ Kit projet Claude ──────────────────────────────────┐
│                          [Exporter en .md] [📖 Instructions ateliers] │
│                                                      │
│  Prompt système                                     │
│  Prompt chain (Phase K → A → B → C)                 │
│  Alertes                                            │
└──────────────────────────────────────────────────────┘
```

Pour les missions non-binôme (done_for_you, co_creation), seul le bouton « Exporter en .md » apparaît.

### Détails techniques

- **Nouveau fichier** : `public/assets/instructions-ateliers-binome.md` (copie de l'upload).
- **Fichier modifié** : `src/components/followup/ClaudeProjectExport.tsx` :
  - ajout d'une fonction `downloadAtelierInstructions()`
  - extension de la query `readiness` pour inclure `mission_type`
  - rendu conditionnel du bouton selon `mission_type === 'done_with_you'`
- **Pas de changement** : edge functions, base de données, autres composants.

### Évolution possible (non incluse)

Si plus tard d'autres types de missions ont leurs propres instructions (done_for_you, co_creation), on pourra ajouter d'autres assets statiques avec la même logique conditionnelle.

