import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DiscoveryTab } from '@/components/discovery/DiscoveryTab';
import { ProposalTab } from '@/components/proposal/ProposalTab';

interface MissionTabsProps {
  missionId: string;
  clientName: string;
  statusIndex: number;
  hasStructuredNotes: boolean;
  currentMissionType: string;
}

interface TabDef {
  id: string;
  label: string;
  isAvailable: boolean;
  disabledReason?: string;
}

export function MissionTabs({ missionId, statusIndex, hasStructuredNotes, currentMissionType }: MissionTabsProps) {
  const tabs: TabDef[] = [
    {
      id: 'discovery',
      label: 'Appel découverte',
      isAvailable: true,
    },
    {
      id: 'proposal',
      label: 'Proposition',
      isAvailable: hasStructuredNotes,
      disabledReason: "Disponible après l'appel découverte",
    },
    {
      id: 'kickoff',
      label: 'Kick-off',
      isAvailable: statusIndex >= 3, // signed
      disabledReason: 'Disponible après la signature',
    },
    {
      id: 'actions',
      label: "Plan d'actions",
      isAvailable: statusIndex >= 4, // active
      disabledReason: 'Disponible après le kick-off',
    },
    {
      id: 'follow-up',
      label: 'Suivi',
      isAvailable: statusIndex >= 4, // active
      disabledReason: 'Disponible après le kick-off',
    },
  ];

  const [activeTab, setActiveTab] = useState('discovery');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          if (!tab.isAvailable) {
            return (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    disabled
                    className="px-4 py-3 font-body text-sm text-muted-foreground/50 cursor-not-allowed whitespace-nowrap"
                  >
                    {tab.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-body text-xs">{tab.disabledReason}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

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
        {activeTab === 'discovery' ? (
          <DiscoveryTab missionId={missionId} currentMissionType={currentMissionType} />
        ) : (
          <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8">
            <p className="font-body text-muted-foreground">
              Section{' '}
              <span className="font-medium text-foreground">
                {tabs.find((t) => t.id === activeTab)?.label}
              </span>{' '}
              — à venir
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
