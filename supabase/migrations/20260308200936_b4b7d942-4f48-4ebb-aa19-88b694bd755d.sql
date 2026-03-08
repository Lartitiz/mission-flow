
-- 1. discovery_calls
CREATE TABLE public.discovery_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  raw_notes text,
  structured_notes jsonb,
  questions_asked jsonb,
  ai_suggested_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discovery_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.discovery_calls FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_discovery_calls_updated_at BEFORE UPDATE ON public.discovery_calls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. proposals
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  content jsonb,
  version integer NOT NULL DEFAULT 1,
  tutoiement boolean NOT NULL DEFAULT true,
  email_draft text,
  clarification_qa jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.proposals ADD CONSTRAINT proposals_status_check CHECK (status IN ('draft','ready','sent'));
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. kickoffs
CREATE TABLE public.kickoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'visio',
  fixed_questions jsonb,
  ai_questions jsonb,
  declic_questions_enabled boolean NOT NULL DEFAULT false,
  raw_notes text,
  structured_notes jsonb,
  questionnaire_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  questionnaire_status text NOT NULL DEFAULT 'draft',
  questionnaire_responses jsonb,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kickoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.kickoffs FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.kickoffs ADD CONSTRAINT kickoffs_mode_check CHECK (mode IN ('visio','questionnaire'));
ALTER TABLE public.kickoffs ADD CONSTRAINT kickoffs_questionnaire_status_check CHECK (questionnaire_status IN ('draft','sent','completed'));
CREATE TRIGGER update_kickoffs_updated_at BEFORE UPDATE ON public.kickoffs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. actions
CREATE TABLE public.actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  assignee text NOT NULL,
  category text,
  task text NOT NULL,
  description text,
  channel text,
  target_date date,
  hours_estimated numeric,
  budget_ht numeric,
  status text NOT NULL DEFAULT 'not_started',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "client_read" ON public.actions FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.missions m WHERE m.id = actions.mission_id)
);
ALTER TABLE public.actions ADD CONSTRAINT actions_status_check CHECK (status IN ('not_started','in_progress','to_validate','validated','delivered'));
CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON public.actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. sessions
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  session_type text NOT NULL DEFAULT 'visio',
  raw_notes text,
  structured_notes jsonb,
  next_session_date date,
  next_session_agenda text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "client_read" ON public.sessions FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.missions m WHERE m.id = sessions.mission_id)
);
ALTER TABLE public.sessions ADD CONSTRAINT sessions_type_check CHECK (session_type IN ('visio','phone','other'));
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. journal_entries
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  content text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.journal_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_source_check CHECK (source IN ('auto','manual'));

-- 7. files
CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by text NOT NULL DEFAULT 'laetitia',
  category text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.files FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "client_read" ON public.files FOR SELECT TO anon USING (
  EXISTS (SELECT 1 FROM public.missions m WHERE m.id = files.mission_id)
);
ALTER TABLE public.files ADD CONSTRAINT files_category_check CHECK (category IN ('brief','livrable','visuel','autre'));

-- 8. pitch_scripts
CREATE TABLE public.pitch_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_type text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.pitch_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.pitch_scripts FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.pitch_scripts ADD CONSTRAINT pitch_scripts_type_check CHECK (script_type IN ('intro','transition','pitch_binome','pitch_agency','objections','closing'));

-- 9. Storage bucket mission-files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mission-files', 'mission-files', false, 52428800, ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']);

-- Storage policies: upload for authenticated
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mission-files');
CREATE POLICY "Authenticated users can update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'mission-files');
CREATE POLICY "Authenticated users can delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mission-files');

-- Storage policies: download for authenticated
CREATE POLICY "Authenticated users can download" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'mission-files');

-- Storage policies: anonymous download via client_token (path format: {mission_id}/...)
CREATE POLICY "Anon can download via token" ON storage.objects FOR SELECT TO anon USING (
  bucket_id = 'mission-files'
  AND EXISTS (
    SELECT 1 FROM public.missions m WHERE m.id::text = (storage.foldername(name))[1]
  )
);
