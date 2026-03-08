import { useState, useEffect } from 'react';
import { useDiscoveryCall } from '@/hooks/useDiscoveryCall';
import { DiscoveryQuestions } from '@/components/discovery/DiscoveryQuestions';
import { SalesScripts } from '@/components/discovery/SalesScripts';
import { NotesEditor } from '@/components/discovery/NotesEditor';
import { StructuredNotesView } from '@/components/discovery/StructuredNotesView';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { StructuredNotes } from '@/lib/discovery-types';

interface DiscoveryTabProps {
  missionId: string;
  clientName: string;
  currentMissionType: string;
}

export function DiscoveryTab({ missionId, clientName, currentMissionType }: DiscoveryTabProps) {
  const { discoveryCall, isLoading, saveNotes, saveQuestions, saveStructuredNotes, isSaving } =
    useDiscoveryCall(missionId);
  const { toast } = useToast();

  const [notes, setNotes] = useState('');
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [leftTab, setLeftTab] = useState<'questions' | 'scripts'>('questions');
  const [isStructuring, setIsStructuring] = useState(false);
  const [structuredNotes, setStructuredNotes] = useState<StructuredNotes | null>(null);

  // Sync from DB on load
  useEffect(() => {
    if (discoveryCall) {
      setNotes(discoveryCall.raw_notes ?? '');
      setCheckedQuestions(
        (discoveryCall.questions_asked as Record<string, boolean>) ?? {}
      );
      if (discoveryCall.structured_notes) {
        setStructuredNotes(discoveryCall.structured_notes as unknown as StructuredNotes);
      }
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

  const handleStructure = async () => {
    if (!notes.trim()) return;
    setIsStructuring(true);

    try {
      const { data, error } = await supabase.functions.invoke('structure-discovery-notes', {
        body: { raw_notes: notes, mission_type: currentMissionType },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: 'Erreur',
          description: data.error,
          variant: 'destructive',
        });
        return;
      }

      const structured = data as StructuredNotes;
      setStructuredNotes(structured);
      saveStructuredNotes(structured);

      toast({
        title: 'Notes structurées',
        description: 'La fiche a été générée avec succès.',
      });
    } catch (e) {
      console.error('Structure error:', e);
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
    const updated = {
      ...structuredNotes,
      sections: structuredNotes.sections.map((s, i) =>
        i === index ? { ...s, content } : s
      ),
    };
    setStructuredNotes(updated);
    saveStructuredNotes(updated);
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
              currentNotes={notes}
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
          disabled={!notes.trim() || isStructuring}
          className="font-body gap-2"
        >
          {isStructuring ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Structuration en cours... (jusqu'à 30s)
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Structurer mes notes
            </>
          )}
        </Button>

        {structuredNotes && (
          <StructuredNotesView
            structuredNotes={structuredNotes}
            missionId={missionId}
            currentMissionType={currentMissionType}
            onSectionEdit={handleSectionEdit}
          />
        )}
      </div>
    </div>
  );
}
