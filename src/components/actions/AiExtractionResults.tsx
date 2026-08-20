import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, AlertTriangle } from 'lucide-react';

interface NewAction {
  assignee: string;
  category: string;
  task: string;
  description: string;
  channel?: string;
  target_date?: string;
  out_of_scope?: boolean;
  out_of_scope_reason?: string;
  scope_hint?: string;
}

interface ActionUpdate {
  action_id: string;
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
}

interface AiExtractionResultsProps {
  newActions: NewAction[];
  updates: ActionUpdate[];
  onApply: (selectedNew: NewAction[], selectedUpdates: ActionUpdate[]) => void;
  onCancel: () => void;
  isApplying: boolean;
}

export function AiExtractionResults({
  newActions,
  updates,
  onApply,
  onCancel,
  isApplying,
}: AiExtractionResultsProps) {
  const [newToggles, setNewToggles] = useState<boolean[]>(
    newActions.map((a) => !a.out_of_scope)
  );
  const [updateToggles, setUpdateToggles] = useState<boolean[]>(updates.map(() => true));

  const handleApply = () => {
    const selectedNew = newActions.filter((_, i) => newToggles[i]);
    const selectedUpdates = updates.filter((_, i) => updateToggles[i]);
    onApply(selectedNew, selectedUpdates);
  };

  const totalSelected = newToggles.filter(Boolean).length + updateToggles.filter(Boolean).length;

  const inScopeIdx = newActions.map((a, i) => (a.out_of_scope ? -1 : i)).filter((i) => i >= 0);
  const outScopeIdx = newActions.map((a, i) => (a.out_of_scope ? i : -1)).filter((i) => i >= 0);

  const renderAction = (idx: number) => {
    const action = newActions[idx];
    const outOfScope = !!action.out_of_scope;
    return (
      <div
        key={idx}
        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
          newToggles[idx]
            ? outOfScope
              ? 'border-destructive/30 bg-destructive/5'
              : 'border-primary/30 bg-primary/5'
            : 'border-border bg-secondary/20 opacity-60'
        }`}
      >
        <Switch
          checked={newToggles[idx]}
          onCheckedChange={(checked) => {
            const updated = [...newToggles];
            updated[idx] = !!checked;
            setNewToggles(updated);
          }}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-sm font-medium text-foreground">{action.task}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-body">
              {action.assignee === 'client' ? 'Client·e' : 'Laetitia'}
            </Badge>
            {action.category && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-body">
                {action.category}
              </Badge>
            )}
            {action.channel && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-body">
                {action.channel}
              </Badge>
            )}
            {outOfScope && (
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-body gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                {action.scope_hint === 'atelier' ? 'À voir en atelier' : 'Hors proposition'}
              </Badge>
            )}
          </div>
          {action.description && (
            <p className="font-body text-xs text-muted-foreground mt-1">{action.description}</p>
          )}
          {outOfScope && action.out_of_scope_reason && (
            <p className="font-body text-[10px] text-destructive mt-1 italic">
              {action.out_of_scope_reason}
            </p>
          )}
          {action.target_date && (
            <p className="font-body text-[10px] text-muted-foreground mt-1">
              📅 {action.target_date}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] border border-primary/20 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-body font-bold text-sm text-foreground">
          Résultats de l'extraction IA
        </h3>
        <Badge className="bg-primary/10 text-primary font-body text-xs">
          {newActions.length + updates.length} suggestion{newActions.length + updates.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {/* New actions — dans le périmètre */}
      {inScopeIdx.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-body text-xs font-semibold text-foreground uppercase tracking-wider">
            Nouvelles actions ({inScopeIdx.length})
          </h4>
          <div className="space-y-2">{inScopeIdx.map(renderAction)}</div>
        </div>
      )}

      {/* New actions — hors périmètre */}
      {outScopeIdx.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="font-body text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              Hors proposition validée ({outScopeIdx.length})
            </h4>
            <p className="font-body text-[11px] text-muted-foreground mt-1">
              Ces demandes ne figurent pas dans la proposition de départ : à discuter en atelier ou à
              cadrer à part avant de les ajouter. Décochées par défaut.
            </p>
          </div>
          <div className="space-y-2">{outScopeIdx.map(renderAction)}</div>
        </div>
      )}


      {/* Updates */}
      {updates.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-body text-xs font-semibold text-foreground uppercase tracking-wider">
            Mises à jour ({updates.length})
          </h4>
          <div className="space-y-2">
            {updates.map((update, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  updateToggles[idx] ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/20 opacity-60'
                }`}
              >
                <Switch
                  checked={updateToggles[idx]}
                  onCheckedChange={(checked) => {
                    const updated = [...updateToggles];
                    updated[idx] = !!checked;
                    setUpdateToggles(updated);
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-body capitalize">
                      {update.field}
                    </Badge>
                    <span className="font-body text-xs text-muted-foreground line-through">
                      {update.old_value || '(vide)'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-body text-xs font-medium text-foreground">
                      {update.new_value}
                    </span>
                  </div>
                  {update.reason && (
                    <p className="font-body text-[10px] text-muted-foreground mt-1 italic">
                      {update.reason}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <Button
          onClick={handleApply}
          disabled={totalSelected === 0 || isApplying}
          className="font-body gap-2"
        >
          <Check className="h-4 w-4" />
          Valider {totalSelected} changement{totalSelected > 1 ? 's' : ''}
        </Button>
        <Button variant="outline" onClick={onCancel} className="font-body">
          Annuler
        </Button>
      </div>
    </div>
  );
}
