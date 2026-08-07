
-- Vue « ateliers restants » : chaque mission peut déclarer un objectif
-- d'ateliers (ex. 6 pour un accompagnement Binôme 6 mois). NULL = pas
-- d'objectif : la jauge se cale alors sur les ateliers existants.
-- Les ateliers PLANIFIÉS sont simplement des lignes sessions avec une
-- date future (la colonne topic, déjà présente, sert de titre).
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS planned_sessions_total integer;
