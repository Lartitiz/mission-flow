import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FIXED_QUESTIONS, DECLIC_QUESTIONS } from './KickoffQuestions';

const FIXED_THEMES: Record<string, string> = {
  histoire: 'Ton histoire', anecdotes: 'Ton histoire',
  causes: 'Ton identité', mission: 'Ton identité', positionnement: 'Ton identité', mots: 'Ton identité',
  perception: 'Ton image', inspirations: 'Ton image', style: 'Ton image',
  offres: 'Ton activité', client_ideal: 'Ton activité',
  attentes: 'Tes attentes',
};

interface QuestionnaireResponsesProps {
  responses: Record<string, string>;
  fixedQuestions: Record<string, boolean>;
  aiQuestions: string[];
  declicEnabled: boolean;
  completedAt?: string | null;
  clientName: string;
  onStructureResponses: () => void;
  isStructuring: boolean;
}

export function QuestionnaireResponses({
  responses,
  fixedQuestions,
  aiQuestions,
  declicEnabled,
  completedAt,
  clientName,
  onStructureResponses,
  isStructuring,
}: QuestionnaireResponsesProps) {
  const handleDownloadMarkdown = () => {
    const allQuestions: { id: string; text: string; theme: string }[] = [];
    for (const q of FIXED_QUESTIONS) {
      if (fixedQuestions[q.id]) allQuestions.push({ ...q, theme: FIXED_THEMES[q.id] ?? 'Questions' });
    }
    aiQuestions.forEach((text, idx) => {
      if (fixedQuestions[`ai_${idx}`]) {
        allQuestions.push({ id: `ai_${idx}`, text, theme: 'Questions contextuelles' });
      }
    });
    if (declicEnabled) {
      for (const q of DECLIC_QUESTIONS) {
        if (fixedQuestions[q.id]) allQuestions.push({ ...q, theme: 'Questions déclic' });
      }
    }

    const themes: { name: string; items: { text: string; answer: string }[] }[] = [];
    for (const q of allQuestions) {
      const answer = (responses[q.id] ?? '').trim();
      if (!answer) continue;
      let t = themes.find((x) => x.name === q.theme);
      if (!t) { t = { name: q.theme, items: [] }; themes.push(t); }
      t.items.push({ text: q.text, answer });
    }

    const dateLine = completedAt
      ? `Complété le ${format(new Date(completedAt), 'dd MMMM yyyy', { locale: fr })}`
      : '';
    let md = `# Questionnaire — ${clientName}\n`;
    if (dateLine) md += `${dateLine}\n`;
    md += '\n';
    for (const t of themes) {
      md += `## ${t.name}\n\n`;
      for (const it of t.items) md += `**${it.text}**\n\n${it.answer}\n\n`;
    }

    const slug = clientName.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const dateSuffix = format(new Date(completedAt ?? new Date()), 'yyyy-MM-dd');
    const filename = `questionnaire-${slug || 'client'}-${dateSuffix}.md`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('Téléchargement lancé');
  };

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-5 space-y-4">
      <h3 className="font-heading text-sm font-medium text-foreground">Réponses reçues</h3>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {Object.entries(responses).map(([questionId, answer]) => {
          if (!answer || !answer.trim()) return null;
          return (
            <div key={questionId} className="border-b border-border pb-3 last:border-0">
              <p className="font-body text-xs text-muted-foreground mb-1">{questionId}</p>
              <p className="font-body text-sm text-foreground whitespace-pre-wrap">{answer}</p>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={onStructureResponses} disabled={isStructuring} className="font-body gap-2 flex-1">
          {isStructuring ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Structuration en cours...</>
          ) : (
            <><Sparkles className="h-4 w-4" />Structurer les réponses</>
          )}
        </Button>
        <Button variant="outline" onClick={handleDownloadMarkdown} className="font-body gap-2">
          <Download className="h-4 w-4" />Télécharger en .md
        </Button>
      </div>
    </div>
  );
}
