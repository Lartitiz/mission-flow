import { DISCOVERY_QUESTIONS } from '@/lib/discovery-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles } from 'lucide-react';

interface DiscoveryQuestionsProps {
  checkedQuestions: Record<string, boolean>;
  onToggle: (questionId: string, checked: boolean) => void;
}

function questionId(blockIdx: number, qIdx: number) {
  return `${blockIdx}-${qIdx}`;
}

export function DiscoveryQuestions({ checkedQuestions, onToggle }: DiscoveryQuestionsProps) {
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
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-body text-xs font-semibold uppercase tracking-wider text-primary">
            Questions IA
          </span>
        </div>
        <p className="font-body text-sm text-muted-foreground italic">
          Les questions contextuelles apparaîtront ici pendant la prise de notes
        </p>
      </div>
    </div>
  );
}
