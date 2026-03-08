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
import { useCreateMission } from '@/hooks/useMissions';
import { useNavigate } from 'react-router-dom';

interface NewMissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewMissionDialog({ open, onOpenChange }: NewMissionDialogProps) {
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const createMission = useCreateMission();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    const mission = await createMission.mutateAsync({
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || undefined,
    });

    setClientName('');
    setClientEmail('');
    onOpenChange(false);
    navigate(`/dashboard/mission/${mission.id}/discovery`);
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
