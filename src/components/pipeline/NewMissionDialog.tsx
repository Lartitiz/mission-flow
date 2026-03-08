import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateMission } from '@/hooks/useMissions';
import { useNavigate } from 'react-router-dom';
import { PIPELINE_COLUMNS } from '@/lib/missions';
import { Info } from 'lucide-react';

const MISSION_TYPES = [
  { value: 'non_determine', label: 'Non déterminé' },
  { value: 'binome', label: 'Binôme' },
  { value: 'agency', label: 'Agency' },
];

// Map status to a sensible default first tab
const STATUS_TO_TAB: Record<string, string> = {
  discovery_call: 'discovery',
  proposal_drafting: 'proposal',
  proposal_sent: 'proposal',
  signed: 'kickoff',
  active: 'actions',
  completed: 'follow-up',
  lost: 'discovery',
};

interface NewMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewMissionDialog({ open, onOpenChange }: NewMissionDialogProps) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [missionType, setMissionType] = useState('non_determine');
  const [status, setStatus] = useState('discovery_call');
  const [amount, setAmount] = useState('');
  const createMission = useCreateMission();
  const navigate = useNavigate();

  const showAdvancedInfo = ['active', 'completed', 'signed'].includes(status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const parsedAmount = amount.trim() ? parseFloat(amount) : undefined;

    const mission = await createMission.mutateAsync({
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || undefined,
      mission_type: missionType,
      status,
      amount: parsedAmount != null && !isNaN(parsedAmount) ? parsedAmount : undefined,
    });

    // Reset
    setClientName('');
    setClientEmail('');
    setMissionType('non_determine');
    setStatus('discovery_call');
    setAmount('');
    onOpenChange(false);

    const tab = STATUS_TO_TAB[status] || 'discovery';
    navigate(`/dashboard/mission/${mission.id}/${tab}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Nouvelle mission</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="client-name" className="font-body text-sm">
              Nom du/de la client·e
            </Label>
            <Input
              id="client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Ex : Marie Dupont"
              required
              className="font-body"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-email" className="font-body text-sm">
              Email <span className="text-muted-foreground">(optionnel)</span>
            </Label>
            <Input
              id="client-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="font-body"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-body text-sm">Type de mission</Label>
            <Select value={missionType} onValueChange={setMissionType}>
              <SelectTrigger className="font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MISSION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="font-body">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-body text-sm">Étape actuelle</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="font-body">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_COLUMNS.map((col) => (
                  <SelectItem key={col.id} value={col.id} className="font-body">
                    {col.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showAdvancedInfo && (
            <div className="flex items-start gap-2 rounded-lg bg-secondary p-3">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="font-body text-xs text-muted-foreground">
                Les onglets précédents (appel, proposition, kick-off) seront disponibles mais vides. Tu pourras les remplir plus tard si besoin.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount" className="font-body text-sm">
              Montant <span className="text-muted-foreground">(optionnel)</span>
            </Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="font-body pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-body text-sm">€</span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full font-body"
            disabled={createMission.isPending || !clientName.trim()}
          >
            {createMission.isPending ? 'Création...' : 'Créer'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
