import { useState } from 'react';
import type { Session } from '@/hooks/useSessions';
import type { TablesInsert } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AteliersCardProps {
  pastSessions: Session[];
  futureSessions: Session[];
  plannedTotal: number | null;
  onUpdatePlannedTotal: (total: number | null) => void;
  onCreate: (session: TablesInsert<'sessions'>) => Promise<Session>;
  missionId: string;
}

export function AteliersCard({
  pastSessions,
  futureSessions,
  plannedTotal,
  onUpdatePlannedTotal,
  onCreate,
  missionId,
}: AteliersCardProps) {
  const [planOpen, setPlanOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newAgenda, setNewAgenda] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalDraft, setTotalDraft] = useState('');

  const done = pastSessions.length;
  const planned = futureSessions.length;
  const total = plannedTotal ?? done + planned;
  const toPlan = Math.max(0, total - done - planned);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const next = futureSessions[0] ?? null;

  const handlePlan = async () => {
    if (!newDate) return;
    setCreating(true);
    try {
      await onCreate({
        mission_id: missionId,
        session_date: newDate,
        session_type: 'visio',
        topic: newTopic.trim() || null,
        // Pour un atelier planifié, next_session_agenda porte SON ordre du jour
        next_session_agenda: newAgenda.trim() || null,
      } as TablesInsert<'sessions'>);
      setPlanOpen(false);
      setNewTopic('');
      setNewDate('');
      setNewAgenda('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-secondary rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h3 className="font-heading text-2xl text-brand-logo">
          Ateliers : <em className="italic text-primary">{done}/{total}</em>
        </h3>
        <Button size="sm" onClick={() => setPlanOpen(true)} className="font-body gap-1.5">
          <CalendarPlus className="h-3.5 w-3.5" />
          Planifier un atelier
        </Button>
      </div>

      <Progress value={percent} className="h-2.5 mt-3 bg-card" />
      <div className="flex items-center justify-between mt-1.5">
        <p className="font-body text-xs text-muted-foreground">
          {done} fait{done > 1 ? 's' : ''} · {planned} planifié{planned > 1 ? 's' : ''}
          {toPlan > 0 && <span className="text-warning-red font-semibold"> · {toPlan} à planifier</span>}
        </p>
        {editingTotal ? (
          <input
            autoFocus
            type="number"
            min={0}
            value={totalDraft}
            onChange={(e) => setTotalDraft(e.target.value)}
            onBlur={() => {
              setEditingTotal(false);
              const n = totalDraft.trim() === '' ? null : Math.max(0, parseInt(totalDraft, 10) || 0);
              if (n !== plannedTotal) onUpdatePlannedTotal(n);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="font-body text-xs w-16 border border-input rounded-md px-2 py-0.5 bg-card outline-none"
          />
        ) : (
          <button
            onClick={() => { setTotalDraft(plannedTotal != null ? String(plannedTotal) : ''); setEditingTotal(true); }}
            className="font-body text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {plannedTotal != null ? `sur ${plannedTotal} prévus` : 'définir le nombre prévu'}
          </button>
        )}
      </div>

      {next && (
        <div className="flex gap-3 items-start bg-card rounded-xl p-3.5 mt-4">
          <div className="bg-jaune text-jaune-foreground rounded-xl text-center px-3 py-1.5 min-w-[56px]">
            <span className="font-heading text-2xl block leading-none">
              {format(new Date(next.session_date), 'd')}
            </span>
            <span className="font-body text-[10px] font-bold uppercase tracking-wide">
              {format(new Date(next.session_date), 'MMM', { locale: fr })}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-body text-sm font-bold">
              {next.topic || 'Prochain atelier'}
            </p>
            {next.next_session_agenda && (
              <p className="font-body text-xs text-muted-foreground mt-0.5">
                Ordre du jour : {next.next_session_agenda}
              </p>
            )}
          </div>
        </div>
      )}

      {futureSessions.length > 1 && (
        <ul className="mt-3 divide-y divide-border/60">
          {futureSessions.slice(1).map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span className="font-body text-sm font-semibold">{s.topic || 'Atelier'}</span>
              <span className="font-body text-xs text-muted-foreground">
                {format(new Date(s.session_date), 'd MMM · HH:mm', { locale: fr }).replace(' · 00:00', '')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!next && toPlan === 0 && done > 0 && (
        <p className="font-body text-sm text-muted-foreground mt-3">
          Tous les ateliers prévus ont eu lieu 🎉
        </p>
      )}

      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Planifier un atelier</DialogTitle>
            <DialogDescription className="font-body">
              Il apparaîtra dans les ateliers à venir, ici et sur le pipeline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Titre</Label>
              <Input
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="Atelier 4 : calendrier éditorial"
                className="font-body"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Date</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="font-body"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Ordre du jour (optionnel)</Label>
              <Textarea
                value={newAgenda}
                onChange={(e) => setNewAgenda(e.target.value)}
                placeholder="Valider les 3 piliers, planifier septembre…"
                className="font-body min-h-[70px]"
              />
            </div>
            <Button onClick={handlePlan} disabled={!newDate || creating} className="w-full font-body">
              {creating ? 'Planification…' : "Planifier l'atelier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
