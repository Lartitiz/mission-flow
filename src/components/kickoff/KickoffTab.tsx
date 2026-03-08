import { useState, useEffect } from 'react';
import { useKickoff } from '@/hooks/useKickoff';
import { KickoffQuestions } from './KickoffQuestions';
import { QuestionnairePreview } from './QuestionnairePreview';
import { NotesEditor } from '@/components/discovery/NotesEditor';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Video, FileText } from 'lucide-react';

interface KickoffTabProps {
  missionId: string;
  clientName: string;
}

export function KickoffTab({ missionId, clientName }: KickoffTabProps) {
  const { kickoff, isLoading, saveNotes, saveField, saveImmediate, isSaving } = useKickoff(missionId);
  const { toast } = useToast();

  const [mode, setMode] = useState<'visio' | 'questionnaire'>('visio');
  const [notes, setNotes] = useState('');
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [declicEnabled, setDeclicEnabled] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

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
    // Placeholder — Edge Function will be created in next prompt
    setIsGeneratingAi(true);
    setTimeout(() => {
      toast({
        title: 'Bientôt disponible',
        description: "La génération IA des questions kick-off sera implémentée prochainement.",
      });
      setIsGeneratingAi(false);
    }, 1000);
  };

  const handleSendQuestionnaire = () => {
    // Collect all selected questions into kickoff record
    const allSelected = Object.entries(checkedQuestions)
      .filter(([, v]) => v)
      .map(([k]) => k);
    
    saveImmediate({
      fixed_questions: checkedQuestions,
      ai_questions: aiQuestions,
      questionnaire_status: 'ready',
    });

    toast({
      title: 'Questionnaire prêt',
      description: `${allSelected.length} question(s) prêtes à envoyer à ${clientName}.`,
    });
  };

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
            <NotesEditor
              notes={notes}
              onChange={handleNotesChange}
              isSaving={isSaving}
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
        </div>
      </div>
    </div>
  );
}
