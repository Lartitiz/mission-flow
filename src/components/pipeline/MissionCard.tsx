import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import type { Mission } from '@/lib/missions';
import { formatMissionType, formatAmount, timeAgo, getDaysSince } from '@/lib/missions';

interface MissionCardProps {
  mission: Mission;
}

export function MissionCard({ mission }: MissionCardProps) {
  const navigate = useNavigate();
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
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => navigate(`/dashboard/mission/${mission.id}`)}
      className={`bg-card rounded-xl border-l-4 ${borderColor} shadow-[var(--card-shadow)] p-4 cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md`}
    >
      <p className="font-heading text-sm text-card-foreground leading-snug mb-2">
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
  );
}
