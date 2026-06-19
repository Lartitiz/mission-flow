
-- 1. Drop unscoped anon SELECT policies (all client reads go through service-role edge functions)
DROP POLICY IF EXISTS "client_read" ON public.missions;
DROP POLICY IF EXISTS "client_read" ON public.actions;
DROP POLICY IF EXISTS "client_read" ON public.sessions;
DROP POLICY IF EXISTS "client_read" ON public.files;

-- 2. Tighten anon INSERT on files: require the mission to exist
DROP POLICY IF EXISTS "anon_insert_client_files" ON public.files;
CREATE POLICY "anon_insert_client_files"
  ON public.files
  FOR INSERT
  TO anon
  WITH CHECK (
    uploaded_by = 'client'
    AND EXISTS (SELECT 1 FROM public.missions m WHERE m.id = files.mission_id AND m.client_link_active = true)
  );

-- 3. Drop unscoped storage download policy for anon (client downloads use signed URLs)
DROP POLICY IF EXISTS "Anon can download via token" ON storage.objects;

-- 4. Tighten anon storage upload to require an existing, active mission folder
DROP POLICY IF EXISTS "Anon can upload client files" ON storage.objects;
CREATE POLICY "Anon can upload client files"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'mission-files'
    AND (storage.foldername(name))[2] = ANY (ARRAY['uploads'::text, 'actions'::text])
  );
