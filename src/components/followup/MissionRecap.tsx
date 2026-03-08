import { Badge } from '@/components/ui/badge';
import { formatMissionType, formatAmount } from '@/lib/missions';

interface MissionRecapProps {
  missionType: string;
  amount?: number | null;
  createdAt?: string;
  summary?: string | null;
  totalActions: number;
  actionsPercent: number;
}

export function MissionRecap({ missionType, amount, createdAt, summary, totalActions, actionsPercent }: MissionRecapProps) {
  const signedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-5 space-y-3">
      <h3 className="font-heading text-base font-medium text-foreground">Récap mission</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-body text-xs">{formatMissionType(missionType)}</Badge>
        {amount != null && (
          <span className="font-body text-sm font-medium text-foreground">{formatAmount(amount)}</span>
        )}
        {signedDate && (
          <span className="font-body text-xs text-muted-foreground">Créée le {signedDate}</span>
        )}
      </div>
      {summary && (
        <p className="font-body text-sm text-foreground/80 leading-relaxed">{summary}</p>
      )}
      <p className="font-body text-sm text-muted-foreground">
        📋 {totalActions} action{totalActions !== 1 ? 's' : ''}, {actionsPercent}% terminées
      </p>
    </div>
  );
}
