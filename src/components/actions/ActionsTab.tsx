import { useState } from 'react';
import { useActions, type Action } from '@/hooks/useActions';
import { ActionsStats } from './ActionsStats';
import { ActionsTable } from './ActionsTable';
import { ClientActionsTable } from './ClientActionsTable';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActionsTabProps {
  missionId: string;
  clientName: string;
}

export function ActionsTab({ missionId, clientName }: ActionsTabProps) {
  const { actions, isLoading, addAction, updateAction, deleteAction, reorderActions, isSaving } =
    useActions(missionId);
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<'laetitia' | 'client'>('laetitia');
  const [aiText, setAiText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const myActions = actions.filter((a) => a.assignee === 'laetitia');
  const clientActions = actions.filter((a) => a.assignee === 'client');

  const handleExtractAi = () => {
    setIsExtracting(true);
    setTimeout(() => {
      toast({
        title: 'Bientôt disponible',
        description: "L'extraction IA des actions sera implémentée prochainement.",
      });
      setIsExtracting(false);
    }, 1000);
  };

  if (isLoading) {
    return <p className="font-body text-muted-foreground py-8">Chargement...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <ActionsStats actions={actions} />

      {/* Sub-tabs */}
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

      {/* Table */}
      {subTab === 'laetitia' ? (
        <div className="space-y-3">
          <ActionsTable
            actions={myActions}
            onUpdate={updateAction}
            onDelete={deleteAction}
            onReorder={reorderActions}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => addAction('laetitia')}
            className="font-body gap-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter une action
          </Button>
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

      {/* AI extraction section */}
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
              Extraction...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Extraire les actions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
