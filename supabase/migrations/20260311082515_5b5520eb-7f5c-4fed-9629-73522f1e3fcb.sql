CREATE POLICY "anon_insert_client_files" 
ON public.files 
FOR INSERT 
TO anon 
WITH CHECK (
  uploaded_by = 'client'
);