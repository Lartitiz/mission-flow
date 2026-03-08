import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  onStructureResponses: () => void;
  isStructuring: boolean;
}

export function QuestionnaireStatus({ kickoff, onStructureResponses, isStructuring }: QuestionnaireStatusProps) {
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

          <Button
            onClick={onStructureResponses}
            disabled={isStructuring}
            className="w-full font-body gap-2"
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
        </div>
      )}
    </div>
  );
}
