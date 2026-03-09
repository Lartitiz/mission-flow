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

  const handleCopy = async (link: string, type: 'client' | 'questionnaire') => {
    await navigator.clipboard.writeText(link);
    if (type === 'client') {
      setCopiedClient(true);
      setTimeout(() => setCopiedClient(false), 2000);
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
          {/* Client link */}
          <div className="space-y-3">
            <h4 className="font-heading text-sm font-medium text-foreground">Lien de l'espace client</h4>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-lg px-3 py-2 font-body text-xs text-foreground break-all">
                {clientLink}
              </code>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(clientLink, 'client')}
                className="font-body gap-2 flex-1"
              >
                {copiedClient ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedClient ? 'Copié !' : 'Copier le lien'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={clientLink} target="_blank" rel="noopener noreferrer" className="gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ouvrir
                </a>
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
