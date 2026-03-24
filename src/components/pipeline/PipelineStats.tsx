import type { Mission } from '@/lib/missions';
import { formatAmount } from '@/lib/missions';

interface PipelineStatsProps {
  missions: Mission[];
}

export function PipelineStats({ missions }: PipelineStatsProps) {
  const prospectionStatuses = ['discovery_call', 'proposal_drafting', 'proposal_sent'];

  const prospectionMissions = missions.filter((m) =>
    prospectionStatuses.includes(m.status)
  );
  const caPotentiel = prospectionMissions.reduce(
    (sum, m) => sum + (m.amount ?? 0),
    0
  );
  const activeMissions = missions.filter((m) => m.status === 'active');
  const signedStatuses = ['signed', 'active', 'completed'];
  const caGenere = missions
    .filter((m) => signedStatuses.includes(m.status))
    .reduce((sum, m) => sum + (m.amount ?? 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
      <div className="bg-card rounded-xl p-5 min-w-[180px] shadow-[var(--card-shadow)]">
        <p className="font-body text-xs text-muted-foreground mb-1">Propositions en cours</p>
        <p className="font-heading text-2xl text-foreground">{prospectionMissions.length}</p>
      </div>
      <div className="bg-card rounded-xl p-5 min-w-[180px] shadow-[var(--card-shadow)]">
        <p className="font-body text-xs text-muted-foreground mb-1">CA potentiel</p>
        <p className="font-heading text-2xl text-foreground">
          {formatAmount(caPotentiel) ?? '0 €'}
        </p>
      </div>
      <div className="bg-card rounded-xl p-5 min-w-[180px] shadow-[var(--card-shadow)]">
        <p className="font-body text-xs text-muted-foreground mb-1">Missions actives</p>
        <p className="font-heading text-2xl text-foreground">{activeMissions.length}</p>
      </div>
      <div className="bg-card rounded-xl p-5 min-w-[180px] shadow-[var(--card-shadow)]">
        <p className="font-body text-xs text-muted-foreground mb-1">CA signé</p>
        <p className="font-heading text-2xl text-foreground">
          {formatAmount(caGenere) ?? '0 €'}
        </p>
      </div>
    </div>
  );
}
