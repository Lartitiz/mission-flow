import { useState, useEffect } from 'react';
import { Copy, ExternalLink, Sparkles, Loader2 } from 'lucide-react';
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
import { useUpdateLastContact } from '@/hooks/useAlumni';

interface AlumniFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missionId: string;
  clientName: string;
  clientEmail: string | null;
  missionType: string;
}

type MessageType = 'news' | 'three_months' | 'annual' | 'thought_of_you' | 'referral';

const TYPE_OPTIONS: { value: MessageType; label: string }[] = [
  { value: 'news', label: 'Prise de nouvelles' },
  { value: 'three_months', label: '3 mois déjà !' },
  { value: 'annual', label: 'Check-in annuel' },
  { value: 'thought_of_you', label: "J'ai pensé à toi" },
  { value: 'referral', label: 'Recommandation' },
];

const SIGNATURE = `--
Laetitia Mattioli
Nowadays Agency
laetitia@nowadaysagency.com
nowadaysagency.com`;

function getFirstName(name: string) {
  return name.split(' ')[0];
}

function getSubject(type: MessageType, firstName: string, isBinome: boolean): string {
  switch (type) {
    case 'news': return `${firstName}, un petit coucou`;
    case 'three_months': return `3 mois déjà, ${firstName} !`;
    case 'annual': return `Un an déjà, ${firstName} !`;
    case 'thought_of_you': return `${firstName}, j'ai pensé à ${isBinome ? 'toi' : 'vous'}`;
    case 'referral': return `Merci pour tout, ${firstName}`;
  }
}

function getBinomeBody(type: MessageType, firstName: string): string {
  switch (type) {
    case 'news':
      return `Hello ${firstName},

J'espère que tu vas bien et que ton projet avance comme tu le souhaites. Ça fait un petit moment qu'on ne s'est pas parlées et je me demandais où tu en étais.

Est-ce que la stratégie qu'on a mise en place ensemble tient toujours la route ? Si tu as des questions, des blocages, ou juste envie d'en discuter, n'hésite pas à me faire signe.

En tout cas, je pense à toi et je te souhaite plein de belles choses pour la suite.

À bientôt,
Laetitia`;
    case 'three_months':
      return `Hello ${firstName},

Ça fait déjà 3 mois qu'on a terminé de travailler ensemble et je serais trop curieuse de savoir où tu en es.

Qu'est-ce qui a changé depuis ? Est-ce que tu as mis en place des choses qui fonctionnent bien ? Est-ce qu'il y a des trucs qui coincent ?

Si tu as envie d'en parler, je suis toujours là. Un petit call de 15 min, un message, ce que tu préfères.

Bravo pour tout ce que tu fais,
Laetitia`;
    case 'annual':
      return `Hello ${firstName},

Un an. Déjà. Je repensais à notre collaboration et à tout le chemin parcouru depuis. J'espère que ton projet continue de grandir et que tu es fière de ce que tu as construit.

Si tu as envie de faire un petit bilan ensemble, ou simplement de me donner des nouvelles, ça me ferait super plaisir. Je suis toujours dans ton coin.

À très vite j'espère,
Laetitia`;
    case 'thought_of_you':
      return `Hello ${firstName},

Je suis tombée sur [à personnaliser : un article / un compte Instagram / un événement] et ça m'a immédiatement fait penser à toi et à ton projet.

[Expliquer brièvement pourquoi]

Voilà, c'était juste pour te faire un petit coucou et te partager ça. J'espère que tout va bien de ton côté.

À bientôt,
Laetitia`;
    case 'referral':
      return `Hello ${firstName},

J'espère que tu vas bien. Je repensais à notre collaboration et je suis vraiment contente de ce qu'on a accompli ensemble.

Si dans ton entourage, tu connais des créatrices ou des entrepreneures qui galèrent avec leur com' et qui cherchent un coup de main, je serais ravie que tu leur parles de moi. Le bouche-à-oreille, c'est ce qui fonctionne le mieux et ça me touche toujours énormément.

En tout cas, merci encore pour ta confiance. Je te souhaite une belle continuation.

À bientôt,
Laetitia`;
  }
}

