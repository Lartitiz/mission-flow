import { useState, useEffect } from 'react';
import { useDiscoveryCall } from '@/hooks/useDiscoveryCall';
import { DiscoveryQuestions } from '@/components/discovery/DiscoveryQuestions';
import { SalesScripts } from '@/components/discovery/SalesScripts';
import { NotesEditor } from '@/components/discovery/NotesEditor';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DiscoveryTabProps {
  missionId: string;
}

export function DiscoveryTab({ missionId }: DiscoveryTabProps) {
  const { discoveryCall, isLoading, saveNotes, saveQuestions, isSaving } =
    useDiscoveryCall(missionId);
  const { toast } = useToast();

  const [notes, setNotes] = useState('');
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [leftTab, setLeftTab] = useState<'questions' | 'scripts'>('questions');

  // Sync from DB on load
  useEffect(() => {
    if (discoveryCall) {
      setNotes(discoveryCall.raw_notes ?? '');
      setCheckedQuestions(
        (discoveryCall.questions_asked as Record<string, boolean>) ?? {}
      );
    }
  }, [discoveryCall]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    saveNotes(value);
  };

  const handleQuestionToggle = (questionId: string, checked: boolean) => {
    const updated = { ...checkedQuestions, [questionId]: checked };
    setCheckedQuestions(updated);
    saveQuestions(updated);
  };

  const handleStructure = () => {
    toast({
      title: 'Structuration IA à venir',
      description:
        'La structuration automatique des notes sera disponible prochainement.',
    });
  };

  if (isLoading) {
    return (
      <p className="font-body text-muted-foreground py-8">Chargement...</p>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* LEFT — Call Guide (40%) */}
      <div className="w-full lg:w-[40%] space-y-4">
        {/* Sub-tabs */}
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setLeftTab('questions')}
            className={`px-3 py-2 font-body text-sm border-b-2 -mb-px transition-colors ${
              leftTab === 'questions'
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Questions
          </button>
          <button
            onClick={() => setLeftTab('scripts')}
            className={`px-3 py-2 font-body text-sm border-b-2 -mb-px transition-colors ${
              leftTab === 'scripts'
                ? 'border-primary text-foreground font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Scripts de vente
          </button>
        </div>

        <div className="max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
          {leftTab === 'questions' ? (
            <DiscoveryQuestions
              checkedQuestions={checkedQuestions}
              onToggle={handleQuestionToggle}
            />
          ) : (
            <SalesScripts />
          )}
        </div>
      </div>

      {/* RIGHT — Notes (60%) */}
      <div className="w-full lg:w-[60%] space-y-4">
        <NotesEditor
          notes={notes}
          onChange={handleNotesChange}
          isSaving={isSaving}
        />

        <Button
          onClick={handleStructure}
          disabled={!notes.trim()}
          className="font-body gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Structurer mes notes
        </Button>
      </div>
    </div>
  );
}
