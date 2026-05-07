## Objectif

Ajouter dans l'onglet **Suivi** un message prêt-à-copier pour inviter le·la client·e à réserver son prochain atelier via le lien Calendly, à utiliser entre les séances.

## Plan

1. **Créer `src/components/followup/NextSessionBookingMessage.tsx`**
   - Carte similaire à `LaunchMessageCard` (même style, même bouton "Copier")
   - Titre : "Message de réservation — prochaine séance" (icône Calendar)
   - Texte par défaut éditable (textarea) :
     > Coucou {prénom}, voici mon agenda pour réserver ton prochain atelier : https://calendly.com/laetitia-mattioli/atelier-2h À très vite !
   - Bouton "Copier le message"

2. **Intégrer la carte dans `src/components/followup/FollowUpTab.tsx`**
   - Placement : juste après `NextSessionCard` (logique entre-deux-séances), avant `SessionHistory`

## Détails techniques

- Aucun changement de schéma DB
- Lien Calendly en dur dans le composant (modifiable plus tard si besoin)
- Tokens design existants (font-heading, font-body, primary, badge-rose)
