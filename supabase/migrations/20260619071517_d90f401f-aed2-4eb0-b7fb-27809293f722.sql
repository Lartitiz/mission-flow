GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kickoffs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_calls TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;

GRANT ALL ON public.missions TO service_role;
GRANT ALL ON public.kickoffs TO service_role;
GRANT ALL ON public.discovery_calls TO service_role;
GRANT ALL ON public.proposals TO service_role;
GRANT ALL ON public.actions TO service_role;
GRANT ALL ON public.sessions TO service_role;