-- 20260807120000_files_anon_insert_chemin_mission.sql
DROP POLICY IF EXISTS "anon_insert_client_files" ON public.files;
CREATE POLICY "anon_insert_client_files"
  ON public.files
  FOR INSERT
  TO anon
  WITH CHECK (
    uploaded_by = 'client'
    AND storage_path LIKE (mission_id::text || '/%')
    AND EXISTS (SELECT 1 FROM public.missions m WHERE m.id = files.mission_id AND m.client_link_active = true)
  );

-- 20260807120100_admins_seulement.sql
CREATE TABLE public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_admins TO service_role;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_admins (user_id) SELECT id FROM auth.users;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid());
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'missions', 'discovery_calls', 'proposals', 'kickoffs', 'actions',
    'sessions', 'journal_entries', 'files', 'pitch_scripts', 'claude_projects'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "admin_all" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mission-files' AND public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
CREATE POLICY "Authenticated users can update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'mission-files' AND public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
CREATE POLICY "Authenticated users can delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mission-files' AND public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can download" ON storage.objects;
CREATE POLICY "Authenticated users can download" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'mission-files' AND public.is_admin());

-- 20260807130000_discovery_calls_unique_mission.sql
DELETE FROM public.discovery_calls
WHERE id NOT IN (
  SELECT DISTINCT ON (mission_id) id
  FROM public.discovery_calls
  ORDER BY mission_id,
    (CASE WHEN structured_notes IS NOT NULL THEN 0 ELSE 1 END),
    (CASE WHEN raw_notes IS NOT NULL AND raw_notes != '' THEN 0 ELSE 1 END),
    created_at ASC
);

ALTER TABLE public.discovery_calls ADD CONSTRAINT discovery_calls_mission_id_unique UNIQUE (mission_id);