import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';

interface GeneratedAction {
  assignee: string;
  category: string;
  task: string;
  description: string;
  channel?: string | null;
}

interface ActionsFromProposalCardProps {
  missionId: string;
  clientName: string;
  missionType: string;
  proposalContent: any;
  existingActionsCount: number;
  maxSortOrder: number;
  variant: 'init' | 'complement';
}

export function ActionsFromProposalCard({
  missionId,
  clientName,
  missionType,
  proposalContent,
  existingActionsCount,
  maxSortOrder,
  variant,
}: ActionsFromProposalCardProps) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedActions, setGeneratedActions] = useState<GeneratedAction[] | null>(null);
  const [selectedActions, setSelectedActions] = useState<boolean[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-actions-from-proposal', {
        body: {
          proposal_content: proposalContent,
          mission_type: missionType,
          client_name: clientName,
        },
      });
      if (error) throw error;
      if (!data?.actions?.length) {
        toast('Aucune action générée depuis la proposition.');
        return;
      }
      setGeneratedActions(data.actions);
      setSelectedActions(new Array(data.actions.length).fill(true));
    } catch (e: any) {
      console.error('Generate actions error:', e);
      toast.error('Erreur : ' + (e?.message || 'Génération échouée.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async () => {
    if (!generatedActions) return;
    const selected = generatedActions.filter((_, i) => selectedActions[i]);
    if (!selected.length) {
      toast.error('Sélectionne au moins une action.');
      return;
    }

    setIsCreating(true);
    try {
      let sortOrder = maxSortOrder + 1;
      for (const action of selected) {
        const { error } = await supabase.from('actions').insert({
          mission_id: missionId,
          assignee: action.assignee,
          task: action.task,
          description: action.description || null,
          category: action.category || null,
          channel: action.channel || null,
          sort_order: sortOrder++,
          status: 'not_started',
        });
        if (error) console.error('Insert action error:', error);
      }

      // Journal entry
      await supabase.from('journal_entries').insert({
        mission_id: missionId,
        content: `Plan d'actions initialisé à partir de la proposition (${selected.length} actions)`,
        source: 'auto',
      });

      toast.success(`${selected.length} actions créées depuis la proposition`);
      setGeneratedActions(null);
      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
      queryClient.invalidateQueries({ queryKey: ['journal', missionId] });
    } catch (e: any) {
      console.error('Apply actions error:', e);
      toast.error("Erreur lors de la création des actions.");
    } finally {
      setIsCreating(false);
    }
  };

  const toggleAction = (idx: number) => {
    setSelectedActions((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  // Validation results panel
  if (generatedActions) {
    const laetitiaActions = generatedActions
      .map((a, i) => ({ ...a, originalIdx: i }))
      .filter((a) => a.assignee === 'laetitia');
    const clientActions = generatedActions
      .map((a, i) => ({ ...a, originalIdx: i }))
      .filter((a) => a.assignee === 'client');
    const selectedCount = selectedActions.filter(Boolean).length;

    return (
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-6 space-y-5">
        <h3 className="font-heading text-base text-foreground">
          Actions proposées ({generatedActions.length})
        </h3>

        {laetitiaActions.length > 0 && (
          <div>
            <h4 className="font-heading text-sm text-foreground mb-2">
              Actions Laetitia ({laetitiaActions.length})
            </h4>
            <div className="space-y-2">
              {laetitiaActions.map((a) => (
                <div
                  key={a.originalIdx}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background"
                >
                  <Switch
                    checked={selectedActions[a.originalIdx]}
                    onCheckedChange={() => toggleAction(a.originalIdx)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-foreground">{a.task}</p>
                    {a.description && (
                      <p className="font-body text-xs text-muted-foreground mt-0.5">{a.description}</p>
                    )}
                    <div className="flex gap-2 mt-1">
                      {a.category && (
                        <span className="font-body text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                          {a.category}
                        </span>
                      )}
                      {a.channel && (
                        <span className="font-body text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                          {a.channel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {clientActions.length > 0 && (
          <div>
            <h4 className="font-heading text-sm text-foreground mb-2">
              Actions client·e ({clientActions.length})
            </h4>
            <div className="space-y-2">
              {clientActions.map((a) => (
                <div
                  key={a.originalIdx}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background"
                >
                  <Switch
                    checked={selectedActions[a.originalIdx]}
                    onCheckedChange={() => toggleAction(a.originalIdx)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-foreground">{a.task}</p>
                    {a.description && (
                      <p className="font-body text-xs text-muted-foreground mt-0.5">{a.description}</p>
                    )}
                    <div className="flex gap-2 mt-1">
                      {a.category && (
                        <span className="font-body text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                          {a.category}
                        </span>
                      )}
                      {a.channel && (
                        <span className="font-body text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                          {a.channel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setGeneratedActions(null)} className="font-body">
            Annuler
          </Button>
          <Button
            onClick={handleApply}
            disabled={isCreating || selectedCount === 0}
            className="font-body gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Créer {selectedCount} action{selectedCount > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Init card (no actions yet)
  if (variant === 'init') {
    return (
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-6 text-center">
        <h3 className="font-heading text-[17px] text-primary mb-2">
          Initialiser le plan d'actions
        </h3>
        <p className="font-body text-sm text-muted-foreground mb-5">
          Je peux générer les premières actions à partir de ta proposition commerciale validée.
        </p>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="gap-2 font-body"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Générer les actions depuis la proposition
            </>
          )}
        </Button>
      </div>
    );
  }

  // Complement button (actions already exist)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGenerate}
      disabled={isGenerating}
      className="font-body gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Génération...
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          Compléter depuis la proposition
        </>
      )}
    </Button>
  );
}
