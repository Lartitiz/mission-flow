CREATE POLICY "Anon can upload client files"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'mission-files'
  AND (storage.foldername(name))[2] IN ('uploads', 'actions')
);