import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMission, useUpdateMission, useMissionDiscoveryCalls } from '@/hooks/useMissions';
import { formatMissionType, formatAmount, statusLabel, statusColor, statusIndex } from '@/lib/missions';
import { MissionTypeBadge } from '@/components/mission/MissionTypeBadge';
import { MissionTabs } from '@/components/mission/MissionTabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const MissionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: mission, isLoading } = useMission(id!);
  const { data: discoveryCalls } = useMissionDiscoveryCalls(id!);
  const updateMission = useUpdateMission();

  const [editingAmount, setEditingAmount] = useState(false);
  const [amountValue, setAmountValue] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingAmount && amountInputRef.current) {
      amountInputRef.current.focus();
    }
  }, [editingAmount]);

  if (isLoading || !mission) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground font-body">Chargement...</p>
      </div>
    );
  }

  const hasStructuredNotes = discoveryCalls?.some(
    (dc) => dc.structured_notes != null
  );
  const si = statusIndex(mission.status);
  const sc = statusColor(mission.status);

  const handleAmountClick = () => {
    setAmountValue(mission.amount != null ? String(mission.amount) : '');
    setEditingAmount(true);
  };

  const handleAmountSave = () => {
    setEditingAmount(false);
    const num = amountValue.trim() === '' ? null : parseFloat(amountValue);
    if (num !== mission.amount) {
      updateMission.mutate({ id: mission.id, amount: num });
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAmountSave();
    if (e.key === 'Escape') setEditingAmount(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="font-body text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Pipeline
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-xl text-foreground mr-2">
            {mission.client_name}
          </h1>

          <MissionTypeBadge
            missionId={mission.id}
            currentType={mission.mission_type}
          />

          <span
            className={`inline-block rounded-lg px-2.5 py-1 text-xs font-medium font-body ${sc.bg} ${sc.text}`}
          >
            {statusLabel(mission.status)}
          </span>

          {/* Editable amount */}
          {editingAmount ? (
            <input
              ref={amountInputRef}
              type="number"
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              onBlur={handleAmountSave}
              onKeyDown={handleAmountKeyDown}
              className="font-body text-sm border border-input rounded-lg px-3 py-1 w-32 bg-background outline-none focus:ring-1 focus:ring-ring"
              placeholder="Montant €"
            />
          ) : (
            <button
              onClick={handleAmountClick}
              className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-lg px-2.5 py-1 hover:bg-secondary"
            >
              {mission.amount != null
                ? formatAmount(mission.amount)
                : '+ Montant'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <MissionTabs
        missionId={mission.id}
        statusIndex={si}
        hasStructuredNotes={!!hasStructuredNotes}
      />
    </div>
  );
};

export default MissionDetail;
