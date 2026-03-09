
-- Add client_slug column
ALTER TABLE public.missions ADD COLUMN client_slug text UNIQUE;

-- Create a function to generate slugs from client names
CREATE OR REPLACE FUNCTION public.generate_client_slug(p_client_name text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter int := 0;
BEGIN
  -- Normalize: lowercase, replace accented chars, replace non-alphanum with hyphens
  base_slug := lower(p_client_name);
  base_slug := translate(base_slug, 'àâäéèêëïîôùûüÿçñ', 'aaaeeeeiioouuyçn');
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  -- Try base slug first
  final_slug := base_slug;
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.missions WHERE client_slug = final_slug) THEN
      RETURN final_slug;
    END IF;
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
END;
$$;

-- Backfill existing missions
UPDATE public.missions 
SET client_slug = public.generate_client_slug(client_name)
WHERE client_slug IS NULL;

-- Make it NOT NULL now that all rows have values
ALTER TABLE public.missions ALTER COLUMN client_slug SET NOT NULL;

-- Set default for new rows via trigger
CREATE OR REPLACE FUNCTION public.set_client_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.client_slug IS NULL OR NEW.client_slug = '' THEN
    NEW.client_slug := public.generate_client_slug(NEW.client_name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_client_slug
BEFORE INSERT ON public.missions
FOR EACH ROW
EXECUTE FUNCTION public.set_client_slug();
