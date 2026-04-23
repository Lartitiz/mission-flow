import { useState, useEffect } from 'react';
import { useKickoff } from '@/hooks/useKickoff';
import { useDiscoveryCall } from '@/hooks/useDiscoveryCall';
import { KickoffQuestions } from './KickoffQuestions';
import { QuestionnairePreview } from './QuestionnairePreview';
import { NotesEditor } from '@/components/discovery/NotesEditor';
import { KickoffStructuredNotes } from './KickoffStructuredNotes';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Video, FileText, Sparkles, Loader2 } from 'lucide-react';
import { QuestionnaireStatus } from './QuestionnaireStatus';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface KickoffTabProps {
  missionId: string;
  clientName: string;
}

interface KickoffStructuredSection {
  title: string;
  content: string;
}

export function KickoffTab({ missionId, clientName }: KickoffTabProps) {
  const { kickoff, isLoading, saveNotes, flushNotesNow, saveField, saveImmediate, isSaving } = useKickoff(missionId);
  const { discoveryCall } = useDiscoveryCall(missionId);
  const { toast } = useToast();

  // Fetch proposal for context
  const { data: proposal } = useQuery({
    queryKey: ['proposal', missionId],
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
    enabled: !!missionId,
  });

  // Fetch mission type
  const { data: mission } = useQuery({
    queryKey: ['mission-type', missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('missions')
        .select('mission_type')
        .eq('id', missionId)
        .single();
      return data;
    },
    enabled: !!missionId,
  });

  const [mode, setMode] = useState<'visio' | 'questionnaire'>('visio');
  const [notes, setNotes] = useState('');
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [declicEnabled, setDeclicEnabled] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isStructuring, setIsStructuring] = useState(false);
  const [structuredNotes, setStructuredNotes] = useState<KickoffStructuredSection[] | null>(null);

  // Sync from DB
  useEffect(() => {
    if (kickoff) {
      setMode((kickoff.mode as 'visio' | 'questionnaire') || 'visio');
      setNotes(kickoff.raw_notes ?? '');
      setDeclicEnabled(kickoff.declic_questions_enabled ?? false);

      const fixed = kickoff.fixed_questions as Record<string, boolean> | null;
      if (fixed) setCheckedQuestions(fixed);

      const ai = kickoff.ai_questions as string[] | null;
      if (ai) setAiQuestions(ai);

      const structured = kickoff.structured_notes as unknown;
      if (structured && Array.isArray(structured)) {
        setStructuredNotes(structured as KickoffStructuredSection[]);
      } else if (structured && typeof structured === 'object' && 'sections' in (structured as Record<string, unknown>)) {
        setStructuredNotes((structured as { sections: KickoffStructuredSection[] }).sections);
      }
    }
  }, [kickoff]);

  const handleModeChange = (isQuestionnaire: boolean) => {
    const newMode = isQuestionnaire ? 'questionnaire' : 'visio';
    setMode(newMode);
    saveImmediate({ mode: newMode });
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    saveNotes(value);
  };

  const handleQuestionToggle = (id: string, checked: boolean) => {
    const updated = { ...checkedQuestions, [id]: checked };
    setCheckedQuestions(updated);
    saveField({ fixed_questions: updated });
  };

  const handleAiQuestionsChange = (questions: string[]) => {
    setAiQuestions(questions);
    saveField({ ai_questions: questions });
  };

  const handleDeclicToggle = (enabled: boolean) => {
    setDeclicEnabled(enabled);
    saveImmediate({ declic_questions_enabled: enabled });
  };

  const handleGenerateAiQuestions = async () => {
    setIsGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-kickoff-questions', {
        body: {
          structured_discovery_notes: discoveryCall?.structured_notes ?? null,
          proposal_content: proposal?.content ?? null,
          mission_type: mission?.mission_type ?? 'binome',
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
        return;
      }

      // Flatten themes into a flat question list
      const themes = data?.themes as { name: string; questions: string[] }[] | undefined;
      if (themes && Array.isArray(themes)) {
        const allQuestions = themes.flatMap((t) => t.questions);
        setAiQuestions(allQuestions);
        saveImmediate({ ai_questions: allQuestions });
        toast({
          title: 'Questions générées',
          description: `${allQuestions.length} questions contextuelles générées.`,
        });
      } else {
        toast({ title: 'Erreur', description: 'Format de réponse inattendu.', variant: 'destructive' });
      }
    } catch (e) {
      console.error('Generate kickoff questions error:', e);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer les questions. Réessaie dans quelques instants.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleStructureNotes = async () => {
    if (!notes.trim()) return;
    setIsStructuring(true);
    try {
      const { data, error } = await supabase.functions.invoke('structure-kickoff-notes', {
        body: {
          raw_notes: notes,
          mission_type: mission?.mission_type ?? 'binome',
          proposal_content: proposal?.content ?? null,
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
        return;
      }

      const sections = data?.sections as KickoffStructuredSection[] | undefined;
      if (sections && Array.isArray(sections)) {
        setStructuredNotes(sections);
        saveImmediate({ structured_notes: { sections } });
        toast({ title: 'Notes structurées', description: 'La fiche kick-off a été générée.' });
      }
    } catch (e) {
      console.error('Structure kickoff notes error:', e);
      toast({
        title: 'Erreur',
        description: 'Impossible de structurer les notes. Réessaie dans quelques instants.',
        variant: 'destructive',
      });
    } finally {
      setIsStructuring(false);
    }
  };

  const handleSectionEdit = (index: number, content: string) => {
    if (!structuredNotes) return;
    const updated = structuredNotes.map((s, i) => (i === index ? { ...s, content } : s));
    setStructuredNotes(updated);
    saveImmediate({ structured_notes: { sections: updated } });
  };

  const handleSendQuestionnaire = () => {
    const allSelected = Object.entries(checkedQuestions)
      .filter(([, v]) => v)
      .map(([k]) => k);

    saveImmediate({
      fixed_questions: checkedQuestions,
      ai_questions: aiQuestions,
      questionnaire_status: 'sent',
      sent_at: new Date().toISOString(),
    });

    toast({
      title: 'Questionnaire envoyé',
      description: `${allSelected.length} question(s) prêtes. Copie le lien pour l'envoyer à ${clientName}.`,
    });
  };

  const handleStructureResponses = async () => {
    if (!kickoff?.questionnaire_responses) return;
    const responses = kickoff.questionnaire_responses as Record<string, string>;
    const rawText = Object.entries(responses)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `**${k}** : ${v}`)
      .join('\n\n');
    if (!rawText.trim()) return;

    setIsStructuring(true);
    try {
      const { data, error } = await supabase.functions.invoke('structure-kickoff-notes', {
        body: {
          raw_notes: rawText,
          mission_type: mission?.mission_type ?? 'binome',
          proposal_content: proposal?.content ?? null,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
        return;
      }
      const sections = data?.sections as KickoffStructuredSection[] | undefined;
      if (sections && Array.isArray(sections)) {
        setStructuredNotes(sections);
        saveImmediate({ structured_notes: { sections } });
        toast({ title: 'Notes structurées', description: 'La fiche kick-off a été générée depuis les réponses.' });
      }
    } catch (e) {
      console.error('Structure questionnaire responses error:', e);
      toast({ title: 'Erreur', description: 'Impossible de structurer les réponses.', variant: 'destructive' });
    } finally {
      setIsStructuring(false);
    }
  };

  const questionnaireStatus = kickoff?.questionnaire_status ?? 'draft';

  if (isLoading) {
    return <p className="font-body text-muted-foreground py-8">Chargement...</p>;
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-3 bg-card rounded-xl shadow-[var(--card-shadow)] px-4 py-3">
        <Video className={`h-4 w-4 ${mode === 'visio' ? 'text-foreground' : 'text-muted-foreground'}`} />
        <span className={`font-body text-sm ${mode === 'visio' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          Mode visio
        </span>
        <Switch
          checked={mode === 'questionnaire'}
          onCheckedChange={handleModeChange}
        />
        <FileText className={`h-4 w-4 ${mode === 'questionnaire' ? 'text-foreground' : 'text-muted-foreground'}`} />
        <span className={`font-body text-sm ${mode === 'questionnaire' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
          Mode questionnaire
        </span>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* LEFT — Questions (40%) */}
        <div className="w-full lg:w-[40%]">
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            <KickoffQuestions
              checkedQuestions={checkedQuestions}
              onToggle={handleQuestionToggle}
              aiQuestions={aiQuestions}
              onAiQuestionsChange={handleAiQuestionsChange}
              onGenerateAiQuestions={handleGenerateAiQuestions}
              isGeneratingAi={isGeneratingAi}
              declicEnabled={declicEnabled}
              onDeclicToggle={handleDeclicToggle}
            />
          </div>
        </div>

        {/* RIGHT — Notes or Questionnaire Preview (60%) */}
        <div className="w-full lg:w-[60%] space-y-4">
          {mode === 'visio' ? (
            <>
              <NotesEditor
                notes={notes}
                onChange={handleNotesChange}
                isSaving={isSaving}
                draftKey={`kickoff-notes:${missionId}`}
                onFlush={flushNotesNow}
              />

              <Button
                onClick={handleStructureNotes}
                disabled={!notes.trim() || isStructuring}
                className="font-body gap-2"
              >
                {isStructuring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {notes.length > 8000
                      ? "Structuration en cours... (transcription longue, jusqu'à 3 min)"
                      : "Structuration en cours... (jusqu'à 1 min)"}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Structurer mes notes
                  </>
                )}
              </Button>

              {structuredNotes && (
                <KickoffStructuredNotes
                  sections={structuredNotes}
                  clientName={clientName}
                  rawNotes={notes}
                  createdAt={kickoff?.created_at}
                  onSectionEdit={handleSectionEdit}
                />
              )}
            </>
          ) : (
            <>
              {(questionnaireStatus === 'sent' || questionnaireStatus === 'completed') && kickoff ? (
                <QuestionnaireStatus
                  kickoff={{
                    id: kickoff.id,
                    questionnaire_token: kickoff.questionnaire_token,
                    questionnaire_status: kickoff.questionnaire_status,
                    sent_at: kickoff.sent_at,
                    completed_at: kickoff.completed_at,
                    questionnaire_responses: kickoff.questionnaire_responses as Record<string, string> | null,
                    fixed_questions: kickoff.fixed_questions as Record<string, boolean> | null,
                    ai_questions: kickoff.ai_questions as string[] | null,
                    declic_questions_enabled: kickoff.declic_questions_enabled,
                  }}
                  onStructureResponses={handleStructureResponses}
                  isStructuring={isStructuring}
                />
              ) : (
                <QuestionnairePreview
                  checkedQuestions={checkedQuestions}
                  aiQuestions={aiQuestions}
                  declicEnabled={declicEnabled}
                  onSend={handleSendQuestionnaire}
                  isSaving={isSaving}
                />
              )}

              {structuredNotes && (
                <KickoffStructuredNotes
                  sections={structuredNotes}
                  clientName={clientName}
                  rawNotes={notes}
                  createdAt={kickoff?.created_at}
                  onSectionEdit={handleSectionEdit}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
