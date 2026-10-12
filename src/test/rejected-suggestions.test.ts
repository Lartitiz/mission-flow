import { describe, it, expect } from 'vitest';
import { clearPendingWithRejected, getRejected } from '@/lib/rejected-suggestions';

describe('clearPendingWithRejected', () => {
  it('retire les suggestions en attente et archive celles écartées', () => {
    const sn = {
      sections: [{ title: 'Résultats clés', content: '…' }],
      _pending_extracted: { new_actions: [{ task: 'A' }], updates: [] },
      _rejected_suggestions: [{ task: 'Ancienne', assignee: 'client', rejected_at: '2026-01-01' }],
    };
    const out = clearPendingWithRejected(sn, [{ task: 'Lancer un podcast', assignee: 'laetitia' }]);
    expect(out._pending_extracted).toBeUndefined();
    expect(out.sections).toEqual(sn.sections);
    expect(getRejected(out).map((r) => r.task)).toEqual(['Ancienne', 'Lancer un podcast']);
  });

  it('ne crée pas de liste vide quand rien n’est écarté', () => {
    const out = clearPendingWithRejected({ _pending_extracted: {} }, []);
    expect(out).toEqual({});
  });
});
