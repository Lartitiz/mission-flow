import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DEFAULT_CLIENT_ACTIONS, type DefaultClientAction } from '@/lib/default-client-actions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface DefaultActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missionId: string;
  existingClientTasks: string[];
  maxSortOrder: number;
}

export function DefaultActionsDialog({
  open,
  onOpenChange,
  missionId,
  existingClientTasks,
  maxSortOrder,
}: DefaultActionsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  // Normalize existing tasks for comparison
  const normalizedExisting = existingClientTasks.map((t) => t.trim().toLowerCase());

  const isAlreadyCreated = (action: DefaultClientAction) =>
    normalizedExisting.includes(action.task.trim().toLowerCase());

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      const initial = new Set<string>();
      for (const action of DEFAULT_CLIENT_ACTIONS) {
        if (action.checked && !isAlreadyCreated(action)) {
          initial.add(action.id);
        }
      }
      setSelected(initial);
    }
  }, [open, normalizedExisting.join(',')]);

  const selectableActions = DEFAULT_CLIENT_ACTIONS.filter((a) => !isAlreadyCreated(a));
  const allSelected = selectableActions.length > 0 && selectableActions.every((a) => selected.has(a.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableActions.map((a) => a.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleCreate = async () => {
    const toCreate = DEFAULT_CLIENT_ACTIONS.filter((a) => selected.has(a.id));
    if (toCreate.length === 0) return;

    setIsCreating(true);
    try {
      let sortOrder = maxSortOrder + 1;
      const rows = toCreate.map((a) => ({
        mission_id: missionId,
        assignee: 'client',
        task: a.task,
        description: a.description,
        category: a.category,
        phase: a.phase || null,
        status: 'not_started',
        sort_order: sortOrder++,
      }));

      const { error } = await supabase.from('actions').insert(rows);
      if (error) throw error;

      toast({
        title: `${toCreate.length} action${toCreate.length > 1 ? 's' : ''} client·e créée${toCreate.length > 1 ? 's' : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
      onOpenChange(false);
    } catch (err) {
      console.error('Create default actions error:', err);
      toast({
        title: 'Erreur',
        description: 'Impossible de créer les actions.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const groups: { label: string; category: string }[] = [
    { label: 'Accès & documents', category: 'Accès' },
    { label: 'Réflexion stratégique', category: 'Réflexion' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">
            Actions de base pour ta client·e
          </DialogTitle>
          <DialogDescription className="font-body text-sm">
            Sélectionne les actions à créer. Tu pourras les modifier après.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {groups.map((group) => (
            <div key={group.category} className="space-y-2">
              <h4 className="font-heading text-sm font-medium text-foreground">
                {group.label}
              </h4>
              <div className="space-y-1">
                {DEFAULT_CLIENT_ACTIONS.filter((a) => a.category === group.category).map((action) => {
                  const alreadyExists = isAlreadyCreated(action);
                  return (
                    <label
                      key={action.id}
                      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer hover:bg-secondary/50 ${
                        alreadyExists ? 'opacity-50' : ''
                      }`}
                    >
                      <Checkbox
                        checked={alreadyExists ? false : selected.has(action.id)}
                        onCheckedChange={() => !alreadyExists && toggle(action.id)}
                        disabled={alreadyExists}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-body text-[13px] font-semibold text-foreground">
                            {action.task}
                          </span>
                          {alreadyExists && (
                            <span className="font-body text-[11px] text-muted-foreground italic">
                              (déjà créée)
                            </span>
                          )}
                        </div>
                        <p className="font-body text-xs text-muted-foreground truncate">
                          {action.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <button
            type="button"
            onClick={toggleAll}
            className="font-body text-xs text-muted-foreground hover:text-foreground underline mr-auto"
          >
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="font-body"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={selected.size === 0 || isCreating}
              className="font-body gap-2"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Créer {selected.size} action{selected.size > 1 ? 's' : ''}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
