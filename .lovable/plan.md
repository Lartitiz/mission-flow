# Nouvelle image sociale (aperçu de partage)

Refonte de l'image qui s'affiche quand un lien de l'app est partagé (LinkedIn, WhatsApp, Slack…), pour qu'elle colle à la direction artistique Nowadays.

## Direction retenue

Papier crème, minimaliste, éditorial :
- Fond crème #FAF7F2 avec une légère texture papier et un liseré fin #F0E9E0
- Titre en Libre Baskerville, framboise #91014b
- Sur-titre « NOWADAYS AGENCY » en IBM Plex Sans, lettrage espacé, gris profond
- Un seul accent rose #FB3D80 (filet court sous le sur-titre)
- Aucune forme décorative superflue, beaucoup de blanc

## Ce qui sera produit

Deux visuels au format 1200×630 :
1. `public/og-client-space.png` — « Espace projet », baseline « Suivez l'avancement de votre mission de communication »
2. `public/og-default.png` — visuel générique Nowadays Agency, même grille

Les deux gardent la même structure pour former une famille cohérente.

## Détails techniques

- Génération des visuels en 1200×630 (ratio Open Graph standard), remplacement des fichiers existants dans `public/`
- Les balises `og:image` / `twitter:image` de `index.html` pointent déjà vers `/og-client-space.png` : aucune modification de balise nécessaire
- Vérification visuelle des deux fichiers après génération (lisibilité, marges, contraste)

Note : LinkedIn et consorts gardent en cache l'ancienne image ; il faudra forcer un rafraîchissement via leur outil d'aperçu de lien après publication.
