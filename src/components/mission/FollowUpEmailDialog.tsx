import { useState, useEffect, useMemo } from 'react';
import { Mail, Copy, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface FollowUpEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientEmail: string | null;
  missionType: string;
  missionStatus: string;
  amount: number | null;
  clientToken: string;
  missionId: string;
}

type FollowUpType = 'soft' | 'firm' | 'payment';

const SIGNATURE = `--
Laetitia Mattioli
Nowadays Agency
laetitia@nowadaysagency.com
nowadaysagency.com`;

function getFirstName(clientName: string) {
  return clientName.split(' ')[0];
}

function getTypeOptions(status: string): { value: FollowUpType; label: string }[] {
  if (status === 'proposal_sent') {
    return [
      { value: 'soft', label: 'Relance douce (J+5)' },
      { value: 'firm', label: 'Relance franche (J+12)' },
    ];
  }
  return [{ value: 'payment', label: 'Relance paiement/RDV' }];
}

function getSubject(type: FollowUpType, firstName: string): string {
  switch (type) {
    case 'soft':
      return `${firstName}, un petit coucou`;
    case 'firm':
      return `Je me permets de revenir vers toi, ${firstName}`;
    case 'payment':
      return `${firstName}, on lance quand tu veux`;
  }
}

function getBody(type: FollowUpType, firstName: string, missionType: string): string {
  switch (type) {
    case 'soft':
      return `Hello ${firstName},

Je voulais juste prendre de tes nouvelles. Tu as eu le temps de regarder la proposition que je t'ai envoyée ?

Pas de pression du tout : si tu as des questions, si tu veux qu'on ajuste quelque chose, ou si le timing n'est pas le bon, dis-le-moi simplement. Je préfère qu'on en parle plutôt que tu restes avec un doute.

Et si tu veux qu'on en rediscute de vive voix, je suis dispo pour un rapide call de 15 min.

À très vite,
Laetitia`;
    case 'firm':
      return `Hello ${firstName},

Je reviens vers toi parce que je n'ai pas eu de retour sur la proposition. Aucun souci si tu as besoin de plus de temps, ou si finalement ça ne colle pas avec ce que tu cherches : dans les deux cas, ça m'aide de le savoir.

Si c'est une question de budget, de timing, ou que tu as des hésitations, on peut en discuter. J'ai l'habitude d'adapter.

Dans tous les cas, je te souhaite le meilleur pour la suite de ton projet.

Laetitia`;
    case 'payment':
      if (missionType === 'binome') {
        return `Hello ${firstName},

Juste un petit rappel pour qu'on ne perde pas le fil : il me manque le premier paiement pour qu'on puisse démarrer.

👉 https://buy.stripe.com/4gMfZidRHgQo7Ve0IF67S00

Si tu as eu un imprévu ou si tu as des questions, n'hésite pas à me faire signe. Je suis là.

Hâte de commencer,
Laetitia`;
      }
      return `Hello ${firstName},

Juste un petit rappel pour qu'on ne perde pas le fil : il me manque le règlement de l'acompte pour qu'on puisse démarrer.

Pour rappel :
IBAN : FR76 4061 8804 9300 0405 1786 861
BIC : BOUSFRPPXXX
Titulaire : Laetitia Mattioli / Nowadays Agency

Et tu peux déjà réserver l'atelier de lancement ici :
👉 https://calendly.com/laetitia-mattioli/atelier-lancement

Si tu as eu un imprévu ou si tu as des questions, n'hésite pas. Je suis là.

Hâte de commencer,
Laetitia`;
  }
}

function getTypeLabel(type: FollowUpType): string {
  switch (type) {
    case 'soft': return 'Relance douce (J+5)';
    case 'firm': return 'Relance franche (J+12)';
    case 'payment': return 'Relance paiement/RDV';
  }
}

export function FollowUpEmailDialog({
  open,
  onOpenChange,
  clientName,
  clientEmail,
  missionType,
  missionStatus,
  missionId,
}: FollowUpEmailDialogProps) {
  const firstName = getFirstName(clientName);
  const typeOptions = useMemo(() => getTypeOptions(missionStatus), [missionStatus]);
  const [selectedType, setSelectedType] = useState<FollowUpType>(typeOptions[0].value);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Reset when dialog opens or type changes
  useEffect(() => {
    if (open) {
      setSelectedType(typeOptions[0].value);
    }
  }, [open, typeOptions]);

  useEffect(() => {
    setSubject(getSubject(selectedType, firstName));
    setBody(getBody(selectedType, firstName, missionType));
  }, [selectedType, firstName, missionType]);

  const fullEmail = `${body}\n\n${SIGNATURE}`;

  const logToJournal = async (action: string) => {
    try {
      await supabase.from('journal_entries').insert({
        mission_id: missionId,
        content: `Relance envoyée — ${getTypeLabel(selectedType)}`,
        source: 'auto',
      });
    } catch {
      // silent
    }
  };

  const handleCopy = async () => {
    const text = `Objet : ${subject}\n\n${fullEmail}`;
    await navigator.clipboard.writeText(text);
    toast({ title: 'Email copié !' });
    logToJournal('copy');
  };

  const handleGmail = () => {
    const mailto = `mailto:${clientEmail ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullEmail)}`;
    window.open(mailto, '_blank');
    logToJournal('gmail');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Relancer {clientName}</DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Choisis le type de relance, personnalise le message puis copie ou envoie.
          </DialogDescription>
        </DialogHeader>

        {/* Type selection - pill radio buttons */}
        <div className="space-y-2">
          <Label className="font-body text-sm font-medium">Type de relance</Label>
          <div className="flex gap-2 flex-wrap">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedType(opt.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium font-body transition-colors ${
                  selectedType === opt.value
                    ? 'bg-[#91014b] text-white'
                    : 'bg-badge-rose/30 text-foreground hover:bg-badge-rose/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label className="font-body text-sm font-medium">Objet</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="font-body"
          />
        </div>

        {/* Body */}
        <div className="space-y-2">
          <Label className="font-body text-sm font-medium">Corps du message</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="font-body text-sm leading-relaxed"
          />
        </div>

        {/* Signature preview */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground font-body whitespace-pre-line">
          {SIGNATURE}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-body">
            Fermer
          </Button>
          <Button variant="outline" onClick={handleGmail} className="font-body gap-2">
            <ExternalLink className="h-4 w-4" />
            Ouvrir dans Gmail
          </Button>
          <Button onClick={handleCopy} className="font-body gap-2">
            <Copy className="h-4 w-4" />
            Copier l'email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
