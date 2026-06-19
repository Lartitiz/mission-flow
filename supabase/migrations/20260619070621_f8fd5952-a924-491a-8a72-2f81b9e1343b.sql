
DROP POLICY IF EXISTS "Anon can upload client files" ON storage.objects;
CREATE POLICY "Anon can upload client files"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'mission-files'
    AND (storage.foldername(name))[2] = ANY (ARRAY['uploads'::text, 'actions'::text])
    AND EXISTS (
      SELECT 1 FROM public.missions m
      WHERE (m.id)::text = (storage.foldername(name))[1]
        AND m.client_link_active = true
    )
  );
