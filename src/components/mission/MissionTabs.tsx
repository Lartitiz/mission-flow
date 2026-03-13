import { useState } from 'react';
import { DiscoveryTab } from '@/components/discovery/DiscoveryTab';
import { ProposalTab } from '@/components/proposal/ProposalTab';
import { KickoffTab } from '@/components/kickoff/KickoffTab';
import { ActionsTab } from '@/components/actions/ActionsTab';
import { FollowUpTab } from '@/components/followup/FollowUpTab';

interface MissionTabsProps {
  missionId: string;
  clientName: string;
  clientEmail?: string | null;
  amount?: number | null;
  statusIndex: number;
  hasStructuredNotes: boolean;
  currentMissionType: string;
  showDefaultActions?: boolean;
  onDefaultActionsDismissed?: () => void;
}

interface TabDef {
  id: string;
  label: string;
}

const ALL_TABS: TabDef[] = [
  { id: 'discovery', label: 'Appel découverte' },
  { id: 'proposal', label: 'Proposition' },
  { id: 'kickoff', label: 'Kick-off' },
  { id: 'actions', label: "Plan d'actions" },
  { id: 'follow-up', label: 'Suivi' },
];

// Map statusIndex to a default tab
function defaultTabForStatus(si: number): string {
  if (si <= 0) return 'discovery';
  if (si <= 2) return 'proposal';
  if (si === 3) return 'kickoff';
  if (si >= 4) return 'actions';
  return 'discovery';
}

function EmptyState() {
  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
      <p className="font-body text-muted-foreground">
        Pas encore de données. Tu peux remplir cette section quand tu veux.
      </p>
    </div>
  );
}

export function MissionTabs({ missionId, clientName, clientEmail, amount, statusIndex, hasStructuredNotes, currentMissionType, showDefaultActions, onDefaultActionsDismissed }: MissionTabsProps) {
  const [activeTab, setActiveTab] = useState(() => defaultTabForStatus(statusIndex));

  const renderContent = () => {
    switch (activeTab) {
      case 'discovery':
        return <DiscoveryTab missionId={missionId} clientName={clientName} currentMissionType={currentMissionType} />;
      case 'proposal':
        if (!hasStructuredNotes && statusIndex < 1) return <EmptyState />;
        return <ProposalTab missionId={missionId} clientName={clientName} clientEmail={clientEmail} missionType={currentMissionType} amount={amount} />;
      case 'kickoff':
        return <KickoffTab missionId={missionId} clientName={clientName} />;
      case 'actions':
        return <ActionsTab missionId={missionId} clientName={clientName} />;
      case 'follow-up':
        return <FollowUpTab missionId={missionId} clientName={clientName} missionType={currentMissionType} amount={amount} />;
      default:
        return <EmptyState />;
    }
  };

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {ALL_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-body text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
                isActive
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="py-6">
        {renderContent()}
      </div>
    </div>
  );
}
