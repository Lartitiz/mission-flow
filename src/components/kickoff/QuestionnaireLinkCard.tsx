import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, ExternalLink, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface QuestionnaireLinkCardProps {
  token: string;
  status: string;
  sentAt?: string | null;
  completedAt?: string | null;
  selectedCount: number;
  responseCount: number;
  clientName: string;
  onMarkAsSent: () => void;
  isSaving: boolean;
}

export function QuestionnaireLinkCard({
  token,
  status,
  sentAt,
  completedAt,
  selectedCount,
  responseCount,
  clientName,
  onMarkAsSent,
  isSaving,
}: QuestionnaireLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/questionnaire/${token}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    return true;
  };

  const handleCopy = async () => {
    await copyLink();
    toast.success('Lien copié');
  };

  const handleMarkAsSent = async () => {
    await copyLink();
    onMarkAsSent();
    toast.success(`Lien copié — prêt à coller dans ton mail à ${clientName}`);
  };

  const statusBadge = () => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 font-body text-xs">Envoyé</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 font-body text-xs">Complété</Badge>;
      default:
        return <Badge variant="secondary" className="font-body text-xs">Brouillon</Badge>;
    }
  };

  const canSend = selectedCount > 0;

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-sm font-medium text-foreground">
            Lien du questionnaire
          </h3>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            {selectedCount} question{selectedCount > 1 ? 's' : ''} sélectionnée{selectedCount > 1 ? 's' : ''}
            {status === 'sent' && selectedCount > 0 && ` · ${responseCount}/${selectedCount} réponse${responseCount > 1 ? 's' : ''}`}
          </p>
        </div>
        {statusBadge()}
      </div>

      {/* Link display */}
      <div className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2 border border-border">
        <span className="font-body text-xs text-muted-foreground truncate flex-1" title={link}>
          {link}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 w-7 p-0 shrink-0">
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="ghost" size="sm" asChild className="h-7 w-7 p-0 shrink-0">
          <a href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>

      {/* Action */}
      {status === 'draft' || status === 'ready' ? (
        <Button
          onClick={handleMarkAsSent}
          disabled={!canSend || isSaving}
          className="w-full font-body gap-2 bg-[hsl(var(--badge-rose))] hover:bg-[hsl(var(--badge-rose)/0.9)] text-white"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Copier le lien & marquer comme envoyé
        </Button>
      ) : (
        <div className="space-y-1 text-xs font-body text-muted-foreground">
          {sentAt && <p>Envoyé le {format(new Date(sentAt), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>}
          {completedAt && <p>Complété le {format(new Date(completedAt), 'dd MMM yyyy à HH:mm', { locale: fr })}</p>}
        </div>
      )}

      {!canSend && status === 'draft' && (
        <p className="font-body text-xs text-muted-foreground italic">
          Coche au moins une question à gauche pour activer l'envoi.
        </p>
      )}
    </div>
  );
}
