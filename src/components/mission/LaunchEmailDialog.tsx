import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Copy, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface LaunchEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientEmail: string | null;
  missionType: string;
  missionId: string;
  amount: number | null;
  clientToken: string;
}

type AccompType = 'binome' | 'agency' | 'courte';
type PaymentType = 'stripe' | 'virement';
type KickoffType = 'visio' | 'questionnaire';

function extractProposalSummary(proposalContent: any): { perimeter: string; keyPoints: string[] } {
  const sections = proposalContent?.sections || (Array.isArray(proposalContent) ? proposalContent : []);

  const offerSection = sections.find((s: any) =>
    s.title?.toLowerCase().includes('offre') ||
    s.title?.toLowerCase().includes('proposition') ||
    s.title?.toLowerCase().includes('accompagnement')
  );

  let perimeter = '';
  let keyPoints: string[] = [];

  if (offerSection?.content) {
    const lines = offerSection.content.split('\n');
    keyPoints = lines
      .filter((l: string) => l.trim().match(/^[✓\-•*]/) || l.trim().match(/^Phase/i))
      .map((l: string) => l.trim().replace(/^[✓\-•*]\s*/, '').trim())
      .filter((l: string) => l.length > 10)
      .slice(0, 6);

    const content = offerSection.content.toLowerCase();
    const prestations: string[] = [];
    if (content.includes('réseaux sociaux') || content.includes('instagram') || content.includes('social media')) prestations.push('réseaux sociaux');
    if (content.includes('site web') || content.includes('site internet') || content.includes('seo')) prestations.push('site web');
    if (content.includes('emailing') || content.includes('newsletter') || content.includes('email')) prestations.push('emailing');
    if (content.includes('branding') || content.includes('positionnement') || content.includes('identité')) prestations.push('branding');
    if (content.includes('presse') || content.includes('influence')) prestations.push('relations presse');
    if (content.includes('événement') || content.includes('lancement')) prestations.push('lancement');
    perimeter = prestations.join(', ') || '[PÉRIMÈTRE]';
  }

  return { perimeter, keyPoints };
}

function buildEmail(
  prenom: string,
  accomp: AccompType,
  payment: PaymentType,
  kickoff: KickoffType,
  proposal: { perimeter: string; keyPoints: string[] },
  acompte: string
): string {
  let body = '';

  // INTRO
  body += `Hello ${prenom},\n\nTrop contente qu'on se lance ensemble.\nJe voulais te récapituler comment ça va se passer concrètement, pour que tu saches exactement à quoi t'attendre.\n\n`;

  // ACCOMPAGNEMENT
  if (accomp === 'binome') {
    body += `On va travailler ensemble pendant 6 mois. Les 2 premiers mois, je construis toute ta stratégie de com'. Les 4 mois suivants, on applique ensemble avec une visio de 2h par mois.\n`;
    if (proposal.keyPoints.length > 0) {
      body += `\nPour rappel, voici ce qu'on va travailler ensemble :\n`;
      proposal.keyPoints.forEach(p => { body += `— ${p}\n`; });
    }
    body += `\nConcrètement, notre première étape c'est l'atelier de lancement : un appel où je te pose plein de questions pour comprendre ton univers en profondeur. C'est la base de tout ce qu'on va construire.\n\n`;
  } else if (accomp === 'agency') {
    body += `Comme on en a discuté, je prends en main ${proposal.perimeter}. Tu valides les grandes lignes, je m'occupe du reste.\n`;
    if (proposal.keyPoints.length > 0) {
      body += `\nPour rappel, voici les grandes étapes :\n`;
      proposal.keyPoints.forEach(p => { body += `— ${p}\n`; });
    }
    body += `\nNotre première étape : un atelier de lancement pour que je me branche sur ton projet en profondeur. C'est ce qui me permet de livrer du travail vraiment sur mesure.\n\n`;
  } else {
    body += `Comme prévu, on démarre avec ${proposal.perimeter}. Notre première étape : l'atelier de lancement pour que j'aie toutes les infos nécessaires.\n\n`;
  }

  // PAIEMENT
  if (payment === 'stripe') {
    body += `Pour activer ton accompagnement, voici le lien de paiement (250€/mois) :\n👉 https://buy.stripe.com/4gMfZidRHgQo7Ve0IF67S00\nUne fois le premier paiement reçu, on planifie l'atelier de lancement.\n\n`;
  } else {
    body += `Je t'envoie le devis et la facture d'acompte en pièce jointe. Voici les coordonnées bancaires pour le virement :\nIBAN : FR76 4061 8804 9300 0405 1786 861\nBIC : BOUSFRPPXXX\nTitulaire : Laetitia Mattioli / Nowadays Agency\nMontant acompte : ${acompte}€\nDès réception, on planifie l'atelier de lancement.\n\n`;
  }

  // KICKOFF
  if (kickoff === 'visio') {
    body += `Tu peux déjà réserver le créneau pour notre atelier de lancement ici :\n👉 https://calendly.com/laetitia-mattioli/atelier-lancement\n\n`;
  } else {
    body += `Pour démarrer, je t'envoie un questionnaire avec toutes les questions qui vont m'aider à construire ta stratégie. Tu peux le remplir à ton rythme, et on planifiera un call de restitution ensuite.\n\n`;
  }

  // FIN
  body += `Et pour qu'on puisse échanger facilement au quotidien, voici mon WhatsApp :\n👉 06 14 13 39 21\nN'hésite pas à m'envoyer un petit message pour qu'on se retrouve dessus. C'est souvent plus fluide que les mails pour les questions rapides.\n\nJ'ai vraiment hâte de travailler sur ton projet. On va faire du beau.\n\nLaetitia\n--\nLaetitia Mattioli\nNowadays Agency\nlaetitia@nowadaysagency.com\nnowadaysagency.com`;

  return body;
}

