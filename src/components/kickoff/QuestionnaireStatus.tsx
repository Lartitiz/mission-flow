import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, ExternalLink, Sparkles, Loader2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const FIXED_QUESTIONS: { id: string; text: string; theme: string }[] = [
  { id: "histoire", text: "Quelle est ton histoire ? Comment l'aventure a débuté ?", theme: "Ton histoire" },
  { id: "anecdotes", text: "As-tu des anecdotes, des moments fondateurs ?", theme: "Ton histoire" },
  { id: "causes", text: "Pour quelles causes ou valeurs ton projet prend position ?", theme: "Ton identité" },
  { id: "mission", text: "Ta mission ? Le pourquoi profond ?", theme: "Ton identité" },
  { id: "positionnement", text: "Définis ton projet en une phrase (positionnement)", theme: "Ton identité" },
  { id: "mots", text: "Décris-toi en 3 mots", theme: "Ton identité" },
  { id: "perception", text: "Comment veux-tu être perçu·e ?", theme: "Ton image" },
  { id: "inspirations", text: "Quelles marques t'inspirent en communication ?", theme: "Ton image" },
  { id: "offres", text: "Peux-tu détailler tes offres ?", theme: "Ton activité" },
  { id: "client_ideal", text: "Qui est ton/ta client·e idéal·e ?", theme: "Ton activité" },
  { id: "style", text: "Quel style et ton souhaites-tu adopter ?", theme: "Ton image" },
  { id: "attentes", text: "Qu'attends-tu exactement de cet accompagnement ?", theme: "Tes attentes" },
];

const DECLIC_QUESTIONS: { id: string; text: string; theme: string }[] = [
  { id: "declic_livre", text: "Quel est le livre que tu as le plus offert et pourquoi ?", theme: "Questions déclic" },
  { id: "declic_defaite", text: "Raconte quelque chose qui semblait être une défaite mais qui t'a permis d'arriver à une victoire.", theme: "Questions déclic" },
  { id: "declic_panneau", text: "Si tu pouvais avoir un panneau géant pour écrire un message au monde, tu écrirais quoi ?", theme: "Questions déclic" },
  { id: "declic_phrase", text: "Complète la phrase : je ne serais pas arrivé·e là si...", theme: "Questions déclic" },
  { id: "declic_habitude_chelou", text: "Raconte une habitude chelou ou un truc que tu aimes de manière absurde", theme: "Questions déclic" },
  { id: "declic_habitude_vie", text: "Dans les 5 dernières années, quelle habitude a le plus amélioré ta vie ?", theme: "Questions déclic" },
];

interface QuestionnaireStatusProps {
  kickoff: {
    id: string;
    questionnaire_token: string;
    questionnaire_status: string;
    sent_at?: string | null;
    completed_at?: string | null;
    questionnaire_responses?: Record<string, string> | null;
    fixed_questions?: Record<string, boolean> | null;
    ai_questions?: string[] | null;
    declic_questions_enabled?: boolean;
  };
  clientName: string;
  onStructureResponses: () => void;
  isStructuring: boolean;
}

export function QuestionnaireStatus({ kickoff, clientName, onStructureResponses, isStructuring }: QuestionnaireStatusProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const status = kickoff.questionnaire_status;
  const responses = (kickoff.questionnaire_responses ?? {}) as Record<string, string>;
  const responseCount = Object.values(responses).filter((v) => v && v.trim().length > 0).length;

  // Count total questions
  const checked = (kickoff.fixed_questions ?? {}) as Record<string, boolean>;
  const totalQuestions = Object.values(checked).filter(Boolean).length;

  const link = `${window.location.origin}/questionnaire/${kickoff.questionnaire_token}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Lien copié !' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const aiQs = kickoff.ai_questions ?? [];
    const checked = (kickoff.fixed_questions ?? {}) as Record<string, boolean>;
    const declicEnabled = kickoff.declic_questions_enabled ?? false;

    const allQuestions: { id: string; text: string; theme: string }[] = [];
    for (const q of FIXED_QUESTIONS) if (checked[q.id]) allQuestions.push(q);
    aiQs.forEach((text, idx) => {
      if (checked[`ai_${idx}`]) allQuestions.push({ id: `ai_${idx}`, text, theme: 'Questions contextuelles' });
    });
    if (declicEnabled) for (const q of DECLIC_QUESTIONS) if (checked[q.id]) allQuestions.push(q);

    const themes: { name: string; items: { text: string; answer: string }[] }[] = [];
    for (const q of allQuestions) {
      const answer = (responses[q.id] ?? '').trim();
      if (!answer) continue;
      let t = themes.find((x) => x.name === q.theme);
      if (!t) {
        t = { name: q.theme, items: [] };
        themes.push(t);
      }
      t.items.push({ text: q.text, answer });
    }

    const dateLine = kickoff.completed_at
      ? `Complété le ${format(new Date(kickoff.completed_at), 'dd MMMM yyyy', { locale: fr })}`
      : '';

    let md = `# Questionnaire — ${clientName}\n`;
    if (dateLine) md += `${dateLine}\n`;
    md += '\n';
    for (const t of themes) {
      md += `## ${t.name}\n\n`;
      for (const it of t.items) {
        md += `**${it.text}**\n\n${it.answer}\n\n`;
      }
    }

    const slug = clientName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const dateSuffix = format(new Date(kickoff.completed_at ?? new Date()), 'yyyy-MM-dd');
    const filename = `questionnaire-${slug || 'client'}-${dateSuffix}.md`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Téléchargement lancé' });
  };

  const statusBadge = () => {
    switch (status) {
      case 'draft':
      case 'ready':
        return <Badge variant="secondary" className="font-body text-xs">Prêt à envoyer</Badge>;
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-700 font-body text-xs">Envoyé</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 font-body text-xs">Complété</Badge>;
      default:
        return <Badge variant="secondary" className="font-body text-xs">{status}</Badge>;
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-medium text-foreground">Questionnaire client·e</h3>
        {statusBadge()}
      </div>

      {/* Status info */}
      <div className="space-y-1 text-sm font-body text-muted-foreground">
        {kickoff.sent_at && (
          <p>Envoyé le {format(new Date(kickoff.sent_at), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
        )}
        {status === 'sent' && totalQuestions > 0 && (
          <p>{responseCount} / {totalQuestions} réponses reçues</p>
        )}
        {kickoff.completed_at && (
          <p>Complété le {format(new Date(kickoff.completed_at), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>
        )}
      </div>

      {/* Copy link */}
      {(status === 'ready' || status === 'sent') && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="font-body gap-2 flex-1">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copié !' : 'Copier le lien du questionnaire'}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      )}

      {/* Completed: show responses */}
      {status === 'completed' && Object.keys(responses).length > 0 && (
        <div className="space-y-3">
          <h4 className="font-heading text-sm font-medium text-foreground">Réponses reçues</h4>
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
            <Button
              onClick={onStructureResponses}
              disabled={isStructuring}
              className="font-body gap-2 flex-1"
            >
              {isStructuring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Structuration en cours...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Structurer les réponses
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadMarkdown}
              className="font-body gap-2"
            >
              <Download className="h-4 w-4" />
              Télécharger en .md
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
