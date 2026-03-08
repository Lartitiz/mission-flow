import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, X, Plus, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export const FIXED_QUESTIONS = [
  { id: 'histoire', text: "Quelle est ton histoire ? Comment l'aventure a débuté ?" },
  { id: 'anecdotes', text: 'As-tu des anecdotes, des moments fondateurs ?' },
  { id: 'causes', text: 'Pour quelles causes ou valeurs ton projet prend position ?' },
  { id: 'mission', text: 'Ta mission ? Le pourquoi profond ?' },
  { id: 'positionnement', text: 'Définis ton projet en une phrase (positionnement)' },
  { id: 'mots', text: 'Décris-toi en 3 mots' },
  { id: 'perception', text: 'Comment veux-tu être perçu·e ?' },
  { id: 'inspirations', text: 'Quelles marques t\'inspirent en communication ?' },
  { id: 'offres', text: 'Peux-tu détailler tes offres ?' },
  { id: 'client_ideal', text: 'Qui est ton/ta client·e idéal·e ?' },
  { id: 'style', text: 'Quel style et ton souhaites-tu adopter ?' },
  { id: 'attentes', text: "Qu'attends-tu exactement de cet accompagnement ?" },
];

export const DECLIC_QUESTIONS = [
  { id: 'declic_livre', text: 'Quel est le livre que tu as le plus offert et pourquoi ?' },
  { id: 'declic_defaite', text: "Raconte quelque chose qui semblait être une défaite mais qui t'a permis d'arriver à une victoire." },
  { id: 'declic_panneau', text: 'Si tu pouvais avoir un panneau géant pour écrire un message au monde, tu écrirais quoi ?' },
  { id: 'declic_phrase', text: "Complète la phrase : je ne serais pas arrivé·e là si..." },
  { id: 'declic_habitude_chelou', text: 'Raconte une habitude chelou ou un truc que tu aimes de manière absurde' },
  { id: 'declic_habitude_vie', text: 'Dans les 5 dernières années, quelle habitude a le plus amélioré ta vie ?' },
];

interface KickoffQuestionsProps {
  checkedQuestions: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
  aiQuestions: string[];
  onAiQuestionsChange: (questions: string[]) => void;
  onGenerateAiQuestions: () => void;
  isGeneratingAi: boolean;
  declicEnabled: boolean;
  onDeclicToggle: (enabled: boolean) => void;
}

export function KickoffQuestions({
  checkedQuestions,
  onToggle,
  aiQuestions,
  onAiQuestionsChange,
  onGenerateAiQuestions,
  isGeneratingAi,
  declicEnabled,
  onDeclicToggle,
}: KickoffQuestionsProps) {
  const [newQuestion, setNewQuestion] = useState('');
  const [declicOpen, setDeclicOpen] = useState(false);

  const handleAddQuestion = () => {
    if (!newQuestion.trim()) return;
    onAiQuestionsChange([...aiQuestions, newQuestion.trim()]);
    setNewQuestion('');
  };

  const handleRemoveAiQuestion = (idx: number) => {
    onAiQuestionsChange(aiQuestions.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Questions de base */}
      <div>
        <h3 className="font-heading text-sm font-medium text-foreground mb-3">
          Questions de base
        </h3>
        <div className="space-y-2">
          {FIXED_QUESTIONS.map((q) => (
            <label
              key={q.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
            >
              <Checkbox
                checked={!!checkedQuestions[q.id]}
                onCheckedChange={(checked) => onToggle(q.id, !!checked)}
                className="mt-0.5"
              />
              <span className="font-body text-sm text-foreground leading-relaxed">
                {q.text}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Section 2: Questions IA */}
      <div className="bg-[hsl(var(--badge-rose)/0.08)] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-medium text-foreground">
              Questions contextuelles
            </h3>
            <Badge variant="secondary" className="bg-[hsl(var(--badge-rose)/0.2)] text-[hsl(var(--badge-rose))] text-[10px] px-1.5 py-0">
              IA
            </Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onGenerateAiQuestions}
            disabled={isGeneratingAi}
            className="font-body text-xs gap-1.5"
          >
            {isGeneratingAi ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                Générer les questions
              </>
            )}
          </Button>
        </div>

        {aiQuestions.length > 0 && (
          <div className="space-y-2">
            {aiQuestions.map((q, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-lg bg-card"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0 cursor-grab" />
                <Checkbox
                  checked={!!checkedQuestions[`ai_${idx}`]}
                  onCheckedChange={(checked) => onToggle(`ai_${idx}`, !!checked)}
                  className="mt-0.5"
                />
                <span className="font-body text-sm text-foreground leading-relaxed flex-1">
                  {q}
                </span>
                <button
                  onClick={() => handleRemoveAiQuestion(idx)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Ajouter une question..."
            className="font-body text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddQuestion()}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddQuestion}
            disabled={!newQuestion.trim()}
            className="shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Section 3: Questions déclic */}
      <Collapsible open={declicOpen} onOpenChange={setDeclicOpen}>
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 bg-secondary/30">
            <CollapsibleTrigger className="flex items-center gap-2 hover:text-foreground transition-colors">
              {declicOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <h3 className="font-heading text-sm font-medium text-foreground">
                Questions déclic
              </h3>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <span className="font-body text-xs text-muted-foreground">
                {declicEnabled ? 'Activées' : 'Désactivées'}
              </span>
              <Switch
                checked={declicEnabled}
                onCheckedChange={onDeclicToggle}
              />
            </div>
          </div>

          <CollapsibleContent>
            {declicEnabled && (
              <div className="p-3 space-y-2">
                {DECLIC_QUESTIONS.map((q) => (
                  <label
                    key={q.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={!!checkedQuestions[q.id]}
                      onCheckedChange={(checked) => onToggle(q.id, !!checked)}
                      className="mt-0.5"
                    />
                    <span className="font-body text-sm text-foreground leading-relaxed italic">
                      {q.text}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
