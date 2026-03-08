import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight } from 'lucide-react';

interface NewAction {
  assignee: string;
  category: string;
  task: string;
  description: string;
  channel?: string;
  target_date?: string;
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
  const [newToggles, setNewToggles] = useState<boolean[]>(newActions.map(() => true));
  const [updateToggles, setUpdateToggles] = useState<boolean[]>(updates.map(() => true));

  const handleApply = () => {
    const selectedNew = newActions.filter((_, i) => newToggles[i]);
    const selectedUpdates = updates.filter((_, i) => updateToggles[i]);
    onApply(selectedNew, selectedUpdates);
  };

  const totalSelected = newToggles.filter(Boolean).length + updateToggles.filter(Boolean).length;

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] border border-primary/20 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-medium text-foreground">
          Résultats de l'extraction IA
        </h3>
        <Badge className="bg-primary/10 text-primary font-body text-xs">
          {newActions.length + updates.length} suggestion{newActions.length + updates.length > 1 ? 's' : ''}
        </Badge>
      </div>

      {/* New actions */}
      {newActions.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-body text-xs font-semibold text-foreground uppercase tracking-wider">
            Nouvelles actions ({newActions.length})
          </h4>
          <div className="space-y-2">
            {newActions.map((action, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  newToggles[idx] ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/20 opacity-60'
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
                  </div>
                  {action.description && (
                    <p className="font-body text-xs text-muted-foreground mt-1">{action.description}</p>
                  )}
                  {action.target_date && (
                    <p className="font-body text-[10px] text-muted-foreground mt-1">
                      📅 {action.target_date}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
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
