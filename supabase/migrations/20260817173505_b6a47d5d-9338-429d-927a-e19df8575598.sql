ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_actions_archived_at ON public.actions (mission_id, archived_at);