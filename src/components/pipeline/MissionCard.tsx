import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Trash2, Mail, CalendarX, CalendarCheck } from 'lucide-react';
import type { Mission } from '@/lib/missions';
import { formatMissionType, formatAmount, timeAgo, getDaysSince } from '@/lib/missions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteMissionDialog } from './DeleteMissionDialog';
import { useDeleteMission, useMissionsActivity, useMissionsNextSession } from '@/hooks/useMissions';
import { FollowUpEmailDialog } from '@/components/mission/FollowUpEmailDialog';

interface MissionCardProps {
  mission: Mission;
}

export function MissionCard({ mission }: MissionCardProps) {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const deleteMission = useDeleteMission();
  const { data: activity = {} } = useMissionsActivity();
  const { data: nextSessions = {} } = useMissionsNextSession();
  const nextSession = nextSessions[mission.id];
  const noUpcoming = !nextSession && (mission.status === 'active' || mission.status === 'signed');
  const canFollowUp = mission.status === 'proposal_sent' || mission.status === 'signed';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: mission.id,
    data: { mission },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : 1,
    boxShadow: isDragging ? 'var(--card-shadow-drag)' : undefined,
    rotate: isDragging ? '1.5deg' : undefined,
  };


  // Charte : plus de barre de couleur sur le côté des cartes (tic banni).
  // Le retard devient un badge lisible au lieu d'un filet à décoder.
  // La date de référence = dernière activité réelle (atelier, action, journal),
  // pas seulement la modification de la fiche mission.
  const lastActivity =
    activity[mission.id] && activity[mission.id] > mission.updated_at
      ? activity[mission.id]
      : mission.updated_at;
  const daysSinceUpdate = getDaysSince(lastActivity);
  const staleBadge =
    daysSinceUpdate > 14
      ? { label: `Sans nouvelle depuis ${daysSinceUpdate} j`, cls: 'bg-warning-red text-primary-foreground' }
      : daysSinceUpdate > 7
        ? { label: 'À relancer', cls: 'bg-jaune text-jaune-foreground' }
        : null;

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
        onClick={() =>
          navigate(
            mission.status === 'active'
              ? `/dashboard/mission/${mission.id}/follow-up`
              : `/dashboard/mission/${mission.id}`
          )
        }
        className="bg-card border border-border rounded-xl shadow-[var(--card-shadow)] p-4 cursor-grab active:cursor-grabbing select-none transition-all duration-200 hover:shadow-[var(--card-shadow-hover)] hover:-translate-y-0.5 hover:border-primary/40 relative group"
      >
        {/* Menu three dots */}
        <div className="absolute top-2 right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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

        <p className="font-body font-bold text-[15px] text-card-foreground leading-snug mb-3 break-words pr-7">
          {mission.client_name}
        </p>

        <div className="flex items-center justify-between gap-2">
          {typeBadge()}
          {amount && (
            <span className="font-body text-sm text-foreground font-semibold tabular-nums">
              {amount}
            </span>
          )}
        </div>

        <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          <p className="font-body text-[11px] text-muted-foreground">
            {timeAgo(lastActivity)}
          </p>
          <div className="flex items-center gap-1.5">
            {noUpcoming ? (
              <span
                title="Aucun atelier planifié"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-jaune/25 text-foreground"
              >
                <CalendarX className="h-3 w-3" />
                Pas d'atelier planifié
              </span>
            ) : nextSession ? (
              <span
                title="Prochain atelier"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                <CalendarCheck className="h-3 w-3" />
                {new Date(nextSession).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            ) : null}
            {staleBadge && (
              <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${staleBadge.cls}`}>
                {staleBadge.label}
              </span>
            )}
          </div>
        </div>

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
