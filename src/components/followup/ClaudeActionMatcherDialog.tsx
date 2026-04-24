import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Action } from '@/hooks/useActions';

interface PromptItem {
  order: number;
  phase: string;
  title: string;
  output_format: string;
}

interface ClaudeActionMatcherDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  missionId: string;
  prompts: PromptItem[];
  actions: Action[];
  onSaved?: () => void;
}

const NONE = '__none__';

// Lightweight similarity: normalized token overlap
function normalize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

const STOP = new Set([
  'pour', 'avec', 'dans', 'cette', 'cette', 'leur', 'leurs', 'mais', 'donc', 'plus', 'sans',
  'votre', 'notre', 'vous', 'nous', 'tout', 'tous', 'toute', 'toutes', 'sous', 'sur',
  'que', 'qui', 'quoi', 'comment', 'pourquoi', 'aussi', 'bien', 'fait', 'faire',
]);

function similarity(a: string, b: string): number {
  const ta = new Set(normalize(a).filter((w) => !STOP.has(w)));
  const tb = new Set(normalize(b).filter((w) => !STOP.has(w)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((w) => { if (tb.has(w)) inter++; });
  return inter / Math.min(ta.size, tb.size);
}

function suggestActionForPrompt(prompt: PromptItem, actions: Action[]): string | null {
  let bestId: string | null = null;
  let bestScore = 0;
  for (const a of actions) {
    const score = similarity(prompt.title, `${a.task} ${a.description ?? ''} ${a.category ?? ''}`);
    if (score > bestScore) {
      bestScore = score;
      bestId = a.id;
    }
  }
  return bestScore >= 0.34 ? bestId : null;
}

export function ClaudeActionMatcherDialog({
  open,
  onOpenChange,
  missionId,
  prompts,
  actions,
  onSaved,
}: ClaudeActionMatcherDialogProps) {
  const { toast } = useToast();
  const [pairs, setPairs] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // actions assigned to laetitia only (kit Claude = production côté Laetitia)
  const eligibleActions = useMemo(
    () => actions.filter((a) => a.assignee === 'laetitia'),
    [actions]
  );

  // Init pairings: respect existing claude_prompt_order, else AI suggest
  useEffect(() => {
    if (!open) return;
    const initial: Record<number, string> = {};
    const usedActionIds = new Set<string>();

    // Step 1: existing links
    eligibleActions.forEach((a) => {
      const order = (a as any).claude_prompt_order as number | null;
      if (order != null && prompts.some((p) => p.order === order)) {
        initial[order] = a.id;
        usedActionIds.add(a.id);
      }
    });

    // Step 2: suggest for prompts without a link
    prompts.forEach((p) => {
      if (initial[p.order]) return;
      const remaining = eligibleActions.filter((a) => !usedActionIds.has(a.id));
      const suggestion = suggestActionForPrompt(p, remaining);
      if (suggestion) {
        initial[p.order] = suggestion;
        usedActionIds.add(suggestion);
      } else {
        initial[p.order] = NONE;
      }
    });

    setPairs(initial);
  }, [open, prompts, eligibleActions]);

  const handleChange = (order: number, actionId: string) => {
    setPairs((prev) => {
      const next = { ...prev };
      // If this action was assigned to another prompt, clear it
      if (actionId !== NONE) {
        Object.keys(next).forEach((k) => {
          if (Number(k) !== order && next[Number(k)] === actionId) {
            next[Number(k)] = NONE;
          }
        });
      }
      next[order] = actionId;
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Clear all existing links for this mission's laetitia actions
      const currentlyLinkedIds = eligibleActions
        .filter((a) => (a as any).claude_prompt_order != null)
        .map((a) => a.id);

      if (currentlyLinkedIds.length > 0) {
        await supabase
          .from('actions')
          .update({ claude_prompt_order: null } as any)
          .in('id', currentlyLinkedIds);
      }

      // 2. Apply new links
      const updates = Object.entries(pairs)
        .filter(([, id]) => id !== NONE)
        .map(([order, id]) =>
          supabase
            .from('actions')
            .update({ claude_prompt_order: Number(order) } as any)
            .eq('id', id)
        );

      await Promise.all(updates);

      toast({ title: 'Liens enregistrés ✓', description: `${updates.length} prompt(s) lié(s) au plan d'actions.` });
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      console.error('Save matcher error:', e);
      toast({ title: 'Erreur', description: "Impossible d'enregistrer les liens.", variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Lier les prompts du kit aux actions du plan
          </DialogTitle>
          <DialogDescription className="font-body">
            Pour chaque prompt, choisis l'action existante du plan correspondante. Cocher le prompt mettra l'action en cours.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {prompts.length === 0 && (
            <p className="font-body text-sm text-muted-foreground text-center py-8">
              Aucun prompt à lier.
            </p>
          )}
          {prompts.map((p) => (
            <div
              key={p.order}
              className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center border rounded-lg p-3 bg-background"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-body text-xs font-bold text-muted-foreground">#{p.order}</span>
                  <Badge variant="outline" className="text-[10px]">Phase {p.phase}</Badge>
                  <Badge variant="outline" className="text-[10px]">{p.output_format}</Badge>
                </div>
                <p className="font-body text-sm text-foreground truncate">{p.title}</p>
              </div>
              <span className="font-body text-xs text-muted-foreground">→</span>
              <Select
                value={pairs[p.order] ?? NONE}
                onValueChange={(v) => handleChange(p.order, v)}
              >
                <SelectTrigger className="font-body text-xs">
                  <SelectValue placeholder="Choisir une action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} className="font-body text-xs italic">
                    Aucune action liée
                  </SelectItem>
                  {eligibleActions.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="font-body text-xs">
                      {a.task || '(sans titre)'} {a.category ? `— ${a.category}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-body">
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="font-body gap-2">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Enregistrer les liens
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
