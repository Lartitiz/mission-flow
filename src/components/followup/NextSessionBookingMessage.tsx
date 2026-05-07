import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NextSessionBookingMessageProps {
  clientName: string;
}

export function NextSessionBookingMessage({ clientName }: NextSessionBookingMessageProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const firstName = clientName.split(' ')[0];

  const defaultMessage = `Coucou ${firstName}, voici mon agenda pour réserver ton prochain atelier : https://calendly.com/laetitia-mattioli/atelier-2h\n\nÀ très vite !`;
  const [message, setMessage] = useState(defaultMessage);

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
          <Calendar className="h-4 w-4 text-primary" />
          Message de réservation — prochaine séance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="font-body text-sm leading-relaxed"
        />
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
