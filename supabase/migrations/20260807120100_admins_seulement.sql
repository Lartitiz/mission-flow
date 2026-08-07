
-- Jusqu'ici, TOUTE personne connectée avait tous les droits (admin_all avec
-- USING (true)) et la page de connexion permettait de créer un compte en
-- libre-service : n'importe qui pouvait donc devenir « admin » et lire ou
-- modifier toutes les missions. On restreint aux comptes listés dans app_admins.
--
-- ⚠️ Avant d'appliquer : vérifier que la liste des comptes existants ne
-- contient que des comptes légitimes (SELECT email FROM auth.users;) car ils
-- sont tous promus admins. Et désactiver les inscriptions dans
-- Supabase Auth > Providers > Email ("Disable signup").

CREATE TABLE public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
-- Aucune policy : la table n'est lue que par is_admin() (SECURITY DEFINER).

INSERT INTO public.app_admins (user_id) SELECT id FROM auth.users;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid());
$$;

-- Remplace « tout utilisateur connecté » par « admins seulement » sur toutes
-- les tables métier.
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

-- Storage : mêmes règles pour le bucket mission-files.
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
