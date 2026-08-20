import { useDroppable } from '@dnd-kit/core';
import { MissionCard } from './MissionCard';
import type { Mission } from '@/lib/missions';
import type { PhaseProgress } from '@/hooks/useMissions';

interface KanbanColumnProps {
  id: string;
  label: string;
  missions: Mission[];
  isLost?: boolean;
  phaseProgress?: Record<string, PhaseProgress>;
}

export function KanbanColumn({ id, label, missions, isLost, phaseProgress }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={`flex flex-col min-w-[280px] w-[280px] flex-shrink-0 rounded-2xl bg-column border border-column-border ${
        isLost ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <h3 className="font-body text-[13px] font-semibold uppercase tracking-wide text-foreground">
          {label}
        </h3>
        <span className="font-body text-[11px] font-semibold text-muted-foreground bg-background border border-column-border rounded-full px-2 py-0.5">
          {missions.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-3 min-h-[140px] rounded-xl p-2 m-1 transition-colors border-2 border-dashed ${
          isOver ? 'border-primary bg-accent/50' : 'border-transparent'
        }`}
      >
        {missions.map((mission) => (
          <MissionCard key={mission.id} mission={mission} phaseProgress={phaseProgress?.[mission.id]} />
        ))}
      </div>
    </div>
  );
}


