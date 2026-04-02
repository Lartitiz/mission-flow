import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LaunchMessageCardProps {
  clientName: string;
}

export function LaunchMessageCard({ clientName }: LaunchMessageCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const firstName = clientName.split(' ')[0];

  const message = `Coucou ${firstName}, j'espère que tu vas bien. J'ai commencé l'audit. Est-ce que ça te va si je te fais des vocaux comme ça tu as mon analyse en temps réel, et ça permet de découper et que tu ne reçois pas pleins de documents d'un coup ? Sinon je te transmettrai un document structuré avec tout 🙂 Tu me dis ce qui peut le mieux te convenir.`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    toast({ title: 'Message copié !' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-card shadow-[var(--card-shadow)]">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          Message de lancement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-body text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {message}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="font-body gap-2"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copié' : 'Copier le message'}
        </Button>
      </CardContent>
    </Card>
  );
}
