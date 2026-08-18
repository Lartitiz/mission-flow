import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMission, useUpdateMission, useMissionDiscoveryCalls, useDeleteMission } from '@/hooks/useMissions';
import { formatMissionType, formatAmount, statusLabel, statusColor, statusIndex } from '@/lib/missions';
import { MissionTypeBadge } from '@/components/mission/MissionTypeBadge';
import { MissionTabs } from '@/components/mission/MissionTabs';
import { ClientLinkDialog } from '@/components/mission/ClientLinkDialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreHorizontal, Trash2, Globe, Mail } from 'lucide-react';
import { LaunchEmailDialog } from '@/components/mission/LaunchEmailDialog';
import { FollowUpEmailDialog } from '@/components/mission/FollowUpEmailDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteMissionDialog } from '@/components/pipeline/DeleteMissionDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const MissionDetail = () => {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const { data: mission, isLoading, isError } = useMission(id!);
  const { data: discoveryCalls } = useMissionDiscoveryCalls(id!);
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();

  const [editingAmount, setEditingAmount] = useState(false);
  const [amountValue, setAmountValue] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clientLinkOpen, setClientLinkOpen] = useState(false);
  const [launchEmailOpen, setLaunchEmailOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [showDefaultActions, setShowDefaultActions] = useState(false);
  const canFollowUp = mission?.status === 'proposal_sent' || mission?.status === 'signed';
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Fetch kickoff for questionnaire info
  const { data: kickoff } = useQuery({
    queryKey: ['kickoff', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('kickoffs')
        .select('questionnaire_token, questionnaire_status')
        .eq('mission_id', id!)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (editingAmount && amountInputRef.current) {
      amountInputRef.current.focus();
    }
  }, [editingAmount]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  useEffect(() => {
    if (editingEmail && emailInputRef.current) {
      emailInputRef.current.focus();
      emailInputRef.current.select();
    }
  }, [editingEmail]);


  // Auto-trigger default actions dialog when mission is signed and no client actions exist
  useEffect(() => {
    if (mission?.status === 'signed' && mission?.id) {
      supabase
        .from('actions')
        .select('id')
        .eq('mission_id', mission.id)
        .eq('assignee', 'client')
        .limit(1)
        .then(({ data }) => {
          if (!data || data.length === 0) {
            setShowDefaultActions(true);
          }
        });
    }
  }, [mission?.status, mission?.id]);

  // Sans ce cas, un lien vers une mission supprimée (ou une erreur réseau)
  // laissait « Chargement... » à l'écran pour toujours : isLoading repasse à
  // false mais mission reste undefined.
  if (isError || (!isLoading && !mission)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground font-body">
          Mission introuvable : elle a peut-être été supprimée.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/dashboard')}
          className="font-body"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour au pipeline
        </Button>
      </div>
    );
  }

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

  const handleDelete = () => {
    deleteMission.mutate(mission.id, {
      onSuccess: () => {
        navigate('/dashboard');
      },
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="font-body text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Pipeline
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive font-body text-sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer la mission
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => {
                setEditingName(false);
                const v = nameValue.trim();
                if (v && v !== mission.client_name) {
                  updateMission.mutate({ id: mission.id, client_name: v });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="font-heading text-2xl text-foreground mr-2 border border-input rounded-lg px-2 py-0.5 bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <h1
              className="font-heading text-2xl text-foreground mr-2 cursor-pointer hover:opacity-70 transition-opacity"
              onClick={() => {
                setNameValue(mission.client_name);
                setEditingName(true);
              }}
              title="Cliquer pour modifier"
            >
              {mission.client_name}
            </h1>
          )}

          <MissionTypeBadge
            missionId={mission.id}
            currentType={mission.mission_type}
          />

          <span
            className={`inline-block rounded-lg px-2.5 py-1 text-xs font-medium font-body ${sc.bg} ${sc.text}`}
          >
            {statusLabel(mission.status)}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setClientLinkOpen(true)}
            className="font-body gap-2 text-xs"
          >
            <Globe className="h-3.5 w-3.5" />
            Espace client
          </Button>

          {canFollowUp && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFollowUpOpen(true)}
              className="font-body gap-2 text-xs"
            >
              <Mail className="h-3.5 w-3.5" />
              Relancer
            </Button>
          )}

          {(mission.status === 'signed' || mission.status === 'active') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLaunchEmailOpen(true)}
              className="font-body gap-2 text-xs"
            >
              <Mail className="h-3.5 w-3.5" />
              Email de lancement
            </Button>
          )}

          {/* Editable client email */}
          {editingEmail ? (
            <input
              ref={emailInputRef}
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              onBlur={() => {
                setEditingEmail(false);
                const v = emailValue.trim();
                if ((v || null) !== (mission.client_email || null)) {
                  updateMission.mutate({ id: mission.id, client_email: v || null });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') setEditingEmail(false);
              }}
              className="font-body text-sm border border-input rounded-lg px-3 py-1 w-56 bg-background outline-none focus:ring-1 focus:ring-ring"
              placeholder="email@client.com"
            />
          ) : (
            <button
              onClick={() => {
                setEmailValue(mission.client_email ?? '');
                setEditingEmail(true);
              }}
              title="Cliquer pour modifier l'email"
              className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-lg px-2.5 py-1 hover:bg-secondary inline-flex items-center gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" />
              {mission.client_email || '+ Email'}
            </button>
          )}

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
        clientName={mission.client_name}
        clientEmail={mission.client_email}
        amount={mission.amount}
        statusIndex={si}
        initialTab={tab}
        hasStructuredNotes={!!hasStructuredNotes}
        currentMissionType={mission.mission_type}
        showDefaultActions={showDefaultActions}
        onDefaultActionsDismissed={() => setShowDefaultActions(false)}
      />

      <DeleteMissionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        clientName={mission.client_name}
        onConfirm={handleDelete}
        isPending={deleteMission.isPending}
      />

      <ClientLinkDialog
        open={clientLinkOpen}
        onOpenChange={setClientLinkOpen}
        clientToken={mission.client_token}
        clientSlug={mission.client_slug}
        clientLinkActive={mission.client_link_active ?? true}
        onToggleActive={(active) => {
          updateMission.mutate({ id: mission.id, client_link_active: active });
        }}
        onSlugChange={(slug) => {
          updateMission.mutate(
            { id: mission.id, client_slug: slug },
            {
              onError: () => {
                toast({
                  title: 'Ce nom de lien est déjà utilisé',
                  description: 'Choisis une autre variante (ex. prenom-nom-2).',
                  variant: 'destructive',
                });
              },
            }
          );
        }}
        questionnaireToken={kickoff?.questionnaire_token}
        questionnaireStatus={kickoff?.questionnaire_status}
      />

      <LaunchEmailDialog
        open={launchEmailOpen}
        onOpenChange={setLaunchEmailOpen}
        clientName={mission.client_name}
        clientEmail={mission.client_email}
        missionType={mission.mission_type}
        missionId={mission.id}
        amount={mission.amount}
        clientToken={mission.client_token}
        clientSlug={mission.client_slug}
      />


      {canFollowUp && (
        <FollowUpEmailDialog
          open={followUpOpen}
          onOpenChange={setFollowUpOpen}
          clientName={mission.client_name}
          clientEmail={mission.client_email ?? null}
          missionType={mission.mission_type}
          missionStatus={mission.status}
          amount={mission.amount}
          clientToken={mission.client_token}
          missionId={mission.id}
        />
      )}
    </div>
  );
};

export default MissionDetail;
