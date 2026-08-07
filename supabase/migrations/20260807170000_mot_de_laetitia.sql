
-- « Le mot de Laetitia » : un message personnel affiché en sticker dans
-- l'espace client. NULL ou vide = pas de sticker (jamais de message
-- automatique déguisé en mot humain).
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS client_note text;
