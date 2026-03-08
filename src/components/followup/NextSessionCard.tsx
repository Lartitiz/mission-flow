import { useState } from 'react';
import type { Session } from '@/hooks/useSessions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { TablesInsert } from '@/integrations/supabase/types';

interface NextSessionCardProps {
  session: Session | null;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onCreate: (session: TablesInsert<'sessions'>) => Promise<Session>;
  missionId: string;
  isSaving: boolean;
}

export function NextSessionCard({ session, onUpdate, onCreate, missionId, isSaving }: NextSessionCardProps) {
  const [agenda, setAgenda] = useState(session?.next_session_agenda ?? '');
  const [date, setDate] = useState<Date | undefined>(
    session?.next_session_date ? new Date(session.next_session_date) : undefined
  );
  const [creating, setCreating] = useState(false);

  const hasNextSession = !!date;

  const handleDateChange = (d: Date | undefined) => {
    setDate(d);
    if (session && d) {
      onUpdate(session.id, { next_session_date: format(d, 'yyyy-MM-dd') });
    }
  };

  const handleAgendaBlur = () => {
    if (session && agenda !== (session.next_session_agenda ?? '')) {
      onUpdate(session.id, { next_session_agenda: agenda });
    }
  };

  const handlePlan = async () => {
    setCreating(true);
    try {
      await onCreate({
        mission_id: missionId,
        session_date: format(new Date(), 'yyyy-MM-dd'),
        session_type: 'visio',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-[hsl(var(--badge-rose)/0.08)] border border-[hsl(var(--badge-rose)/0.3)] rounded-xl p-5 space-y-3">
      <h3 className="font-heading text-base font-medium text-foreground">Prochaine session</h3>

      {!session ? (
        <Button onClick={handlePlan} disabled={creating} className="font-body gap-2">
          <CalendarIcon className="h-4 w-4" />
          Planifier une session
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('font-body text-sm gap-2', !date && 'text-muted-foreground')}>
                  <CalendarIcon className="h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: fr }) : 'Choisir une date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateChange}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <Textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            onBlur={handleAgendaBlur}
            placeholder="Ordre du jour de la prochaine session..."
            className="font-body text-sm min-h-[80px]"
          />
        </div>
      )}
    </div>
  );
}