const pillClasses = (active: boolean) =>
  active
    ? 'bg-[hsl(var(--primary))] text-white font-medium'
    : 'bg-secondary text-muted-foreground hover:bg-secondary/80';

export function LaunchEmailDialog({
  open,
  onOpenChange,
  clientName,
  clientEmail,
  missionType,
  missionId,
  amount,
}: LaunchEmailDialogProps) {
  const prenom = clientName.split(' ')[0];
  const defaultAccomp: AccompType = missionType === 'agency' ? 'agency' : 'binome';
  const defaultPayment: PaymentType = missionType === 'agency' ? 'virement' : 'stripe';

  const [accomp, setAccomp] = useState<AccompType>(defaultAccomp);
  const [payment, setPayment] = useState<PaymentType>(defaultPayment);
  const [kickoff, setKickoff] = useState<KickoffType>('visio');
  const [subject, setSubject] = useState(`C'est parti ${prenom} : on lance ta mission`);
  const [body, setBody] = useState('');
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const [proposal, setProposal] = useState<{ perimeter: string; keyPoints: string[] }>({ perimeter: '[PÉRIMÈTRE]', keyPoints: [] });
  const [acompte, setAcompte] = useState(amount ? String(Math.round(amount * 0.5)) : '[MONTANT]');

  // Fetch proposal on mount
  useEffect(() => {
    if (!open) return;
    // Reset state
    const acc: AccompType = missionType === 'agency' ? 'agency' : 'binome';
    const pay: PaymentType = missionType === 'agency' ? 'virement' : 'stripe';
    setAccomp(acc);
    setPayment(pay);
    setKickoff('visio');
    setSubject(`C'est parti ${prenom} : on lance ta mission`);
    setManuallyEdited(false);
    setAcompte(amount ? String(Math.round(amount * 0.5)) : '[MONTANT]');

    (async () => {
      const { data } = await supabase
        .from('proposals')
        .select('content')
        .eq('mission_id', missionId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      const summary = data?.content ? extractProposalSummary(data.content) : { perimeter: '[PÉRIMÈTRE]', keyPoints: [] };
      setProposal(summary);
    })();
  }, [open, missionId, missionType, prenom, amount]);

  // Rebuild email when toggles change
  const regenerate = useCallback(
    (a: AccompType, p: PaymentType, k: KickoffType, prop: typeof proposal, ac: string) => {
      setBody(buildEmail(prenom, a, p, k, prop, ac));
    },
    [prenom]
  );

  // Auto-generate on proposal loaded or toggle change (if not manually edited)
  useEffect(() => {
    if (!open) return;
    if (!manuallyEdited) {
      regenerate(accomp, payment, kickoff, proposal, acompte);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accomp, payment, kickoff, proposal, acompte]);

  const handleToggle = (setter: (v: any) => void, value: any) => {
    if (manuallyEdited) {
      if (!window.confirm('Tu as modifié le texte manuellement. Régénérer va écraser tes modifications. Continuer ?')) return;
    }
    setter(value);
    setManuallyEdited(false);
  };

  const handleBodyChange = (val: string) => {
    setBody(val);
    setManuallyEdited(true);
  };

  const handleCopy = () => {
    const text = `Objet : ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text);
    toast({ title: 'Email copié !' });
  };

  const handleGmail = () => {
    const mailto = `mailto:${clientEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailto, '_blank');
  };

  const Toggle = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-body transition-colors ${pillClasses(active)}`}
    >
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Email de lancement</DialogTitle>
        </DialogHeader>

        {/* Toggles */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-body w-28">Accompagnement</span>
            <Toggle label="Binôme" active={accomp === 'binome'} onClick={() => handleToggle(setAccomp, 'binome')} />
            <Toggle label="Agency" active={accomp === 'agency'} onClick={() => handleToggle(setAccomp, 'agency')} />
            <Toggle label="Mission courte" active={accomp === 'courte'} onClick={() => handleToggle(setAccomp, 'courte')} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-body w-28">Paiement</span>
            <Toggle label="Stripe (250€/mois)" active={payment === 'stripe'} onClick={() => handleToggle(setPayment, 'stripe')} />
            <Toggle label="Virement (devis)" active={payment === 'virement'} onClick={() => handleToggle(setPayment, 'virement')} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-body w-28">Kick-off</span>
            <Toggle label="Visio" active={kickoff === 'visio'} onClick={() => handleToggle(setKickoff, 'visio')} />
            <Toggle label="Questionnaire" active={kickoff === 'questionnaire'} onClick={() => handleToggle(setKickoff, 'questionnaire')} />
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-body">Objet</label>
          <Input value={subject} onChange={e => setSubject(e.target.value)} />
        </div>

        {/* Note */}
        <p className="text-xs text-muted-foreground font-body italic">
          Les éléments entre [crochets] sont à remplacer avant d'envoyer.
        </p>

        {/* Body */}
        <Textarea
          value={body}
          onChange={e => handleBodyChange(e.target.value)}
          className="min-h-[400px] font-body text-sm leading-relaxed"
          rows={18}
        />

        {/* Acompte input when virement */}
        {payment === 'virement' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-body whitespace-nowrap">Montant acompte (€)</label>
            <Input
              type="number"
              value={acompte}
              onChange={e => {
                setAcompte(e.target.value);
                setManuallyEdited(false); // re-generate with new acompte
              }}
              className="w-32"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
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
