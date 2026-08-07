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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { CalendarPlus, Pencil, Trash2, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AteliersCardProps {
  pastSessions: Session[];
  futureSessions: Session[];
  plannedTotal: number | null;
  onUpdatePlannedTotal: (total: number | null) => void;
  onCreate: (session: TablesInsert<'sessions'>) => Promise<Session>;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  missionId: string;
  clientName: string;
}

const TYPE_LABELS: Record<string, string> = {
  visio: 'Visio',
  presentiel: 'Présentiel',
  telephone: 'Téléphone',
};

export function AteliersCard({
  pastSessions,
  futureSessions,
  plannedTotal,
  onUpdatePlannedTotal,
  onCreate,
  onUpdate,
  onDelete,
  missionId,
  clientName,
}: AteliersCardProps) {
  const { toast } = useToast();
  const [planOpen, setPlanOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newType, setNewType] = useState('visio');
  const [newAgenda, setNewAgenda] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalDraft, setTotalDraft] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [copied, setCopied] = useState(false);

  const done = pastSessions.length;
  const planned = futureSessions.length;
  const total = plannedTotal ?? done + planned;
  const toPlan = Math.max(0, total - done - planned);
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const next = futureSessions[0] ?? null;

  const lastPastDate = pastSessions[0]?.session_date ? new Date(pastSessions[0].session_date) : null;
  const suggestions = [
    { label: 'Dans 1 semaine', date: addWeeks(new Date(), 1) },
    { label: 'Dans 2 semaines', date: addWeeks(new Date(), 2) },
    { label: 'Dans 1 mois', date: addMonths(new Date(), 1) },
    ...(lastPastDate
      ? [{ label: 'Dernier atelier + 3 sem.', date: addDays(lastPastDate, 21) }]
      : []),
  ].filter((s) => s.date > new Date());

  const firstName = clientName.split(' ')[0];
  const bookingMessage = `Coucou ${firstName}, voici mon agenda pour réserver ton prochain atelier : https://calendly.com/laetitia-mattioli/atelier-2h\n\nÀ très vite !`;

  const handleCopyBooking = async () => {
    await navigator.clipboard.writeText(bookingMessage);
    setCopied(true);
    toast({ title: 'Message copié !' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlan = async () => {
    if (!newDate) return;
    setCreating(true);
    try {
      await onCreate({
        mission_id: missionId,
        session_date: newDate,
        session_type: newType,
        topic: newTopic.trim() || null,
        // Pour un atelier planifié, next_session_agenda porte SON ordre du jour
        next_session_agenda: newAgenda.trim() || null,
      } as TablesInsert<'sessions'>);
      setPlanOpen(false);
      setNewTopic('');
      setNewDate('');
      setNewType('visio');
      setNewAgenda('');
    } finally {
      setCreating(false);
    }
  };

  const handleSuggestAgenda = async (session: Session) => {
    setIsSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-session-agenda', {
        body: { mission_id: missionId },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
        return;
      }
      if (data?.agenda) {
        onUpdate(session.id, { next_session_agenda: data.agenda });
        toast({ title: 'Agenda suggéré ✓' });
      }
    } catch (err) {
      console.error('Suggest agenda error:', err);
      toast({ title: 'Erreur', description: "Impossible de générer l'agenda.", variant: 'destructive' });
    } finally {
      setIsSuggesting(false);
    }
  };

  const renderEditor = (s: Session) => (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="font-body text-xs">Date</Label>
          <Input
            type="date"
            defaultValue={s.session_date}
            onBlur={(e) => {
              if (e.target.value && e.target.value !== s.session_date) {
                onUpdate(s.id, { session_date: e.target.value });
              }
            }}
            className="font-body"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="font-body text-xs">Format</Label>
          <Select value={s.session_type} onValueChange={(v) => onUpdate(s.id, { session_type: v })}>
            <SelectTrigger className="font-body">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="visio">Visio</SelectItem>
              <SelectItem value="presentiel">Présentiel</SelectItem>
              <SelectItem value="telephone">Téléphone</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="font-body text-xs">Titre</Label>
        <Input
          defaultValue={s.topic ?? ''}
          placeholder="Atelier 5 : calendrier éditorial"
          onBlur={(e) => {
            const val = e.target.value.trim();
            if (val !== (s.topic ?? '')) onUpdate(s.id, { topic: val || null });
          }}
          className="font-body"
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="font-body text-xs">Ordre du jour</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleSuggestAgenda(s)}
            disabled={isSuggesting}
            className="font-body gap-1.5 text-xs text-muted-foreground hover:text-foreground h-7"
          >
            {isSuggesting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Suggérer l'agenda
          </Button>
        </div>
        <Textarea
          key={s.next_session_agenda ?? ''}
          defaultValue={s.next_session_agenda ?? ''}
          placeholder="Valider les 3 piliers, planifier septembre…"
          onBlur={(e) => {
            const val = e.target.value;
            if (val !== (s.next_session_agenda ?? '')) {
              onUpdate(s.id, { next_session_agenda: val || null });
            }
          }}
          className="font-body text-sm min-h-[80px]"
        />
      </div>
    </div>
  );

  const rowActions = (s: Session) => (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setEditId(editId === s.id ? null : s.id)}
        aria-label="Modifier l'atelier"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Supprimer l'atelier">
            <Trash2 className="h-3.5 w-3.5 text-warning-red" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Supprimer cet atelier ?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="font-body bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete(s.id);
                if (editId === s.id) setEditId(null);
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

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

      <p className="font-body text-[11px] font-bold uppercase tracking-wide text-muted-foreground mt-5 mb-2">
        À venir
      </p>

      {next ? (
        <div className="bg-card rounded-xl p-3.5">
          <div className="flex gap-3 items-start">
            <div className="bg-jaune text-jaune-foreground rounded-xl text-center px-3 py-1.5 min-w-[56px]">
              <span className="font-heading text-2xl block leading-none">
                {format(new Date(next.session_date), 'd')}
              </span>
              <span className="font-body text-[10px] font-bold uppercase tracking-wide">
                {format(new Date(next.session_date), 'MMM', { locale: fr })}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-sm font-bold">
                {next.topic || 'Prochain atelier'}
                <span className="font-normal text-muted-foreground">
                  {' '}· {TYPE_LABELS[next.session_type] ?? next.session_type}
                </span>
              </p>
              {next.next_session_agenda && editId !== next.id && (
                <p className="font-body text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
                  Ordre du jour : {next.next_session_agenda}
                </p>
              )}
            </div>
            {rowActions(next)}
          </div>

          {editId === next.id && renderEditor(next)}

          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="font-body text-xs text-muted-foreground mb-1.5">
              Message de réservation à envoyer
            </p>
            <p className="font-body text-sm bg-secondary rounded-lg p-2.5 whitespace-pre-line">
              {bookingMessage}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="font-body gap-2 mt-2"
              onClick={handleCopyBooking}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copié' : 'Copier le message'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="font-body text-sm font-bold">Aucun atelier planifié</p>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Choisis une date suggérée ou planifie librement.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {suggestions.map((s) => (
              <Button
                key={s.label}
                variant="outline"
                size="sm"
                className="font-body text-xs"
                onClick={() => {
                  setNewDate(format(s.date, 'yyyy-MM-dd'));
                  setPlanOpen(true);
                }}
              >
                {s.label} · {format(s.date, 'd MMM', { locale: fr })}
              </Button>
            ))}
            <Button size="sm" className="font-body text-xs gap-1.5" onClick={() => setPlanOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" />
              Autre date
            </Button>
          </div>
        </div>
      )}

      {futureSessions.length > 1 && (
        <ul className="mt-3 space-y-2">
          {futureSessions.slice(1).map((s) => (
            <li key={s.id} className="bg-card/60 rounded-lg px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="font-body text-xs font-bold whitespace-nowrap min-w-[64px]">
                  {format(new Date(s.session_date), 'd MMM', { locale: fr })}
                </span>
                <span className="font-body text-sm font-semibold flex-1 truncate">
                  {s.topic || 'Atelier'}
                </span>
                {rowActions(s)}
              </div>
              {editId === s.id && renderEditor(s)}
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
              Il apparaîtra dans les ateliers à venir, ici et sur la page Ateliers.
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
              <div className="flex flex-wrap gap-1.5 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setNewDate(format(s.date, 'yyyy-MM-dd'))}
                    className="font-body text-[11px] rounded-full border border-input px-2.5 py-1 hover:bg-secondary transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-body text-sm">Format</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="font-body">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visio">Visio</SelectItem>
                  <SelectItem value="presentiel">Présentiel</SelectItem>
                  <SelectItem value="telephone">Téléphone</SelectItem>
                </SelectContent>
              </Select>
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
