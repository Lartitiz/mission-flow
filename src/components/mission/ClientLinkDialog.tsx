import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Copy, Check, ExternalLink, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ClientLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientToken: string;
  clientSlug?: string;
  clientLinkActive: boolean;
  onToggleActive: (active: boolean) => void;
  questionnaireToken?: string | null;
  questionnaireStatus?: string | null;
}

export function ClientLinkDialog({
  open,
  onOpenChange,
  clientToken,
  clientSlug,
  clientLinkActive,
  onToggleActive,
  questionnaireToken,
  questionnaireStatus,
}: ClientLinkDialogProps) {
  const { toast } = useToast();
  const [copiedClient, setCopiedClient] = useState(false);
  const [copiedShort, setCopiedShort] = useState(false);
  const [copiedQuestionnaire, setCopiedQuestionnaire] = useState(false);

  const clientLink = `${window.location.origin}/client/${clientToken}`;
  const shortLink = clientSlug ? `${window.location.origin}/c/${clientSlug}` : null;
  const questionnaireLink = questionnaireToken
    ? `${window.location.origin}/questionnaire/${questionnaireToken}`
    : null;

  const showQuestionnaire = questionnaireLink && questionnaireStatus === 'sent';

  const handleCopy = async (link: string, type: 'client' | 'short' | 'questionnaire') => {
    await navigator.clipboard.writeText(link);
    if (type === 'client') {
      setCopiedClient(true);
      setTimeout(() => setCopiedClient(false), 2000);
    } else if (type === 'short') {
      setCopiedShort(true);
      setTimeout(() => setCopiedShort(false), 2000);
    } else {
      setCopiedQuestionnaire(true);
      setTimeout(() => setCopiedQuestionnaire(false), 2000);
    }
    toast({ title: 'Lien copié !' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">Espace client</DialogTitle>
          <DialogDescription className="font-body">
            Gère les liens d'accès pour ton/ta client·e.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Short link (primary) */}
          {shortLink && (
            <div className="space-y-3">
              <h4 className="font-heading text-sm font-medium text-foreground">🔗 Lien court (à envoyer au client)</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-primary/5 rounded-lg px-3 py-2.5 font-body text-sm font-medium text-primary break-all border border-primary/10">
                  {shortLink}
                </code>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleCopy(shortLink, 'short')}
                  className="font-body gap-2 flex-1"
                >
                  {copiedShort ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedShort ? 'Copié !' : 'Copier le lien court'}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={shortLink} target="_blank" rel="noopener noreferrer" className="gap-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ouvrir
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Full client link (secondary) */}
          <div className="space-y-2">
            <h4 className="font-body text-xs text-muted-foreground">Lien complet (alternatif)</h4>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-lg px-3 py-1.5 font-body text-[10px] text-muted-foreground break-all">
                {clientLink}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(clientLink, 'client')}
                className="font-body h-7 w-7 p-0 shrink-0"
              >
                {copiedClient ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Toggle active */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Label className="font-body text-sm">Lien actif</Label>
            </div>
            <Switch checked={clientLinkActive} onCheckedChange={onToggleActive} />
          </div>

          {!clientLinkActive && (
            <p className="font-body text-xs text-destructive">
              Le lien est désactivé. Le/la client·e verra un message d'erreur.
            </p>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="font-body text-xs text-muted-foreground">
              Le/la client·e peut accéder à cet espace sans créer de compte.
            </p>
          </div>

          {/* Questionnaire link */}
          {showQuestionnaire && (
            <div className="space-y-3 pt-3 border-t border-border">
              <h4 className="font-heading text-sm font-medium text-foreground">Lien du questionnaire</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-lg px-3 py-2 font-body text-xs text-foreground break-all">
                  {questionnaireLink}
                </code>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(questionnaireLink!, 'questionnaire')}
                  className="font-body gap-2 flex-1"
                >
                  {copiedQuestionnaire ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedQuestionnaire ? 'Copié !' : 'Copier le lien'}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={questionnaireLink!} target="_blank" rel="noopener noreferrer" className="gap-2">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Ouvrir
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
