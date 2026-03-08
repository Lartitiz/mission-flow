import { useDroppable } from '@dnd-kit/core';
import { MissionCard } from './MissionCard';
import type { Mission } from '@/lib/missions';

interface KanbanColumnProps {
  id: string;
  label: string;
  missions: Mission[];
  isLost?: boolean;
}

export function KanbanColumn({ id, label, missions, isLost }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={`flex flex-col min-w-[280px] w-[280px] flex-shrink-0 ${isLost ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2 mb-4 px-1">
        <h3 className="font-body text-sm font-semibold text-foreground">
          {label}
        </h3>
        <span className="font-body text-xs text-muted-foreground">
          ({missions.length})
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-3 min-h-[120px] rounded-xl p-2 transition-colors ${
          isOver ? 'bg-accent/60' : ''
        }`}
      >
        {missions.map((mission) => (
          <MissionCard key={mission.id} mission={mission} />
        ))}
      </div>
    </div>
  );
}
