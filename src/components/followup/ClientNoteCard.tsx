import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface ClientNoteCardProps {
  missionId: string;
  clientName: string;
}

// « Le mot de Laetitia » : affiché en sticker jaune penché dans l'espace
// client. Champ vide = pas de sticker côté cliente.
export function ClientNoteCard({ missionId, clientName }: ClientNoteCardProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const initializedRef = useRef(false);

  const { data: mission } = useQuery({
    queryKey: ['mission-client-note', missionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('missions')
        .select('client_note')
        .eq('id', missionId)
        .single();
      return data as { client_note: string | null } | null;
    },
  });

  useEffect(() => {
    initializedRef.current = false;
  }, [missionId]);
  useEffect(() => {
    if (mission === undefined || initializedRef.current) return;
    initializedRef.current = true;
    setNote((prev) => prev || (mission?.client_note ?? ''));
  }, [mission, missionId]);

  const handleBlur = async () => {
    const value = note.trim();
    if (value === (mission?.client_note ?? '').trim()) return;
    const { error } = await supabase
      .from('missions')
      .update({ client_note: value || null })
      .eq('id', missionId);
    if (error) {
      console.error('[ClientNoteCard] save failed', error);
      toast.error('Mot non enregistré — réessaie.');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['mission-client-note', missionId] });
    toast.success(value ? 'Mot enregistré : visible dans son espace ✓' : 'Mot retiré de son espace');
  };

  const prenom = clientName.split(' ')[0];

  return (
    <div className="bg-jaune/40 rounded-xl p-5">
      <h3 className="font-body font-bold text-base text-brand-logo">
        Le mot pour {prenom}
      </h3>
      <p className="font-body text-xs text-muted-foreground mt-0.5 mb-3">
        Affiché en sticker dans son espace. Vide = pas de sticker.
      </p>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={handleBlur}
        placeholder={`Ex. : Tes photos d'atelier sont superbes, ${prenom} ! On regarde ça ensemble mardi.`}
        className="font-body min-h-[70px] bg-card"
      />
    </div>
  );
}
