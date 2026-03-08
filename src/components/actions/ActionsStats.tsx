import type { Action } from '@/hooks/useActions';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle } from 'lucide-react';

interface ActionsStatsProps {
  actions: Action[];
}

const DONE_STATUSES = ['validated', 'delivered', 'done'];

export function ActionsStats({ actions }: ActionsStatsProps) {
  const total = actions.length;
  const done = actions.filter((a) => DONE_STATUSES.includes(a.status)).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const overdue = actions.filter(
    (a) => a.target_date && a.target_date < today && !DONE_STATUSES.includes(a.status)
  ).length;

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Progress */}
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-4">
        <p className="font-body text-xs text-muted-foreground mb-2">Progression</p>
        <div className="flex items-center gap-3">
          <Progress value={percent} className="flex-1 h-2" />
          <span className="font-body text-sm font-medium text-foreground">{percent}%</span>
        </div>
        <p className="font-body text-xs text-muted-foreground mt-1">
          {done}/{total} actions terminées
        </p>
      </div>

      {/* Overdue */}
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-4">
        <p className="font-body text-xs text-muted-foreground mb-2">En retard</p>
        <div className="flex items-center gap-2">
          {overdue > 0 ? (
            <>
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning-orange))]" />
              <span className="font-body text-lg font-semibold text-[hsl(var(--warning-orange))]">
                {overdue}
              </span>
            </>
          ) : (
            <span className="font-body text-lg font-semibold text-foreground">0</span>
          )}
        </div>
      </div>
    </div>
  );
}
