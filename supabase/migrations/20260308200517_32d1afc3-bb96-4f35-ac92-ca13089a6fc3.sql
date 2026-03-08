-- Create missions table
CREATE TABLE public.missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT,
  mission_type TEXT NOT NULL DEFAULT 'non_determine',
  amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'discovery_call',
  client_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add check constraints
ALTER TABLE public.missions ADD CONSTRAINT missions_mission_type_check 
  CHECK (mission_type IN ('non_determine', 'binome', 'agency'));

ALTER TABLE public.missions ADD CONSTRAINT missions_status_check 
  CHECK (status IN ('discovery_call', 'proposal_drafting', 'proposal_sent', 'signed', 'active', 'completed', 'lost'));

-- Enable RLS
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can do everything
CREATE POLICY "admin_all" ON public.missions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: anonymous users can read by client_token
CREATE POLICY "client_read" ON public.missions
  FOR SELECT
  TO anon
  USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_missions_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();