import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSessions } from '@/hooks/useSessions';
import { useJournal } from '@/hooks/useJournal';
import { useActions } from '@/hooks/useActions';
import { MissionRecap } from './MissionRecap';
import { NextSessionCard } from './NextSessionCard';
import { SessionHistory } from './SessionHistory';
import { JournalSection } from './JournalSection';
import { DocumentsSection } from './DocumentsSection';
import { ContextExport } from './ContextExport';

interface FollowUpTabProps {
  missionId: string;
  clientName: string;
  missionType: string;
  amount?: number | null;
}

export function FollowUpTab({ missionId, clientName, missionType, amount }: FollowUpTabProps) {
  const { sessions, isLoading: sessionsLoading, createSession, updateSession, isSaving: sessionsSaving } = useSessions(missionId);
  const { entries, isLoading: journalLoading, addEntry, isSaving: journalSaving } = useJournal(missionId);
  const { actions } = useActions(missionId);

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

  // Fetch mission for created_at
  const { data: mission } = useQuery({
    queryKey: ['mission-followup', missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('missions')
        .select('created_at, status')
        .eq('id', missionId)
        .single();
      return data;
    },
  });

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

  const lastSession = sessions[0] ?? null;

  return (
    <div className="space-y-6">
      <MissionRecap
        missionType={missionType}
        amount={amount}
        createdAt={mission?.created_at}
        summary={proposalSummary}
        totalActions={totalActions}
        actionsPercent={actionsPercent}
      />

      <NextSessionCard
        session={lastSession}
        onUpdate={updateSession}
        onCreate={createSession}
        missionId={missionId}
        isSaving={sessionsSaving}
      />

      <SessionHistory
        sessions={sessions}
        missionId={missionId}
        missionType={missionType}
        actions={actions}
        onCreate={createSession}
        onUpdate={updateSession}
        onDelete={deleteSession}
        addJournalEntry={addEntry}
        isSaving={sessionsSaving}
      />

      <JournalSection entries={entries} addEntry={addEntry} isSaving={journalSaving} />

      <DocumentsSection missionId={missionId} />

      <ContextExport missionId={missionId} clientName={clientName} />
    </div>
  );
}
