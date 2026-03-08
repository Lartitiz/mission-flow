import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { generateProposalDocx } from '@/lib/generate-proposal-docx';
import { toast } from 'sonner';

interface ProposalTabProps {
  missionId: string;
  clientName: string;
}

interface ProposalSection {
  title: string;
  content: string;
}

export function ProposalTab({ missionId, clientName }: ProposalTabProps) {
  const [generating, setGenerating] = useState(false);

  const { data: proposal } = useQuery({
    queryKey: ['proposal', missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('mission_id', missionId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const sections: ProposalSection[] = Array.isArray(proposal?.content)
    ? (proposal.content as unknown as ProposalSection[])
    : [];

  const handleGenerateWord = async () => {
    if (sections.length === 0) {
      toast.error('Aucun contenu de proposition à exporter.');
      return;
    }

    setGenerating(true);
    try {
      await generateProposalDocx(clientName, sections);
      toast.success('Document Word téléchargé !');
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération du document.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-lg text-foreground">Proposition</h2>
        <Button
          onClick={handleGenerateWord}
          disabled={generating || sections.length === 0}
          className="gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Générer le Word
            </>
          )}
        </Button>
      </div>

      {sections.length === 0 ? (
        <p className="font-body text-muted-foreground">
          Aucune proposition rédigée pour le moment.
        </p>
      ) : (
        <div className="space-y-4">
          {sections.map((section, idx) => (
            <div
              key={idx}
              className="border-l-4 border-primary bg-card rounded-r-lg p-4"
            >
              <h3 className="font-heading text-sm font-semibold text-foreground mb-2">
                {section.title}
              </h3>
              <p className="font-body text-sm text-muted-foreground whitespace-pre-wrap">
                {section.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