function getAgencyBody(type: MessageType, firstName: string): string {
  switch (type) {
    case 'news':
      return `Bonjour ${firstName},

J'espère que vous allez bien et que votre structure avance comme vous le souhaitez. Ça fait un petit moment qu'on ne s'est pas parlé·es et je me demandais où vous en étiez.

Est-ce que la stratégie qu'on a mise en place ensemble tient toujours la route ? Si vous avez des questions, des blocages, ou simplement envie d'en discuter, n'hésitez pas à me faire signe.

En tout cas, je pense à vous et je vous souhaite plein de belles choses pour la suite.

À bientôt,
Laetitia`;
    case 'three_months':
      return `Bonjour ${firstName},

Ça fait déjà 3 mois que nous avons terminé de travailler ensemble et je serais curieuse de savoir où vous en êtes.

Qu'est-ce qui a changé depuis ? Est-ce que vous avez mis en place des choses qui fonctionnent bien ? Est-ce qu'il y a des points qui coincent ?

Si vous avez envie d'en parler, je suis toujours disponible. Un petit call de 15 min, un message, ce que vous préférez.

Bravo pour tout ce que vous faites,
Laetitia`;
    case 'annual':
      return `Bonjour ${firstName},

Un an. Déjà. Je repensais à notre collaboration et à tout le chemin parcouru depuis. J'espère que votre structure continue de grandir et que vous êtes fier·ère de ce que vous avez construit.

Si vous avez envie de faire un petit bilan ensemble, ou simplement de me donner des nouvelles, ça me ferait très plaisir. Je suis toujours dans votre coin.

À très vite j'espère,
Laetitia`;
    case 'thought_of_you':
      return `Bonjour ${firstName},

Je suis tombée sur [à personnaliser : un article / un compte Instagram / un événement] et ça m'a immédiatement fait penser à vous et à votre structure.

[Expliquer brièvement pourquoi]

Voilà, c'était juste pour vous faire un petit coucou et vous partager ça. J'espère que tout va bien de votre côté.

À bientôt,
Laetitia`;
    case 'referral':
      return `Bonjour ${firstName},

J'espère que vous allez bien. Je repensais à notre collaboration et je suis vraiment contente de ce que nous avons accompli ensemble.

Si dans votre entourage, vous connaissez des dirigeant·es ou des structures qui cherchent un accompagnement en communication, je serais ravie que vous leur parliez de moi. Le bouche-à-oreille, c'est ce qui fonctionne le mieux et ça me touche toujours énormément.

En tout cas, merci encore pour votre confiance. Je vous souhaite une belle continuation.

À bientôt,
Laetitia`;
  }
}

function getTypeLabel(type: MessageType): string {
  return TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function AlumniFollowUpDialog({
  open,
  onOpenChange,
  missionId,
  clientName,
  clientEmail,
  missionType,
}: AlumniFollowUpDialogProps) {
  const firstName = getFirstName(clientName);
  const isBinome = missionType === 'binome';
  const [selectedType, setSelectedType] = useState<MessageType>('news');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const updateLastContact = useUpdateLastContact();

  useEffect(() => {
    if (open) setSelectedType('news');
  }, [open]);

  useEffect(() => {
    setSubject(getSubject(selectedType, firstName, isBinome));
    setBody(isBinome ? getBinomeBody(selectedType, firstName) : getAgencyBody(selectedType, firstName));
  }, [selectedType, firstName, isBinome]);

  const fullEmail = `${body}\n\n${SIGNATURE}`;

  const logAndUpdate = async () => {
    try {
      await supabase.from('journal_entries').insert({
        mission_id: missionId,
        content: `Prise de nouvelles envoyée (${getTypeLabel(selectedType)})`,
        source: 'auto',
      });
    } catch { /* silent */ }
    updateLastContact.mutate(missionId);
  };

  const handleCopy = async () => {
    const text = `Objet : ${subject}\n\n${fullEmail}`;
    await navigator.clipboard.writeText(text);
    toast({ title: 'Email copié !' });
    await logAndUpdate();
  };

  const handleGmail = () => {
    const mailto = `mailto:${clientEmail ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullEmail)}`;
    window.open(mailto, '_blank');
    logAndUpdate();
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-alumni-message', {
        body: { mission_id: missionId, message_type: selectedType },
      });
      if (error || !data) throw new Error(error?.message || 'Erreur');
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(data.body);
      toast({ title: 'Message généré ✨' });
    } catch {
      toast({ title: 'Bientôt disponible', description: 'La génération IA sera disponible prochainement.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Prendre des nouvelles de {firstName}</DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Message doux, pas de vente. Juste du care.
          </DialogDescription>
        </DialogHeader>

        {/* Type pills */}
        <div className="space-y-2">
          <Label className="font-body text-sm font-medium">Type de message</Label>
          <div className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map((opt) => (
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
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="font-body" />
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

        {/* Signature */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground font-body whitespace-pre-line">
          {SIGNATURE}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-between pt-2">
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="font-body gap-2 border-[#534AB7] text-[#534AB7] hover:bg-[#EEEDFE]"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isGenerating ? 'Génération...' : 'Générer avec l\'IA'}
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-body" disabled={isGenerating}>
              Fermer
            </Button>
            <Button variant="outline" onClick={handleGmail} className="font-body gap-2" disabled={isGenerating}>
              <ExternalLink className="h-4 w-4" />
              Ouvrir dans Gmail
            </Button>
            <Button
              onClick={handleCopy}
              className="font-body gap-2 bg-[#91014b] text-white hover:bg-[#7a0140]"
              disabled={isGenerating}
            >
              <Copy className="h-4 w-4" />
              Copier l'email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
