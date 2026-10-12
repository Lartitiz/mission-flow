/**
 * Suggestions d'actions IA écartées par Laetitia (décochées ou ignorées).
 * Elles sont gardées sur la session (structured_notes._rejected_suggestions)
 * pour que l'extraction suivante ne les repropose pas comme des pistes neuves.
 */

export type RejectedSuggestion = {
  task: string;
  assignee?: string | null;
  description?: string | null;
  rejected_at: string;
};

type Suggestion = { task: string; assignee?: string | null; description?: string | null };

const MAX_REJECTED_PER_SESSION = 100;

export function getRejected(sn: unknown): RejectedSuggestion[] {
  const list = (sn as { _rejected_suggestions?: unknown } | null)?._rejected_suggestions;
  return Array.isArray(list) ? (list as RejectedSuggestion[]) : [];
}

/**
 * Retire les suggestions en attente de la session et y archive celles qui
 * n'ont pas été retenues.
 */
export function clearPendingWithRejected(
  sn: Record<string, unknown> | null | undefined,
  rejected: Suggestion[]
): Record<string, unknown> {
  const { _pending_extracted, ...rest } = (sn || {}) as { _pending_extracted?: unknown };
  if (rejected.length === 0) return rest;
  const now = new Date().toISOString();
  const added: RejectedSuggestion[] = rejected
    .filter((s) => s.task?.trim())
    .map((s) => ({
      task: s.task,
      assignee: s.assignee ?? null,
      description: s.description ?? null,
      rejected_at: now,
    }));
  return {
    ...rest,
    _rejected_suggestions: [...getRejected(sn), ...added].slice(-MAX_REJECTED_PER_SESSION),
  };
}
