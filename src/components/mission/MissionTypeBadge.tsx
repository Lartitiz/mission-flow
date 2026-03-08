import { useState } from 'react';
import { useUpdateMission } from '@/hooks/useMissions';
import { formatMissionType } from '@/lib/missions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MissionTypeBadgeProps {
  missionId: string;
  currentType: string;
}

const TYPES = [
  { value: 'non_determine', label: 'Non déterminé', className: 'bg-badge-gray text-badge-gray-foreground' },
  { value: 'binome', label: 'Binôme', className: 'bg-badge-rose text-primary-foreground' },
  { value: 'agency', label: 'Agency', className: 'bg-badge-bordeaux text-primary-foreground' },
] as const;

export function MissionTypeBadge({ missionId, currentType }: MissionTypeBadgeProps) {
  const updateMission = useUpdateMission();
  const [open, setOpen] = useState(false);

  const current = TYPES.find((t) => t.value === currentType) ?? TYPES[0];

  const handleSelect = (value: string) => {
    if (value !== currentType) {
      updateMission.mutate({ id: missionId, mission_type: value });
    }
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium font-body cursor-pointer transition-opacity hover:opacity-80 ${current.className}`}
        >
          {formatMissionType(currentType)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {TYPES.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => handleSelect(t.value)}
            className="font-body text-sm cursor-pointer"
          >
            <span className={`inline-block w-2.5 h-2.5 rounded-sm mr-2 ${t.className}`} />
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
