## Diagnostic complet

J'ai comparé visuellement les deux PDF page par page. Le fond ET la forme divergent.

### Gap de fond (contenu généré)

| Élément | Cible | Actuel |
|---|---|---|
| Sections | 10 (diagnostic ≠ recos, écosystème, CTA) | 6 fusionnées |
| Verbatims du/de la prospect | Cités en italique partout | Absents |
| Diagnostic vs recos | 2 sections distinctes (5 blocages + 6 axes) | Fusionnées |
| Section écosystème | « Et [partenaire] dans tout ça ? » | Inexistante |
| Section CTA finale | « Ça te parle ? » + signature en encart | Inexistante |
| Encart engagement honnête | Présent | Inexistant |
| Profondeur | Paragraphes denses (10-15 lignes) | Courts (3-5 lignes) |

### Gap de forme (rendu Word)

| Élément | Cible | Actuel |
|---|---|---|
| **Cover page** | Logo "NOWADAYS AGENCY" pourpre en haut + ligne, "Proposition d'accompagnement" en gros noir, prénom client en rose, baseline italique, contact Laetitia | Tout centré, vide, "PROPOSITION / Pour X / Date" |
| **Header de page** | « Nowadays Agency × {Prénom} » discret en haut à droite | Aucun header |
| **Titres de section** | Noir gras, alignés à gauche, ligne grise fine en dessous | Pourpre centré, ligne rose épaisse |
| **Footer** | « Page N » centré, sobre | Long avec URL |
| **Encarts** | Fond gris très clair + bordure gauche pourpre épaisse + texte italique | Cadre complet gris, pas d'italique |
| **Citations inline** | Italique partout (`*texte*`) | Non supportées par le renderer |
| **Tableaux** | Header rose pâle + texte foncé, bordures fines | Header rose vif + texte blanc |
| **Bullets** | `•` simples | Mix `•` / `●` |

## Correctif

### 1. `supabase/functions/generate-proposal/index.ts` — refonte du prompt

Restructurer en **10 sections** avec règles précises :

```
SECTION 1 — Ce que j'ai compris
  - 6-10 paragraphes denses qui REFORMULENT et CITENT
  - 3-4 verbatims minimum en italique *« … »* repris des notes
  - Encart de synthèse final : "Ce que j'entends derrière tout ça"

SECTION 2 — Mon diagnostic
  - 5 blocages numérotés : titre cash + paragraphe d'analyse 4-6 lignes

SECTION 3 — Mes recommandations stratégiques
  - 5-6 axes numérotés (le "comment", pas le "quoi qui cloche")

SECTION 4 — Ma proposition : binôme
  - Encart d'ouverture + Phase 1 / Phase 2 + encart objectif

SECTION 5 (CONDITIONNELLE) — Et [Prénom] dans tout ça ?
  - Uniquement si les notes mentionnent un·e partenaire/presta

SECTION 6 — Investissement
SECTION 7 — Planning prévisionnel (avec intro "indicatif, on l'ajuste")
SECTION 8 — Pourquoi travailler avec moi
  - Encart "Mon engagement honnête" final

SECTION 9 — Ça te parle ?
  - 2-3 paragraphes de clôture + encart final signature
```

Règles transversales :
- **Verbatims obligatoires** : ≥5 citations en italique (`*…*`) sur l'ensemble
- **Densité minimale** : section 1 ≥ 600 mots, sections 2-3 ≥ 400 mots chacune
- **`max_tokens`** : 8000 → **16000**
- Documenter le format italique (`*texte*`) pour le renderer

### 2. `src/lib/generate-proposal-docx.ts` — refonte du rendu

**Cover page** (refait de zéro) :
- En haut à gauche : « NOWADAYS AGENCY » en pourpre + ligne pourpre fine
- En haut à droite : « Nowadays Agency × {Prénom} » petit gris
- Bloc principal : « Proposition d'accompagnement » noir 32pt + « {Prénom} » rose 32pt
- Baseline italique gris (paramètre optionnel à passer depuis l'UI, sinon vide)
- Date en gris
- En bas : « Laetitia Mattioli » gras + « laetitia@nowadaysagency.com » + « nowadaysagency.com »

**Pages intérieures** :
- Header (running) : « Nowadays Agency × {Prénom} » petit gris en haut à droite
- Titres de section : noir 18pt gras, alignés à gauche, **ligne grise fine** en dessous (au lieu de la rose épaisse)
- Footer simplifié : « Page N » centré gris

**Encarts** (`createEncartParagraph`) :
- Bordure gauche pourpre épaisse (4pt) + fond gris très clair `#FAFAFA`
- Texte en **italique** (au lieu de gras)
- Padding plus généreux

**Renderer markdown** :
- `parseInlineFormatting` : ajouter support `*italic*` en plus de `**bold**`
- Bullets : forcer `•` partout (un seul caractère)

**Tableaux** :
- Header : fond rose pâle `#FCE4EC` + texte noir gras (au lieu de rose vif + blanc)
- Bordures plus fines `#E0E0E0`

### 3. `src/components/proposal/ProposalTab.tsx`

- Le bouton « Générer le Word » passe `clientName` (déjà fait) — ajouter optionnellement la baseline si dispo dans `mission.notes` (ou laisser vide pour l'instant)

## Hors scope

- Pas de changement de modèle (Opus 4 reste)
- Pas de modif de `regenerate-proposal-section` (à faire en 2e itération si tu veux)
- Pas de modif de `import-proposal`

## Vérification

Après build, je génère un Word de test avec un contenu type Violaine, je le convertis en PDF + images et je compare visuellement à la cible avant de te livrer.

## Confirmation

Je lance les 3 modifications (prompt + renderer Word + cover page) en une fois, c'est ok ?