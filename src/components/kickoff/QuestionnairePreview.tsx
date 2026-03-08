import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { FIXED_QUESTIONS, DECLIC_QUESTIONS } from './KickoffQuestions';

interface QuestionnairePreviewProps {
  checkedQuestions: Record<string, boolean>;
  aiQuestions: string[];
  declicEnabled: boolean;
  onSend: () => void;
  isSaving: boolean;
}

export function QuestionnairePreview({
  checkedQuestions,
  aiQuestions,
  declicEnabled,
  onSend,
  isSaving,
}: QuestionnairePreviewProps) {
  const selectedFixed = FIXED_QUESTIONS.filter((q) => checkedQuestions[q.id]);
  const selectedAi = aiQuestions.filter((_, idx) => checkedQuestions[`ai_${idx}`]);
  const selectedDeclic = declicEnabled
    ? DECLIC_QUESTIONS.filter((q) => checkedQuestions[q.id])
    : [];

  const allQuestions = [
    ...selectedFixed.map((q) => q.text),
    ...selectedAi,
    ...selectedDeclic.map((q) => q.text),
  ];

  if (allQuestions.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
        <p className="font-body text-muted-foreground">
          Coche des questions à gauche pour composer le questionnaire.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-6">
        <h3 className="font-heading text-base font-medium text-foreground mb-4">
          Aperçu du questionnaire ({allQuestions.length} question{allQuestions.length > 1 ? 's' : ''})
        </h3>
        <div className="space-y-4">
          {allQuestions.map((q, idx) => (
            <div key={idx} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <p className="font-body text-sm font-medium text-foreground mb-2">
                {idx + 1}. {q}
              </p>
              <div className="bg-secondary/30 rounded-lg p-3 min-h-[60px]">
                <span className="font-body text-xs text-muted-foreground italic">
                  Réponse du/de la client·e...
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button
        onClick={onSend}
        disabled={isSaving}
        className="w-full font-body gap-2 bg-[hsl(var(--badge-rose))] hover:bg-[hsl(var(--badge-rose)/0.9)] text-white"
      >
        <Send className="h-4 w-4" />
        Envoyer le questionnaire
      </Button>
    </div>
  );
}
