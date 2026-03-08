import type { Action } from '@/hooks/useActions';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

  const totalHours = actions.reduce((sum, a) => sum + (a.hours_estimated ?? 0), 0);
  const totalBudget = actions.reduce((sum, a) => sum + (Number(a.budget_ht) ?? 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Hours (admin) */}
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="font-body text-xs text-muted-foreground">Heures estimées</p>
          <Badge variant="outline" className="text-[9px] px-1 py-0 font-body">Admin</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-body text-lg font-semibold text-foreground">{totalHours}h</span>
        </div>
      </div>

      {/* Budget (admin) */}
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="font-body text-xs text-muted-foreground">Budget HT</p>
          <Badge variant="outline" className="text-[9px] px-1 py-0 font-body">Admin</Badge>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="font-body text-lg font-semibold text-foreground">
            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalBudget)}
          </span>
        </div>
      </div>
    </div>
  );
}
