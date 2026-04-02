-- Step 1: For each mission, keep only the best kickoff (one with data, or oldest)
-- First, identify the keeper for each mission
DELETE FROM public.kickoffs
WHERE id NOT IN (
  SELECT DISTINCT ON (mission_id) id
  FROM public.kickoffs
  ORDER BY mission_id,
    -- Prefer rows with structured_notes
    (CASE WHEN structured_notes IS NOT NULL THEN 0 ELSE 1 END),
    -- Then prefer rows with raw_notes
    (CASE WHEN raw_notes IS NOT NULL AND raw_notes != '' THEN 0 ELSE 1 END),
    -- Then oldest
    created_at ASC
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE public.kickoffs ADD CONSTRAINT kickoffs_mission_id_unique UNIQUE (mission_id);