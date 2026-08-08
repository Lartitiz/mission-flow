import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecapCardProps {
  missionId: string;
  clientName: string;
}

interface RecapBlocks {
  doneItems: string[];
  progress: { percent: number; label: string; count: string };
  upcomingItems: string[];
}

// Le récap de mission : assemblé par le serveur, relu et envoyé par Laetitia.
// Rien ne part sans son clic.
export function RecapCard({ missionId, clientName }: RecapCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [blocks, setBlocks] = useState<RecapBlocks | null>(null);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [intro, setIntro] = useState('');
  const [includeDone, setIncludeDone] = useState(true);
  const [includeProgress, setIncludeProgress] = useState(true);
  const [includeUpcoming, setIncludeUpcoming] = useState(true);

  const { data: meta } = useQuery({
    queryKey: ['mission-recap-meta', missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('missions')
        .select('last_recap_sent_at')
        .eq('id', missionId)
        .single();
      return data as { last_recap_sent_at: string | null } | null;
    },
  });

  const daysSinceRecap = meta?.last_recap_sent_at
    ? Math.floor((Date.now() - new Date(meta.last_recap_sent_at).getTime()) / 86400000)
    : null;

  const firstName = clientName.split(' ')[0];

  const handleOpen = async () => {
    setOpen(true);
    setPreparing(true);
    setBlocks(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-mission-recap', {
        body: { mission_id: missionId, mode: 'prepare' },
      });
      if (error || data?.error) throw new Error(data?.error || 'Erreur');
      setBlocks(data.blocks as RecapBlocks);
      setClientEmail(data.client_email ?? null);
      setIntro((data.intro as string) || '');
    } catch (e) {
      console.error('[RecapCard] prepare failed', e);
      toast({ title: 'Erreur', description: 'Impossible de préparer le récap.', variant: 'destructive' });
      setOpen(false);
    } finally {
      setPreparing(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-mission-recap', {
        body: {
          mission_id: missionId,
          mode: 'send',
          intro_text: intro,
          include: { done: includeDone, progress: includeProgress, upcoming: includeUpcoming },
        },
      });
      if (error || data?.error) throw new Error(data?.error || 'Erreur');
      toast({ title: `Récap envoyé à ${firstName} ✓` });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['mission-recap-meta', missionId] });
    } catch (e) {
      console.error('[RecapCard] send failed', e);
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : "L'envoi a échoué : réessaie.",
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const blocEmpty =
    blocks && blocks.doneItems.length === 0 && blocks.upcomingItems.length === 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-body font-bold text-base text-brand-logo">
            Récap pour {firstName}
          </h3>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            {daysSinceRecap === null
              ? 'Jamais envoyé : le bon rythme, c\'est après chaque atelier.'
              : daysSinceRecap === 0
                ? 'Envoyé aujourd\'hui ✓'
                : `Dernier récap : il y a ${daysSinceRecap} jour${daysSinceRecap > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button size="sm" onClick={handleOpen} className="font-body gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          Envoyer un récap
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Récap pour {firstName}</DialogTitle>
            <DialogDescription className="font-body">
              Tout est pré-rempli depuis la mission : tu relis, tu ajustes, tu envoies.
            </DialogDescription>
          </DialogHeader>

          {preparing && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="font-body text-sm text-muted-foreground">
                Je rassemble ce qui s'est passé…
              </span>
            </div>
          )}

          {!preparing && blocks && (
            <div className="space-y-4">
              {!clientEmail && (
                <p className="font-body text-sm text-warning-red font-semibold">
                  Pas d'e-mail cliente sur cette mission : ajoute-le sur la fiche avant d'envoyer.
                </p>
              )}

              <div className="space-y-1.5">
                <Label className="font-body text-sm">
                  Ton mot d'ouverture {intro ? '(pré-rédigé, à retoucher)' : ''}
                </Label>
                <Textarea
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  placeholder={`Ex. : Un mois qu'on avance ensemble et ça se voit, ${firstName} !`}
                  className="font-body min-h-[70px]"
                />
              </div>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-secondary cursor-pointer">
                <Checkbox checked={includeDone} onCheckedChange={(c) => setIncludeDone(!!c)} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="font-body text-sm font-bold">Ce qu'on a fait ensemble</p>
                  {blocks.doneItems.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {blocks.doneItems.map((item, i) => (
                        <li key={i} className="font-body text-xs text-muted-foreground">✓ {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-body text-xs text-muted-foreground">Rien de nouveau depuis le dernier récap</p>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-secondary cursor-pointer">
                <Checkbox checked={includeProgress} onCheckedChange={(c) => setIncludeProgress(!!c)} className="mt-0.5" />
                <div>
                  <p className="font-body text-sm font-bold">Où on en est</p>
                  <p className="font-body text-xs text-muted-foreground">
                    {blocks.progress.label}{blocks.progress.count ? ` · ${blocks.progress.count}` : ''}
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg bg-secondary cursor-pointer">
                <Checkbox checked={includeUpcoming} onCheckedChange={(c) => setIncludeUpcoming(!!c)} className="mt-0.5" />
                <div className="min-w-0">
                  <p className="font-body text-sm font-bold">Ce qui arrive</p>
                  {blocks.upcomingItems.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {blocks.upcomingItems.map((item, i) => (
                        <li key={i} className="font-body text-xs text-muted-foreground">→ {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-body text-xs text-muted-foreground">Rien de planifié pour l'instant</p>
                  )}
                </div>
              </label>

              {blocEmpty && (
                <p className="font-body text-xs text-muted-foreground italic">
                  Peu de matière depuis le dernier récap : peut-être attendre le prochain atelier ?
                </p>
              )}

              <Button
                onClick={handleSend}
                disabled={sending || !clientEmail}
                className="w-full font-body"
              >
                {sending ? 'Envoi…' : `Envoyer le récap à ${firstName}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
