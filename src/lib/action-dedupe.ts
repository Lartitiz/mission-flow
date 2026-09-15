import { supabase } from '@/integrations/supabase/client';

/** Normalise un libellé de tâche pour comparer sans tenir compte de la casse,
 *  des accents, de la ponctuation ni des espaces multiples. */
export function normalizeTask(task: string): string {
  return (task || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Deux tâches sont considérées comme identiques si leur libellé normalisé est
 *  le même, ou si l'un est strictement contenu dans l'autre (libellés longs). */
export function isSameTask(a: string, b: string): boolean {
  const na = normalizeTask(a);
  const nb = normalizeTask(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 15 && nb.length >= 15) {
    return na.includes(nb) || nb.includes(na);
  }
  return false;
}

type Candidate = { task: string; assignee?: string | null };

/**
 * Filtre une liste de tâches à créer : retire celles qui existent déjà dans la
 * mission (même personne assignée) et les doublons internes à la fournée.
 * Retourne les tâches à créer et celles ignorées.
 */
export async function filterDuplicateActions<T extends Candidate>(
  missionId: string,
  candidates: T[]
): Promise<{ toCreate: T[]; duplicates: T[] }> {
  const { data } = await supabase
    .from('actions')
    .select('task, assignee')
    .eq('mission_id', missionId);

  const existing = (data || []) as { task: string; assignee: string }[];
  const toCreate: T[] = [];
  const duplicates: T[] = [];

  for (const candidate of candidates) {
    const assignee = candidate.assignee ?? null;
    const matchesExisting = existing.some(
      (e) => (!assignee || e.assignee === assignee) && isSameTask(e.task, candidate.task)
    );
    const matchesBatch = toCreate.some(
      (c) => (c.assignee ?? null) === assignee && isSameTask(c.task, candidate.task)
    );
    if (matchesExisting || matchesBatch) duplicates.push(candidate);
    else toCreate.push(candidate);
  }

  return { toCreate, duplicates };
}

/** Message toast standard quand des doublons ont été ignorés. */
export function duplicatesMessage(count: number): string {
  return count === 1
    ? '1 action déjà présente a été ignorée (doublon).'
    : `${count} actions déjà présentes ont été ignorées (doublons).`;
}
