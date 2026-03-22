CREATE TABLE public.claude_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  prompt_system text NOT NULL,
  prompt_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.claude_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all" ON public.claude_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_claude_projects_updated_at BEFORE UPDATE ON public.claude_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();