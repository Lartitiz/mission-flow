import { useState, useRef, useCallback, useEffect } from 'react';
import type { Session } from '@/hooks/useSessions';
import type { Action } from '@/hooks/useActions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, CalendarIcon, Sparkles, Loader2, Download, ChevronDown, Trash2, ListPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { saveAs } from 'file-saver';
import { NotesEditor } from '@/components/discovery/NotesEditor';
import { AiExtractionResults } from '@/components/actions/AiExtractionResults';
import type { TablesInsert } from '@/integrations/supabase/types';

interface SessionHistoryProps {
  sessions: Session[];
  missionId: string;
  missionType: string;
  actions: Action[];
  onCreate: (session: TablesInsert<'sessions'>) => Promise<Session>;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  addJournalEntry: (content: string, source?: 'manual' | 'auto') => void;
  isSaving: boolean;
}

const SESSION_TYPES = [
  { value: 'visio', label: 'Visio' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'autre', label: 'Autre' },
];

function sessionTypeLabel(type: string) {
  return SESSION_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface AiNewAction {
  assignee: string;
  category: string;
  task: string;
  description: string;
  channel?: string;
  target_date?: string;
}

interface AiUpdate {
  action_id: string;
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
}

export function SessionHistory({
  sessions,
  missionId,
  missionType,
  actions,
  onCreate,
  onUpdate,
  onDelete,
  addJournalEntry,
  isSaving,
}: SessionHistoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(new Date());
  const [newType, setNewType] = useState('visio');
  const [newTopic, setNewTopic] = useState('');
  const [quickTasks, setQuickTasks] = useState<Record<string, string>>({});
  const [quickAssignee, setQuickAssignee] = useState<Record<string, 'laetitia' | 'client'>>({});
  const [addingQuick, setAddingQuick] = useState<string | null>(null);

  // --- Debounced notes saving ---
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const localNotesRef = useRef<Record<string, string>>({});
  const sessionsRef = useRef<Session[]>(sessions);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Keep refs fresh
  useEffect(() => {
    localNotesRef.current = localNotes;
  }, [localNotes]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Initialize local notes from session data
  useEffect(() => {
    const notes: Record<string, string> = {};
    sessions.forEach((s) => {
      if (localNotes[s.id] === undefined) {
        notes[s.id] = s.raw_notes || '';
      }
    });
    if (Object.keys(notes).length > 0) {
      setLocalNotes((prev) => ({ ...notes, ...prev }));
    }
  }, [sessions]);

  const handleNotesChange = useCallback(
    (sessionId: string, value: string) => {
      setLocalNotes((prev) => {
        const next = { ...prev, [sessionId]: value };
        localNotesRef.current = next;
        return next;
      });
      if (debounceTimers.current[sessionId]) {
        clearTimeout(debounceTimers.current[sessionId]);
      }
      debounceTimers.current[sessionId] = setTimeout(() => {
        onUpdate(sessionId, { raw_notes: value });
      }, 2000);
    },
    [onUpdate]
  );

  // Immediate flush for a single session (used by NotesEditor on tab hide)
  const flushSessionNotes = useCallback(
    (sessionId: string, value: string) => {
      if (debounceTimers.current[sessionId]) {
        clearTimeout(debounceTimers.current[sessionId]);
        delete debounceTimers.current[sessionId];
      }
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (session && value !== (session.raw_notes || '')) {
        onUpdate(sessionId, { raw_notes: value });
      }
    },
    [onUpdate]
  );

  // Flush ALL pending sessions on tab hide (covers cases beyond the open editor)
  useEffect(() => {
    const flushAll = () => {
      Object.entries(localNotesRef.current).forEach(([id, value]) => {
        const session = sessionsRef.current.find((s) => s.id === id);
        if (session && value !== (session.raw_notes || '')) {
          if (debounceTimers.current[id]) {
            clearTimeout(debounceTimers.current[id]);
            delete debounceTimers.current[id];
          }
          onUpdate(id, { raw_notes: value });
        }
      });
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flushAll();
    };
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flushAll);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [onUpdate]);

  // Flush on unmount — uses refs to avoid stale closures
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach((timer) => clearTimeout(timer));
      Object.entries(localNotesRef.current).forEach(([id, notes]) => {
        const session = sessionsRef.current.find((s) => s.id === id);
        if (session && notes !== (session.raw_notes || '')) {
          onUpdate(id, { raw_notes: notes });
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Structuring + AI extraction ---
  const [isStructuring, setIsStructuring] = useState<string | null>(null);
  const [extractionResults, setExtractionResults] = useState<{
    sessionId: string;
    new_actions: AiNewAction[];
    updates: AiUpdate[];
  } | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const handleStructure = async (session: Session) => {
    const notes = localNotes[session.id] ?? session.raw_notes;
    if (!notes?.trim()) return;

    // Flush current notes first
    if (debounceTimers.current[session.id]) {
      clearTimeout(debounceTimers.current[session.id]);
    }
    onUpdate(session.id, { raw_notes: notes });

    setIsStructuring(session.id);
    try {
      // Step 1: Structure notes
      const { data, error } = await supabase.functions.invoke('structure-session-notes', {
        body: {
          raw_notes: notes,
          mission_context: { mission_type: missionType },
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
        return;
      }

      onUpdate(session.id, { structured_notes: data });

      // Step B: Auto journal entry
      const sections = data?.sections as { title: string; content: string }[] | undefined;
      if (sections?.length) {
        const firstContent = sections[0].content || '';
        const summary = firstContent.length > 120 ? firstContent.slice(0, 120) + '…' : firstContent;
        const dateStr = format(new Date(session.session_date), 'dd/MM/yyyy', { locale: fr });
        addJournalEntry(
          `Session ${sessionTypeLabel(session.session_type)} du ${dateStr} — ${summary}`,
          'auto'
        );
      }

      // Step A: Extract actions from structured text
      const structuredText = sections
        ?.map((s) => `## ${s.title}\n${s.content}`)
        .join('\n\n') || notes;

      const { data: extractData, error: extractError } = await supabase.functions.invoke(
        'extract-actions-from-cr',
        {
          body: {
            meeting_notes: structuredText,
            existing_actions: actions.map((a) => ({
              id: a.id,
              task: a.task,
              description: a.description,
              status: a.status,
              assignee: a.assignee,
              target_date: a.target_date,
              category: a.category,
              channel: a.channel,
            })),
            mission_type: missionType,
          },
        }
      );

      const newActions = extractData?.new_actions ?? [];
      const updates = extractData?.updates ?? [];

      if (!extractError && (newActions.length > 0 || updates.length > 0)) {
        setExtractionResults({
          sessionId: session.id,
          new_actions: newActions,
          updates,
        });
        // Persist pending suggestions so they remain available in the Action plan tab
        onUpdate(session.id, {
          structured_notes: {
            ...(data || {}),
            _pending_extracted: {
              new_actions: newActions,
              updates,
              generated_at: new Date().toISOString(),
            },
          },
        });
        queryClient.invalidateQueries({ queryKey: ['sessions', missionId] });
      }

      // Step C: Toast
      const actionCount = newActions.length + updates.length;
      toast({
        title: 'Notes structurées ✓',
        description: `${actionCount > 0 ? `${actionCount} action(s) suggérée(s) · ` : ''}Journal mis à jour`,
      });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de structurer les notes.', variant: 'destructive' });
    } finally {
      setIsStructuring(null);
    }
  };

  const [isExtracting, setIsExtracting] = useState<string | null>(null);

  const handleExtractActions = async (session: Session) => {
    const structured = session.structured_notes as { sections?: { title: string; content: string }[] } | null;
    const sections = structured?.sections;
    if (!sections?.length) {
      toast({ title: 'Notes non structurées', description: 'Structure d\'abord les notes.', variant: 'destructive' });
      return;
    }
    setIsExtracting(session.id);
    try {
      const structuredText = sections.map((s) => `## ${s.title}\n${s.content}`).join('\n\n');
      const { data: extractData, error: extractError } = await supabase.functions.invoke(
        'extract-actions-from-cr',
        {
          body: {
            meeting_notes: structuredText,
            existing_actions: actions.map((a) => ({
              id: a.id,
              task: a.task,
              description: a.description,
              status: a.status,
              assignee: a.assignee,
              target_date: a.target_date,
              category: a.category,
              channel: a.channel,
            })),
            mission_type: missionType,
          },
        }
      );
      if (extractError) throw extractError;
      const newActions = extractData?.new_actions ?? [];
      const updates = extractData?.updates ?? [];
      if (newActions.length === 0 && updates.length === 0) {
        toast({ title: 'Aucune action détectée', description: 'L\'IA n\'a rien proposé de nouveau.' });
        return;
      }
      setExtractionResults({ sessionId: session.id, new_actions: newActions, updates });
      onUpdate(session.id, {
        structured_notes: {
          ...(structured || {}),
          _pending_extracted: {
            new_actions: newActions,
            updates,
            generated_at: new Date().toISOString(),
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: ['sessions', missionId] });
      toast({
        title: `${newActions.length + updates.length} action(s) proposée(s)`,
        description: 'À valider dans l\'onglet Plan d\'action.',
      });
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'extraire les actions.', variant: 'destructive' });
    } finally {
      setIsExtracting(null);
    }
  };

  const handleApplyExtraction = async (selectedNew: AiNewAction[], selectedUpdates: AiUpdate[]) => {
    setIsApplying(true);
    try {
      // Définir l'ordre des phases
      const PHASE_SORT: Record<string, number> = {
        'mois_1_2': 1, 'mois_1': 2, 'mois_2': 3, 'mois_3': 4,
        'mois_4_5': 5, 'mois_4': 6, 'mois_5': 7, 'mois_6': 8,
        'phase_1': 1, 'phase_2': 2, 'continu': 99,
      };

      const sortedNew = [...selectedNew].sort((a, b) => {
        const phaseA = PHASE_SORT[(a as any).phase || ''] ?? 50;
        const phaseB = PHASE_SORT[(b as any).phase || ''] ?? 50;
        return phaseA - phaseB;
      });

      for (const action of sortedNew) {
        const maxSort =
          actions.length > 0
            ? Math.max(...actions.filter((a) => a.assignee === action.assignee).map((a) => a.sort_order)) + 1
            : 0;
        await supabase.from('actions').insert({
          mission_id: missionId,
          assignee: action.assignee,
          task: action.task,
          description: action.description || null,
          category: action.category || null,
          channel: action.channel || null,
          phase: (action as any).phase || null,
          target_date: action.target_date || null,
          sort_order: maxSort,
          status: 'not_started',
        });
      }
      for (const update of selectedUpdates) {
        const updateData: Record<string, string> = {};
        updateData[update.field] = update.new_value;
        await supabase
          .from('actions')
          .update(updateData as any)
          .eq('id', update.action_id);
      }
      // Clear persisted pending suggestions on the source session
      if (extractionResults?.sessionId) {
        const session = sessions.find((s) => s.id === extractionResults.sessionId);
        const sn = (session?.structured_notes as Record<string, unknown>) || {};
        const { _pending_extracted, ...rest } = sn as { _pending_extracted?: unknown };
        onUpdate(extractionResults.sessionId, { structured_notes: rest });
      }
      toast({
        title: 'Changements appliqués',
        description: `${sortedNew.length} action(s) créée(s), ${selectedUpdates.length} mise(s) à jour.`,
      });
      setExtractionResults(null);
      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
      queryClient.invalidateQueries({ queryKey: ['sessions', missionId] });
    } catch {
      toast({ title: 'Erreur', description: "Erreur lors de l'application.", variant: 'destructive' });
    } finally {
      setIsApplying(false);
    }
  };

  // --- Create session ---
  const handleCreate = async () => {
    if (!newDate) return;
    setIsCreating(true);
    try {
      const session = await onCreate({
        mission_id: missionId,
        session_date: format(newDate, 'yyyy-MM-dd'),
        session_type: newType,
        raw_notes: null,
        topic: newTopic.trim() || null,
      } as TablesInsert<'sessions'>);
      addJournalEntry(
        `Session ${sessionTypeLabel(newType)}${newTopic.trim() ? ` — ${newTopic.trim()}` : ''} ajoutée le ${format(newDate, 'dd/MM/yyyy', { locale: fr })}`,
        'auto'
      );
      setShowNewForm(false);
      setNewTopic('');
      setExpandedId(session.id);
      setLocalNotes((prev) => ({ ...prev, [session.id]: '' }));
      toast({ title: 'Session créée' });
    } finally {
      setIsCreating(false);
    }
  };

  // Quick-add tasks straight to action plan
  const handleQuickAddTasks = async (sessionId: string) => {
    const raw = (quickTasks[sessionId] || '').trim();
    if (!raw) return;
    const assignee = quickAssignee[sessionId] || 'laetitia';
    const lines = raw
      .split('\n')
      .map((l) => l.replace(/^[-•*\d.\s]+/, '').trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setAddingQuick(sessionId);
    try {
      const baseSort =
        actions.length > 0
          ? Math.max(0, ...actions.filter((a) => a.assignee === assignee).map((a) => a.sort_order)) + 1
          : 0;
      const rows = lines.map((task, i) => ({
        mission_id: missionId,
        assignee,
        task,
        sort_order: baseSort + i,
        status: 'not_started',
      }));
      const { error } = await supabase.from('actions').insert(rows);
      if (error) throw error;
      setQuickTasks((p) => ({ ...p, [sessionId]: '' }));
      queryClient.invalidateQueries({ queryKey: ['actions', missionId] });
      toast({ title: `${lines.length} action(s) ajoutée(s) au plan` });
    } catch {
      toast({ title: 'Erreur', description: "Impossible d'ajouter les actions.", variant: 'destructive' });
    } finally {
      setAddingQuick(null);
    }
  };

  // --- Download ---
  const handleDownload = (session: Session) => {
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

  // --- Delete ---
  const handleDeleteSession = (id: string) => {
    onDelete(id);
    if (expandedId === id) setExpandedId(null);
    toast({ title: 'Session supprimée' });
  };

  const getSummary = (session: Session) => {
    const structured = session.structured_notes as { sections?: { title: string; content: string }[] } | null;
    if (structured?.sections?.[0]?.content) {
      const c = structured.sections[0].content;
      return c.length > 80 ? c.slice(0, 80) + '…' : c;
    }
    if (session.raw_notes) {
      return session.raw_notes.length > 80 ? session.raw_notes.slice(0, 80) + '…' : session.raw_notes;
    }
    return 'Pas de notes';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-medium text-foreground">Sessions</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowNewForm(true);
            setExpandedId(null);
          }}
          className="font-body gap-2"
        >
          <Plus className="h-3.5 w-3.5" />
          Nouvelle session
        </Button>
      </div>

      {/* New session form */}
      {showNewForm && (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-5 space-y-4 border-l-4 border-l-primary">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-sm font-medium text-foreground">Nouvelle session</h4>
            <Button variant="ghost" size="sm" onClick={() => setShowNewForm(false)} className="font-body text-xs">
              Annuler
            </Button>
          </div>
          <div className="flex gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('font-body text-sm gap-2 flex-1', !newDate && 'text-muted-foreground')}
                >
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
                  <SelectItem key={t.value} value={t.value} className="font-body text-sm">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Sujet de la session (ex : Atelier de lancement, Stratégie éditoriale...)"
            className="font-body text-sm"
          />
          <Button onClick={handleCreate} disabled={!newDate || isCreating} className="w-full font-body">
            {isCreating ? 'Création...' : 'Créer et ouvrir'}
          </Button>
        </div>
      )}

      {/* Session list */}
      {sessions.length === 0 && !showNewForm ? (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
          <p className="font-body text-sm text-muted-foreground">Aucune session enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            const isExpanded = expandedId === session.id;
            const structured = session.structured_notes as { sections?: { title: string; content: string }[] } | null;
            const hasStructured = !!structured?.sections?.length;
            const notes = localNotes[session.id] ?? session.raw_notes ?? '';

            return (
              <div
                key={session.id}
                className="bg-card rounded-xl shadow-[var(--card-shadow)] overflow-hidden"
              >
                {/* Collapsed header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-secondary/30 transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
                      isExpanded && 'rotate-180'
                    )}
                  />
                  <span className="font-body text-sm font-medium text-foreground">
                    {format(new Date(session.session_date), 'dd MMMM yyyy', { locale: fr })}
                  </span>
                  <Badge variant="secondary" className="font-body text-[10px]">
                    {sessionTypeLabel(session.session_type)}
                  </Badge>
                  {hasStructured && (
                    <Badge className="bg-primary/10 text-primary font-body text-[10px]">
                      Notes structurées
                    </Badge>
                  )}
                  {!isExpanded && (
                    <span className="font-body text-xs text-muted-foreground truncate ml-auto max-w-[200px]">
                      {getSummary(session)}
                    </span>
                  )}
                </button>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-border">
                    {/* Header controls */}
                    <div className="flex items-center gap-3 pt-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="font-body text-xs gap-1.5">
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(session.session_date), 'PPP', { locale: fr })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={new Date(session.session_date)}
                            onSelect={(d) => {
                              if (d) onUpdate(session.id, { session_date: format(d, 'yyyy-MM-dd') });
                            }}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <Select
                        value={session.session_type}
                        onValueChange={(v) => onUpdate(session.id, { session_type: v })}
                      >
                        <SelectTrigger className="w-[120px] font-body text-xs h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SESSION_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value} className="font-body text-xs">
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(session)}
                          className="font-body text-xs gap-1.5"
                        >
                          <Download className="h-3 w-3" /> .md
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="font-heading">Supprimer cette session ?</AlertDialogTitle>
                              <AlertDialogDescription className="font-body">
                                Cette action est irréversible. Les notes et la structuration seront perdues.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="font-body">Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSession(session.id)}
                                className="font-body bg-destructive text-destructive-foreground"
                              >
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {/* Notes editor with voice dictation */}
                    <NotesEditor
                      notes={notes}
                      onChange={(val) => handleNotesChange(session.id, val)}
                      isSaving={isSaving}
                      draftKey={`session-notes:${session.id}`}
                      onFlush={(val) => flushSessionNotes(session.id, val)}
                    />

                    {/* Structure button */}
                    {!hasStructured && (
                      <Button
                        onClick={() => handleStructure(session)}
                        disabled={!notes.trim() || isStructuring === session.id}
                        className="font-body gap-2"
                        style={{ background: '#FB3D80' }}
                      >
                        {isStructuring === session.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Structuration en cours...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" /> Structurer mes notes
                          </>
                        )}
                      </Button>
                    )}

                    {/* Structured notes display */}
                    {hasStructured && (
                      <div className="space-y-3">
                        <h5 className="font-heading text-sm font-medium text-foreground">Notes structurées</h5>
                        {structured!.sections!.map((s, i) => (
                          <div key={i} className="border-l-4 border-l-primary pl-4">
                            <h6 className="font-body text-xs font-semibold text-foreground mb-1">{s.title}</h6>
                            <p className="font-body text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                              {s.content}
                            </p>
                          </div>
                        ))}
                        {/* Re-structure button */}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStructure(session)}
                            disabled={!notes.trim() || isStructuring === session.id}
                            className="font-body text-xs gap-1.5"
                          >
                            {isStructuring === session.id ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Restructuration...</>
                            ) : (
                              <><Sparkles className="h-3 w-3" /> Re-structurer</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleExtractActions(session)}
                            disabled={isExtracting === session.id}
                            className="font-body text-xs gap-1.5 text-white"
                            style={{ background: '#91014b' }}
                          >
                            {isExtracting === session.id ? (
                              <><Loader2 className="h-3 w-3 animate-spin" /> Extraction...</>
                            ) : (
                              <><Sparkles className="h-3 w-3" /> Envoyer les actions vers le plan d'action</>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* AI extraction results panel */}
                    {extractionResults?.sessionId === session.id && (
                      <AiExtractionResults
                        newActions={extractionResults.new_actions}
                        updates={extractionResults.updates}
                        onApply={handleApplyExtraction}
                        onCancel={() => {
                          // Clear persisted suggestions when user dismisses
                          const sn = (session.structured_notes as Record<string, unknown>) || {};
                          const { _pending_extracted, ...rest } = sn as { _pending_extracted?: unknown };
                          onUpdate(session.id, { structured_notes: rest });
                          setExtractionResults(null);
                          queryClient.invalidateQueries({ queryKey: ['sessions', missionId] });
                        }}
                        isApplying={isApplying}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
