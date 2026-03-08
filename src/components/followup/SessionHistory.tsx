import { useState } from 'react';
import type { Session } from '@/hooks/useSessions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, CalendarIcon, Sparkles, Loader2, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveAs } from 'file-saver';
import type { TablesInsert } from '@/integrations/supabase/types';

interface SessionHistoryProps {
  sessions: Session[];
  missionId: string;
  missionType: string;
  onCreate: (session: TablesInsert<'sessions'>) => Promise<Session>;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  addJournalEntry: (content: string, source?: 'manual' | 'auto') => void;
}

const SESSION_TYPES = [
  { value: 'visio', label: 'Visio' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'autre', label: 'Autre' },
];

function sessionTypeLabel(type: string) {
  return SESSION_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function SessionHistory({ sessions, missionId, missionType, onCreate, onUpdate, addJournalEntry }: SessionHistoryProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(new Date());
  const [newType, setNewType] = useState('visio');
  const [newNotes, setNewNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isStructuring, setIsStructuring] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});

  const handleCreate = async () => {
    if (!newDate) return;
    setIsCreating(true);
    try {
      await onCreate({
        mission_id: missionId,
        session_date: format(newDate, 'yyyy-MM-dd'),
        session_type: newType,
        raw_notes: newNotes || null,
      });
      addJournalEntry(`Session ${sessionTypeLabel(newType)} ajoutée le ${format(newDate, 'dd/MM/yyyy', { locale: fr })}`, 'auto');
      setDialogOpen(false);
      setNewNotes('');
      toast({ title: 'Session ajoutée' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStructure = async (session: Session) => {
    if (!session.raw_notes) return;
    setIsStructuring(session.id);
    try {
      const { data, error } = await supabase.functions.invoke('structure-session-notes', {
        body: {
          raw_notes: session.raw_notes,
          mission_context: { mission_type: missionType },
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
        return;
      }
      onUpdate(session.id, { structured_notes: data });
      toast({ title: 'Notes structurées' });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de structurer les notes.', variant: 'destructive' });
    } finally {
      setIsStructuring(null);
    }
  };

  const handleDownloadSession = (session: Session) => {
    const date = format(new Date(session.session_date), 'dd_MM_yyyy');
    let md = `# Session ${sessionTypeLabel(session.session_type)} — ${format(new Date(session.session_date), 'dd MMMM yyyy', { locale: fr })}\n\n`;

    const structured = session.structured_notes as { sections?: { title: string; content: string }[] } | null;
    if (structured?.sections) {
      structured.sections.forEach((s) => {
        md += `## ${s.title}\n\n${s.content}\n\n`;
      });
    }

    if (session.raw_notes) {
      md += `---\n\n## Notes brutes\n\n${session.raw_notes}`;
    }

    saveAs(new Blob([md], { type: 'text/markdown' }), `Session_${date}.md`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-medium text-foreground">Historique des sessions</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="font-body gap-2">
              <Plus className="h-3.5 w-3.5" />
              Ajouter une session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Nouvelle session</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('font-body text-sm gap-2 flex-1', !newDate && 'text-muted-foreground')}>
                      <CalendarIcon className="h-4 w-4" />
                      {newDate ? format(newDate, 'PPP', { locale: fr }) : 'Date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newDate} onSelect={setNewDate} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="w-[140px] font-body text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="font-body text-sm">{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notes de la session..."
                className="font-body text-sm min-h-[150px]"
              />
              <Button onClick={handleCreate} disabled={!newDate || isCreating} className="w-full font-body">
                {isCreating ? 'Création...' : 'Ajouter la session'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
          <p className="font-body text-sm text-muted-foreground">Aucune session enregistrée.</p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {sessions.map((session) => {
            const structured = session.structured_notes as { sections?: { title: string; content: string }[] } | null;
            return (
              <AccordionItem key={session.id} value={session.id} className="bg-card rounded-xl shadow-[var(--card-shadow)] border-0 overflow-hidden">
                <AccordionTrigger className="px-5 py-3 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-body text-sm font-medium text-foreground">
                      {format(new Date(session.session_date), 'dd MMMM yyyy', { locale: fr })}
                    </span>
                    <Badge variant="secondary" className="font-body text-[10px]">
                      {sessionTypeLabel(session.session_type)}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4">
                  <div className="space-y-3">
                    {structured?.sections ? (
                      <div className="space-y-3">
                        {structured.sections.map((s, i) => (
                          <div key={i} className="border-l-4 border-l-primary pl-4">
                            <h5 className="font-body text-xs font-semibold text-foreground mb-1">{s.title}</h5>
                            <p className="font-body text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{s.content}</p>
                          </div>
                        ))}
                        <button
                          onClick={() => setShowRaw((p) => ({ ...p, [session.id]: !p[session.id] }))}
                          className="font-body text-xs text-primary hover:underline"
                        >
                          {showRaw[session.id] ? 'Masquer les notes brutes' : 'Voir les notes brutes'}
                        </button>
                        {showRaw[session.id] && session.raw_notes && (
                          <p className="font-body text-xs text-muted-foreground whitespace-pre-wrap bg-secondary/30 rounded-lg p-3">
                            {session.raw_notes}
                          </p>
                        )}
                      </div>
                    ) : session.raw_notes ? (
                      <p className="font-body text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {session.raw_notes}
                      </p>
                    ) : (
                      <p className="font-body text-xs text-muted-foreground italic">Pas de notes.</p>
                    )}

                    <div className="flex gap-2 pt-2">
                      {session.raw_notes && !structured?.sections && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStructure(session)}
                          disabled={isStructuring === session.id}
                          className="font-body text-xs gap-1.5"
                        >
                          {isStructuring === session.id ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Structuration...</>
                          ) : (
                            <><Sparkles className="h-3 w-3" /> Structurer</>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadSession(session)}
                        className="font-body text-xs gap-1.5"
                      >
                        <Download className="h-3 w-3" /> .md
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
