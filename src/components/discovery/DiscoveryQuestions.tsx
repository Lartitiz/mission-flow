import { useState } from 'react';
import { DISCOVERY_QUESTIONS } from '@/lib/discovery-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiscoveryQuestionsProps {
  checkedQuestions: Record<string, boolean>;
  onToggle: (questionId: string, checked: boolean) => void;
  currentNotes: string;
}

function questionId(blockIdx: number, qIdx: number) {
  return `${blockIdx}-${qIdx}`;
}

export function DiscoveryQuestions({ checkedQuestions, onToggle, currentNotes }: DiscoveryQuestionsProps) {
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const { toast } = useToast();

  const handleSuggest = async () => {
    if (!currentNotes.trim()) {
      toast({
        title: 'Notes requises',
        description: 'Commence à prendre des notes pour obtenir des suggestions.',
      });
      return;
    }

    setIsLoadingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-discovery-questions', {
        body: { current_notes: currentNotes },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erreur', description: data.error, variant: 'destructive' });
        return;
      }

      setAiQuestions(data.questions ?? []);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer les questions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="space-y-6">
      {DISCOVERY_QUESTIONS.map((block, blockIdx) => (
        <div key={block.title}>
          <h4 className="font-body text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {block.title}
          </h4>
          <div className="space-y-2">
            {block.questions.map((question, qIdx) => {
              const id = questionId(blockIdx, qIdx);
              const isChecked = !!checkedQuestions[id];
              return (
                <label
                  key={id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-secondary/50 ${
                    isChecked ? 'bg-secondary/30' : ''
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => onToggle(id, !!checked)}
                    className="mt-0.5 shrink-0"
                  />
                  <span
                    className={`font-body text-sm leading-relaxed ${
                      isChecked ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {question}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {/* AI Questions block */}
      <div className="bg-secondary/60 rounded-xl p-4 border border-primary/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-body text-xs font-semibold uppercase tracking-wider text-primary">
              Questions IA
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSuggest}
            disabled={isLoadingAi}
            className="font-body text-xs text-primary hover:text-primary/80 gap-1.5 h-7 px-2"
          >
            {isLoadingAi ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Suggérer
              </>
            )}
          </Button>
        </div>

        {aiQuestions.length > 0 ? (
          <div className="space-y-2">
            {aiQuestions.map((question, idx) => {
              const id = `ai-${idx}`;
              const isChecked = !!checkedQuestions[id];
              return (
                <label
                  key={id}
                  className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-primary/5 ${
                    isChecked ? 'bg-primary/5' : ''
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => onToggle(id, !!checked)}
                    className="mt-0.5 shrink-0"
                  />
                  <span
                    className={`font-body text-sm leading-relaxed ${
                      isChecked ? 'text-muted-foreground line-through' : 'text-foreground'
                    }`}
                  >
                    {question}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="font-body text-sm text-muted-foreground italic">
            {isLoadingAi
              ? 'Analyse des notes en cours...'
              : 'Clique sur "Suggérer" pour obtenir des questions contextuelles'}
          </p>
        )}
      </div>
    </div>
  );
}
