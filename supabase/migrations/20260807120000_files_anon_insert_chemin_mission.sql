
-- Un client anonyme ne doit pouvoir enregistrer un fichier QUE dans le dossier
-- de sa propre mission. Sans ce garde, une ligne files insérée avec la clé anon
-- pouvait pointer vers le fichier d'une autre mission (storage_path libre),
-- que get-client-space signait ensuite tel quel.
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
