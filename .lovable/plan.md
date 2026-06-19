## Objectif

Quand une cliente dépose un fichier dans son espace client, envoyer un email automatique à `laetitia@nowadaysagency.com` pour la prévenir.

## Ce qui sera fait

1. **Configurer l'envoi d'emails** (prérequis)
   - Configurer un domaine d'envoi (ex. `notify.nowadaysagency.com`) via le dialogue de setup. Tu devras ajouter quelques enregistrements DNS chez ton registrar — ça prend ~5 min.
   - Mettre en place l'infrastructure email (file d'attente, logs, etc.) — automatique.
   - Scaffolder le système d'emails applicatifs — automatique.

2. **Créer le template d'email** `client-file-uploaded`
   - Sujet : `📎 [Nom cliente] a déposé un nouveau document`
   - Contenu : nom de la cliente, nom du fichier, taille, date, + lien direct vers la mission dans l'app.
   - Style cohérent avec la charte (Libre Baskerville, IBM Plex Sans, #91014b).

3. **Brancher le trigger** dans `supabase/functions/upload-client-file/index.ts`
   - Après l'insertion réussie du fichier dans `files`, appeler `send-transactional-email` avec `recipientEmail: "laetitia@nowadaysagency.com"`.
   - Idempotency key basée sur l'ID du fichier pour éviter les doublons.
   - L'envoi ne bloque pas l'upload : si l'email échoue, le fichier reste bien enregistré (try/catch silencieux + log).

## À noter

- L'email part dès que le DNS est vérifié (sinon il est mis en file d'attente).
- Tu pourras suivre les envois dans Cloud → Emails.
- Aucune modification du portail client (UX cliente inchangée).

## Question

L'adresse de destination est-elle bien `laetitia@nowadaysagency.com` (fixée en dur), ou veux-tu pouvoir la modifier plus tard depuis l'app ?
