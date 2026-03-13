import { useState } from 'react';
import { useActions, type Action } from '@/hooks/useActions';
import { ActionsStats } from './ActionsStats';
import { ActionsTable } from './ActionsTable';
import { ClientActionsTable } from './ClientActionsTable';
import { AiExtractionResults } from './AiExtractionResults';
import { ActionsFromProposalCard } from './ActionsFromProposalCard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Plus, Upload, Wand2, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExcelImportDialog } from './ExcelImportDialog';
import { DefaultActionsDialog } from './DefaultActionsDialog';

interface ActionsTabProps {
  missionId: string;
  clientName: string;
  showDefaultActions?: boolean;
  onDefaultActionsDismissed?: () => void;
}

interface AiNewAction {
  assignee: string;
  category: string;
  task: string;
  description: string;
  channel?: string;
  target_date?: string;
}

interface AiUpdate {
  action_id: string;
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
}

export function ActionsTab({ missionId, clientName }: ActionsTabProps) {
  const { actions, isLoading, addAction, updateAction, deleteAction, reorderActions, isSaving } =
    useActions(missionId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<'laetitia' | 'client'>('laetitia');
  const [aiText, setAiText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [extractionResults, setExtractionResults] = useState<{
    new_actions: AiNewAction[];
    updates: AiUpdate[];
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: mission } = useQuery({
    queryKey: ['mission-type-actions', missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('missions')
        .select('mission_type, client_name')
        .eq('id', missionId)
        .single();
      return data;
    },
    enabled: !!missionId,
  });

  const { data: proposal } = useQuery({
    queryKey: ['proposal-for-actions', missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposals')
        .select('id, content')
        .eq('mission_id', missionId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!missionId,
  });

  const myActions = actions.filter((a) => a.assignee === 'laetitia');
  const clientActions = actions.filter((a) => a.assignee === 'client');

  const handleExtractAi = async () => {
    if (!aiText.trim()) return;
    setIsExtracting(true);
    setExtractionResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('extract-actions-from-cr', {
        body: {
          meeting_notes: aiText,
          existing_actions: actions.map((a) => ({
            id: a.id,
            task: a.task,
            description: a.description,
            status: a.status,
            assignee: a.assignee,
            target_date: a.target_date,
            category: a.category,
            channel: a.channel,
          })),
          mission_type: mission?.mission_type ?? 'binome',
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
        return;
      }

      const newActions = data?.new_actions ?? [];
      const updates = data?.updates ?? [];

      if (newActions.length === 0 && updates.length === 0) {
        toast({ title: 'Aucune action détectée', description: 'Le CR ne contient pas de nouvelles actions identifiables.' });
        return;
      }

      setExtractionResults({ new_actions: newActions, updates });
      toast({
        title: 'Extraction terminée',
        description: `${newActions.length} nouvelle(s) action(s) et ${updates.length} mise(s) à jour proposée(s).`,
      });
    } catch (e) {
      console.error('Extract actions error:', e);
      toast({
        title: 'Erreur',
        description: "Impossible d'extraire les actions. Réessaie dans quelques instants.",
        variant: 'destructive',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApplyExtraction = async (selectedNew: AiNewAction[], selectedUpdates: AiUpdate[]) => {
    setIsApplying(true);
    try {
      // Insert new actions
      for (const action of selectedNew) {
        const maxSort = actions.length > 0
          ? Math.max(...actions.filter((a) => a.assignee === action.assignee).map((a) => a.sort_order)) + 1
          : 0;

        const { error } = await supabase.from('actions').insert({
          mission_id: missionId,
          assignee: action.assignee,
          task: action.task,
          description: action.description || null,
          category: action.category || null,
          channel: action.channel || null,
          target_date: action.target_date || null,
          sort_order: maxSort,
          status: 'not_started',
        });
        if (error) console.error('Insert action error:', error);
      }

      // Apply updates
      for (const update of selectedUpdates) {
        const { error } = await supabase
          .from('actions')
          .update({ [update.field]: update.new_value })
          .eq('id', update.action_id);
        if (error) console.error('Update action error:', error);
      }

      toast({
        title: 'Changements appliqués',
        description: `${selectedNew.length} action(s) créée(s), ${selectedUpdates.length} mise(s) à jour.`,
      });

      setExtractionResults(null);
      setAiText('');
      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
    } catch (e) {
      console.error('Apply extraction error:', e);
      toast({
        title: 'Erreur',
        description: "Erreur lors de l'application des changements.",
        variant: 'destructive',
      });
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading) {
    return <p className="font-body text-muted-foreground py-8">Chargement...</p>;
  }

  const hasProposal = proposal?.content && (
    Array.isArray(proposal.content) ||
    (typeof proposal.content === 'object' && 'sections' in (proposal.content as Record<string, unknown>))
  );

  const maxSort = actions.length > 0 ? Math.max(...actions.map((a) => a.sort_order)) : -1;

  return (
    <div className="space-y-6">
      {/* Init card when 0 actions + proposal exists */}
      {actions.length === 0 && hasProposal && (
        <ActionsFromProposalCard
          missionId={missionId}
          clientName={mission?.client_name || clientName}
          missionType={mission?.mission_type || 'binome'}
          proposalContent={proposal.content}
          existingActionsCount={0}
          maxSortOrder={-1}
          variant="init"
        />
      )}

      <div className="flex items-center justify-between">
        <ActionsStats actions={actions} />
        <div className="flex gap-2">
          {actions.length > 0 && hasProposal && (
            <ActionsFromProposalCard
              missionId={missionId}
              clientName={mission?.client_name || clientName}
              missionType={mission?.mission_type || 'binome'}
              proposalContent={proposal.content}
              existingActionsCount={actions.length}
              maxSortOrder={maxSort}
              variant="complement"
            />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="font-body gap-2"
          >
            <Upload className="h-3.5 w-3.5" />
            Importer un Excel
          </Button>
        </div>
      </div>

      <ExcelImportDialog
        missionId={missionId}
        existingActionsCount={actions.length}
        maxSortOrder={maxSort}
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setSubTab('laetitia')}
          className={`px-4 py-2.5 font-body text-sm border-b-2 -mb-px transition-colors ${
            subTab === 'laetitia'
              ? 'border-primary text-foreground font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Mes actions ({myActions.length})
        </button>
        <button
          onClick={() => setSubTab('client')}
          className={`px-4 py-2.5 font-body text-sm border-b-2 -mb-px transition-colors ${
            subTab === 'client'
              ? 'border-primary text-foreground font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Actions client·e ({clientActions.length})
        </button>
      </div>

      {subTab === 'laetitia' ? (
        <div className="space-y-3">
          <ActionsTable
            actions={myActions}
            onUpdate={updateAction}
            onDelete={deleteAction}
            onReorder={reorderActions}
          />
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => addAction('laetitia')}
              className="font-body gap-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter une action
            </Button>
            {myActions.some((a) => !a.category && a.task.trim()) && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const uncategorized = myActions.filter((a) => !a.category && a.task.trim());
                  if (!uncategorized.length) return;
                  setIsCategorizing(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('auto-categorize-actions', {
                      body: {
                        actions: uncategorized.map((a) => ({
                          id: a.id,
                          task: a.task,
                          description: a.description,
                          channel: a.channel,
                        })),
                      },
                    });
                    if (error || data?.error) {
                      toast({ title: 'Erreur', description: data?.error || 'Erreur IA', variant: 'destructive' });
                      return;
                    }
                    const cats = data?.categorizations as { id: string; category: string }[];
                    if (cats?.length) {
                      for (const c of cats) {
                        updateAction(c.id, { category: c.category });
                      }
                      toast({ title: 'Catégorisation terminée', description: `${cats.length} action(s) catégorisée(s).` });
                    }
                  } catch {
                    toast({ title: 'Erreur', description: 'Impossible de catégoriser.', variant: 'destructive' });
                  } finally {
                    setIsCategorizing(false);
                  }
                }}
                disabled={isCategorizing}
                className="font-body gap-2"
              >
                {isCategorizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Auto-catégoriser
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <ClientActionsTable
            actions={clientActions}
            missionId={missionId}
            onUpdate={updateAction}
            onDelete={deleteAction}
            onReorder={reorderActions}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => addAction('client')}
            className="font-body gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une action client·e
          </Button>
        </div>
      )}

      {/* AI extraction */}
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-5 space-y-3">
        <h3 className="font-heading text-sm font-medium text-foreground">
          Mise à jour IA
        </h3>
        <Textarea
          value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          placeholder="Coller un compte-rendu de réunion..."
          className="font-body text-sm min-h-[100px]"
        />
        <Button
          onClick={handleExtractAi}
          disabled={!aiText.trim() || isExtracting}
          className="font-body gap-2"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Extraction en cours... (jusqu'à 30s)
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Extraire les actions
            </>
          )}
        </Button>
        <p className="font-body text-xs text-muted-foreground">
          Astuce : tu peux aussi dicter tes notes directement dans l'onglet Suivi → Sessions
        </p>
      </div>

      {/* Extraction results panel */}
      {extractionResults && (
        <AiExtractionResults
          newActions={extractionResults.new_actions}
          updates={extractionResults.updates}
          onApply={handleApplyExtraction}
          onCancel={() => setExtractionResults(null)}
          isApplying={isApplying}
        />
      )}
    </div>
  );
}
