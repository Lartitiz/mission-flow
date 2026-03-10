import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Trash2, Mail } from 'lucide-react';
import type { Mission } from '@/lib/missions';
import { formatMissionType, formatAmount, timeAgo, getDaysSince } from '@/lib/missions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteMissionDialog } from './DeleteMissionDialog';
import { useDeleteMission } from '@/hooks/useMissions';
import { FollowUpEmailDialog } from '@/components/mission/FollowUpEmailDialog';

interface MissionCardProps {
  mission: Mission;
}

export function MissionCard({ mission }: MissionCardProps) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const deleteMission = useDeleteMission();
  const canFollowUp = mission.status === 'proposal_sent' || mission.status === 'signed';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: mission.id,
    data: { mission },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  const daysSinceUpdate = getDaysSince(mission.updated_at);
  const borderColor =
    daysSinceUpdate > 14
      ? 'border-l-warning-red'
      : daysSinceUpdate > 7
        ? 'border-l-warning-orange'
        : 'border-l-transparent';

  const typeBadge = () => {
    const label = formatMissionType(mission.mission_type);
    switch (mission.mission_type) {
      case 'binome':
        return (
          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-badge-rose text-primary-foreground">
            {label}
          </span>
        );
      case 'agency':
        return (
          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-badge-bordeaux text-primary-foreground">
            {label}
          </span>
        );
      default:
        return (
          <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-badge-gray text-badge-gray-foreground">
            {label}
          </span>
        );
    }
  };

  const amount = formatAmount(mission.amount);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={() => navigate(`/dashboard/mission/${mission.id}`)}
        className={`bg-card rounded-xl border-l-4 ${borderColor} shadow-[var(--card-shadow)] p-4 cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md relative group`}
      >
        {/* Menu three dots */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted"
            >
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {canFollowUp && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setFollowUpOpen(true);
                  }}
                  className="font-body text-sm"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Relancer
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteOpen(true);
                }}
                className="text-destructive focus:text-destructive font-body text-sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="font-heading text-sm text-card-foreground leading-snug mb-2 break-words pr-6">
          {mission.client_name}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {typeBadge()}
          {amount && (
            <span className="font-body text-xs text-muted-foreground font-medium">
              {amount}
            </span>
          )}
        </div>

        <p className="font-body text-[11px] text-muted-foreground mt-2">
          {timeAgo(mission.updated_at)}
        </p>
      </div>

      <DeleteMissionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        clientName={mission.client_name}
        onConfirm={() => deleteMission.mutate(mission.id)}
        isPending={deleteMission.isPending}
      />

      {canFollowUp && (
        <FollowUpEmailDialog
          open={followUpOpen}
          onOpenChange={setFollowUpOpen}
          clientName={mission.client_name}
          clientEmail={mission.client_email ?? null}
          missionType={mission.mission_type}
          missionStatus={mission.status}
          amount={mission.amount ?? null}
          clientToken={mission.client_token}
          missionId={mission.id}
        />
      )}
    </>
  );
}
