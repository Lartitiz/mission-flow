
-- Même bug (et même remède) que kickoffs le 02/04 : deux sauvegardes
-- simultanées sur une mission neuve pouvaient créer deux discovery_calls,
-- et l'onglet Découverte restait ensuite cassé (« multiple rows »).

-- Étape 1 : ne garder que la meilleure ligne par mission
DELETE FROM public.discovery_calls
WHERE id NOT IN (
  SELECT DISTINCT ON (mission_id) id
  FROM public.discovery_calls
  ORDER BY mission_id,
    (CASE WHEN structured_notes IS NOT NULL THEN 0 ELSE 1 END),
    (CASE WHEN raw_notes IS NOT NULL AND raw_notes != '' THEN 0 ELSE 1 END),
    created_at ASC
);

-- Étape 2 : empêcher les futurs doublons
ALTER TABLE public.discovery_calls ADD CONSTRAINT discovery_calls_mission_id_unique UNIQUE (mission_id);
