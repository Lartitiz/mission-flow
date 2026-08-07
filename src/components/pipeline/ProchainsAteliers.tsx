import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AtelierAVenir {
  sessionId: string;
  missionId: string;
  clientName: string;
  topic: string | null;
  date: string;
}

interface MissionSansAtelier {
  missionId: string;
  clientName: string;
}

// Vue transversale : les ateliers à venir de toutes les missions actives,
// et les missions actives qui n'ont plus rien de planifié.
export function ProchainsAteliers() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['prochains-ateliers'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [missionsRes, sessionsRes] = await Promise.all([
        supabase
          .from('missions')
          .select('id, client_name, status')
          .in('status', ['signed', 'active']),
        supabase
          .from('sessions')
          .select('id, mission_id, topic, session_date')
          .gt('session_date', today)
          .order('session_date', { ascending: true }),
      ]);
      if (missionsRes.error) throw missionsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;

      const missions = missionsRes.data ?? [];
      const missionById = new Map(missions.map((m) => [m.id, m]));
      const aVenir: AtelierAVenir[] = (sessionsRes.data ?? [])
        .filter((s) => missionById.has(s.mission_id))
        .map((s) => ({
          sessionId: s.id,
          missionId: s.mission_id,
          clientName: missionById.get(s.mission_id)!.client_name,
          topic: (s as { topic?: string | null }).topic ?? null,
          date: s.session_date,
        }));
      const avecAtelier = new Set(aVenir.map((a) => a.missionId));
      const sansAtelier: MissionSansAtelier[] = missions
        .filter((m) => m.status === 'active' && !avecAtelier.has(m.id))
        .map((m) => ({ missionId: m.id, clientName: m.client_name }));
      return { aVenir, sansAtelier };
    },
  });

  if (!data || (data.aVenir.length === 0 && data.sansAtelier.length === 0)) return null;

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-5 mb-6">
      <h2 className="font-heading text-2xl text-foreground">Prochains ateliers</h2>
      <p className="font-body text-xs text-muted-foreground mb-2">
        Toutes missions actives confondues
      </p>
      <div className="divide-y divide-border/60">
        {data.aVenir.map((a) => (
          <button
            key={a.sessionId}
            onClick={() => navigate(`/dashboard/mission/${a.missionId}/follow-up`)}
            className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-secondary/60 rounded-lg px-2 -mx-2 transition-colors"
          >
            <span className="font-body text-sm font-bold min-w-[150px] truncate">{a.clientName}</span>
            <span className="font-body text-xs text-muted-foreground flex-1 truncate">
              {a.topic || 'Atelier'}
            </span>
            <span className="font-body text-xs font-bold whitespace-nowrap">
              {format(new Date(a.date), 'EEE d MMM', { locale: fr })}
            </span>
          </button>
        ))}
        {data.sansAtelier.map((m) => (
          <button
            key={m.missionId}
            onClick={() => navigate(`/dashboard/mission/${m.missionId}/follow-up`)}
            className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-secondary/60 rounded-lg px-2 -mx-2 transition-colors"
          >
            <span className="font-body text-sm font-bold min-w-[150px] truncate">{m.clientName}</span>
            <span className="font-body text-xs text-muted-foreground flex-1">Mission active</span>
            <span className="font-body text-xs font-bold text-warning-red whitespace-nowrap">
              aucune date : à planifier
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
