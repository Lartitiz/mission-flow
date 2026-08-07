import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSessions } from '@/hooks/useSessions';
import { useJournal } from '@/hooks/useJournal';
import { useActions } from '@/hooks/useActions';
import { format } from 'date-fns';
import { MissionRecap } from './MissionRecap';
import { LaunchMessageCard } from './LaunchMessageCard';
import { NextSessionBookingMessage } from './NextSessionBookingMessage';
import { SessionHistory } from './SessionHistory';
import { JournalSection } from './JournalSection';
import { DocumentsSection } from './DocumentsSection';
import { ContextExport } from './ContextExport';
import { ClaudeProjectExport } from './ClaudeProjectExport';
import { AteliersCard } from './AteliersCard';

interface FollowUpTabProps {
  missionId: string;
  clientName: string;
  missionType: string;
  amount?: number | null;
}

const SOUS_ONGLETS = [
  { id: 'ateliers', label: 'Ateliers' },
  { id: 'journal', label: 'Journal' },
  { id: 'documents', label: 'Documents' },
  { id: 'outils', label: 'Outils & exports' },
] as const;

type SousOnglet = (typeof SOUS_ONGLETS)[number]['id'];

export function FollowUpTab({ missionId, clientName, missionType, amount }: FollowUpTabProps) {
  const queryClient = useQueryClient();
  const { sessions, isLoading: sessionsLoading, createSession, updateSession, deleteSession, isSaving: sessionsSaving } = useSessions(missionId);
  const { entries, isLoading: journalLoading, addEntry, isSaving: journalSaving } = useJournal(missionId);
  const { actions } = useActions(missionId);
  const [sousOnglet, setSousOnglet] = useState<SousOnglet>('ateliers');

  // Fetch proposal summary
  const { data: proposal } = useQuery({
    queryKey: ['proposal-summary', missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('proposals')
        .select('content')
        .eq('mission_id', missionId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch mission for created_at + objectif d'ateliers
  const { data: mission } = useQuery({
    queryKey: ['mission-followup', missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('missions')
        .select('created_at, status, planned_sessions_total')
        .eq('id', missionId)
        .single();
      return data as { created_at: string; status: string; planned_sessions_total: number | null } | null;
    },
  });

  const handleUpdatePlannedTotal = async (total: number | null) => {
    const { error } = await supabase
      .from('missions')
      .update({ planned_sessions_total: total } as never)
      .eq('id', missionId);
    if (error) console.error('[FollowUpTab] planned_sessions_total update failed', error);
    queryClient.invalidateQueries({ queryKey: ['mission-followup', missionId] });
  };

  if (sessionsLoading || journalLoading) {
    return <p className="font-body text-muted-foreground py-8">Chargement...</p>;
  }

  const proposalSummary = (() => {
    try {
      const content = proposal?.content as { sections?: { title: string; content: string }[] } | null;
      const first = content?.sections?.[0];
      if (first?.content) return first.content.slice(0, 200) + (first.content.length > 200 ? '...' : '');
    } catch {}
    return null;
  })();

  const doneStatuses = ['validated', 'delivered', 'done'];
  const totalActions = actions.length;
  const doneActions = actions.filter((a) => doneStatuses.includes(a.status)).length;
  const actionsPercent = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0;

  // Ateliers passés vs planifiés : la date fait foi (les planifiés sont dans le futur)
  const today = format(new Date(), 'yyyy-MM-dd');
  const pastSessions = sessions.filter((s) => s.session_date <= today);
  const futureSessions = sessions
    .filter((s) => s.session_date > today)
    .sort((a, b) => a.session_date.localeCompare(b.session_date));


  return (
    <div>
      <div className="flex gap-6 border-b border-border mb-6 overflow-x-auto">
        {SOUS_ONGLETS.map((o) => (
          <button
            key={o.id}
            onClick={() => setSousOnglet(o.id)}
            className={`pb-3 pt-1 font-body text-sm whitespace-nowrap transition-colors ${
              sousOnglet === o.id
                ? 'font-extrabold text-foreground [background:linear-gradient(transparent_62%,hsl(var(--jaune))_62%_92%,transparent_92%)]'
                : 'font-semibold text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {sousOnglet === 'ateliers' && (
        <div className="space-y-6">
          <MissionRecap
            missionType={missionType}
            amount={amount}
            createdAt={mission?.created_at}
            summary={proposalSummary}
            totalActions={totalActions}
            actionsPercent={actionsPercent}
          />
          <AteliersCard
            pastSessions={pastSessions}
            futureSessions={futureSessions}
            plannedTotal={
              mission?.planned_sessions_total ??
              (missionType === 'binome' ? 6 : null)
            }
            onUpdatePlannedTotal={handleUpdatePlannedTotal}
            onCreate={createSession}
            onUpdate={updateSession}
            onDelete={deleteSession}
            missionId={missionId}
            clientName={clientName}
          />
          <SessionHistory
            sessions={pastSessions}
            missionId={missionId}
            missionType={missionType}
            actions={actions}
            onCreate={createSession}
            onUpdate={updateSession}
            onDelete={deleteSession}
            addJournalEntry={addEntry}
            isSaving={sessionsSaving}
          />
        </div>
      )}

      {sousOnglet === 'journal' && (
        <JournalSection entries={entries} addEntry={addEntry} isSaving={journalSaving} />
      )}

      {sousOnglet === 'documents' && <DocumentsSection missionId={missionId} />}

      {sousOnglet === 'outils' && (
        <div className="space-y-6">
          <LaunchMessageCard clientName={clientName} />
          <NextSessionBookingMessage clientName={clientName} />
          <ContextExport missionId={missionId} clientName={clientName} />
          <ClaudeProjectExport missionId={missionId} clientName={clientName} />
        </div>
      )}
    </div>
  );
}
