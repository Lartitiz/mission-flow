import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, Mail, Copy, ExternalLink, Sparkles } from 'lucide-react';
import { generateProposalDocx } from '@/lib/generate-proposal-docx';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface ProposalTabProps {
  missionId: string;
  clientName: string;
  clientEmail?: string | null;
  missionType: string;
  amount?: number | null;
}

interface ProposalSection {
  title: string;
  content: string;
}

export function ProposalTab({ missionId, clientName, clientEmail, missionType, amount }: ProposalTabProps) {
  const [generatingWord, setGeneratingWord] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailGenerated, setEmailGenerated] = useState(false);
  const queryClient = useQueryClient();

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
      // Load saved email draft
      if (data?.email_draft) {
        try {
          const parsed = JSON.parse(data.email_draft);
          if (parsed.subject && parsed.body) {
            setEmailSubject(parsed.subject);
            setEmailBody(parsed.body);
            setEmailGenerated(true);
          }
        } catch {
          // not JSON, treat as plain body
          setEmailBody(data.email_draft);
          setEmailGenerated(true);
        }
      }
      return data;
    },
  });

  // Fetch structured notes for the email generation context
  const { data: discoveryCall } = useQuery({
    queryKey: ['discovery-call-for-email', missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discovery_calls')
        .select('structured_notes')
        .eq('mission_id', missionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  console.log("Proposal content:", proposal?.content);

  const sections: ProposalSection[] = (() => {
    const c = proposal?.content;
    if (!c) return [];
    if (Array.isArray(c)) return c as unknown as ProposalSection[];
    // Handle { sections: [...] } shape
    if (typeof c === 'object' && 'sections' in (c as Record<string, unknown>)) {
      const s = (c as Record<string, unknown>).sections;
      if (Array.isArray(s)) return s as unknown as ProposalSection[];
    }
    return [];
  })();

  const handleGenerateWord = async () => {
    if (sections.length === 0) {
      toast.error('Aucun contenu de proposition à exporter.');
      return;
    }
    setGeneratingWord(true);
    try {
      await generateProposalDocx(clientName, sections);
      toast.success('Document Word téléchargé !');
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération du document.");
    } finally {
      setGeneratingWord(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!discoveryCall?.structured_notes) {
      toast.error("Pas de notes structurées disponibles pour générer l'email.");
      return;
    }

    setGeneratingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-proposal-email', {
        body: {
          client_name: clientName,
          structured_notes: discoveryCall.structured_notes,
          mission_type: missionType,
          tutoiement: proposal?.tutoiement ?? true,
          amount: amount,
        },
      });

      if (error) throw error;
      if (!data?.subject || !data?.body) throw new Error('Réponse IA invalide');

      setEmailSubject(data.subject);
      setEmailBody(data.body);
      setEmailGenerated(true);

      // Save to proposals.email_draft
      if (proposal?.id) {
        await supabase
          .from('proposals')
          .update({ email_draft: JSON.stringify({ subject: data.subject, body: data.body }) })
          .eq('id', proposal.id);
        queryClient.invalidateQueries({ queryKey: ['proposal', missionId] });
      }

      toast.success('Email généré !');
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la génération de l'email.");
    } finally {
      setGeneratingEmail(false);
    }
  };

  const saveEmailDraft = async () => {
    if (!proposal?.id) return;
    await supabase
      .from('proposals')
      .update({ email_draft: JSON.stringify({ subject: emailSubject, body: emailBody }) })
      .eq('id', proposal.id);
  };

  const handleCopyEmail = async () => {
    const text = `Objet : ${emailSubject}\n\n${emailBody}`;
    await navigator.clipboard.writeText(text);
    toast.success('Email copié dans le presse-papier !');
  };

  const handleOpenGmail = () => {
    const to = clientEmail || '';
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Proposal content */}
      <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-lg text-foreground">Proposition</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGenerateEmail}
              disabled={generatingEmail || !discoveryCall?.structured_notes}
              className="gap-2"
            >
              {generatingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rédaction...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Rédiger l'email
                </>
              )}
            </Button>
            <Button
              onClick={handleGenerateWord}
              disabled={generatingWord || (!proposal?.content || sections.length === 0)}
              className="gap-2"
            >
              {generatingWord ? (
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

      {/* Email draft */}
      {emailGenerated && (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-base text-foreground">Email d'envoi</h3>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyEmail} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copier
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenGmail} className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                Ouvrir dans Gmail
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1 block">Objet</label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                onBlur={saveEmailDraft}
                className="font-body"
              />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground mb-1 block">Corps de l'email</label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                onBlur={saveEmailDraft}
                rows={12}
                className="font-body text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
