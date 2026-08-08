
-- Récap de mission par e-mail : on retient la date du dernier envoi pour que
-- chaque récap ne raconte que le neuf (« depuis le dernier récap ») et pour
-- la relance douce côté Suivi (« dernier récap : il y a X jours »).
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS last_recap_sent_at timestamptz;
