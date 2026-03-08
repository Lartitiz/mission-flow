import { useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { useMissions, useUpdateMissionStatus } from '@/hooks/useMissions';
import { PIPELINE_COLUMNS } from '@/lib/missions';
import { KanbanColumn } from '@/components/pipeline/KanbanColumn';
import { PipelineStats } from '@/components/pipeline/PipelineStats';
import { NewMissionDialog } from '@/components/pipeline/NewMissionDialog';
import { MissionCard } from '@/components/pipeline/MissionCard';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const Pipeline = () => {
  const { data: missions = [], isLoading } = useMissions();
  const updateStatus = useUpdateMissionStatus();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveMissionId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveMissionId(null);
    const { active, over } = event;
    if (!over) return;

    const missionId = String(active.id);
    const newStatus = String(over.id);
    const mission = missions.find((m) => m.id === missionId);

    if (mission && mission.status !== newStatus) {
      updateStatus.mutate({ id: missionId, status: newStatus });
    }
  };

  const activeMission = activeMissionId
    ? missions.find((m) => m.id === activeMissionId)
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground font-body">Chargement du pipeline...</p>
      </div>
    );
  }

  return (
    <div className="relative pb-20 md:pb-0">
      <div className="flex items-start justify-between mb-6">
        <h1 className="font-heading text-2xl text-foreground">Pipeline</h1>
        {/* Desktop button */}
        <Button
          onClick={() => setDialogOpen(true)}
          className="font-body rounded-lg hidden md:inline-flex"
        >
          <Plus className="h-4 w-4 mr-1" />
          Nouvelle mission
        </Button>
      </div>

      <PipelineStats missions={missions} />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-5 overflow-x-auto pb-6 -mx-4 px-4 md:mx-0 md:px-0">
          {PIPELINE_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              missions={missions.filter((m) => m.status === col.id)}
              isLost={col.id === 'lost'}
            />
          ))}
        </div>

        <DragOverlay>
          {activeMission ? <MissionCard mission={activeMission} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Mobile FAB */}
      <Button
        onClick={() => setDialogOpen(true)}
        className="md:hidden fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg p-0"
        aria-label="Nouvelle mission"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <NewMissionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default Pipeline;
