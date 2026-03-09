import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, Mail, Copy, ExternalLink, Sparkles, RefreshCw, Upload, Download } from 'lucide-react';
import { generateProposalDocx } from '@/lib/generate-proposal-docx';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ImportProposalDialog } from '@/components/proposal/ImportProposalDialog';
import { saveAs } from 'file-saver';

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

interface ClarificationQA {
  question: string;
  answer: string;
}

type FlowStep = 'idle' | 'clarifying' | 'clarification_questions' | 'ready_to_generate' | 'generating' | 'done';

export function ProposalTab({ missionId, clientName, clientEmail, missionType, amount }: ProposalTabProps) {
  const [generatingWord, setGeneratingWord] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailGenerated, setEmailGenerated] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Flow state
  const [flowStep, setFlowStep] = useState<FlowStep>('idle');
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([]);
  const [clarificationAnswers, setClarificationAnswers] = useState<string[]>([]);
  const [tutoiement, setTutoiement] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: proposal, refetch: refetchProposal } = useQuery({
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
      if (data?.email_draft) {
        try {
          const parsed = JSON.parse(data.email_draft);
          if (parsed.subject && parsed.body) {
            setEmailSubject(parsed.subject);
            setEmailBody(parsed.body);
            setEmailGenerated(true);
          }
        } catch {
          setEmailBody(data.email_draft);
          setEmailGenerated(true);
        }
      }
      return data;
    },
  });

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


  const sections: ProposalSection[] = (() => {
    const c = proposal?.content;
    if (!c) return [];
    if (Array.isArray(c)) return c as unknown as ProposalSection[];
    if (typeof c === 'object' && 'sections' in (c as Record<string, unknown>)) {
      const s = (c as Record<string, unknown>).sections;
      if (Array.isArray(s)) return s as unknown as ProposalSection[];
    }
    return [];
  })();

  const hasContent = sections.length > 0;

  // Determine initial flow step based on existing data
  useEffect(() => {
    if (hasContent) {
      setFlowStep('done');
    }
  }, [hasContent]);

  // -- CLARIFICATION --
  const handlePrepareProposal = async () => {
    if (!discoveryCall?.structured_notes) {
      toast.error("Pas de notes structurées. Complète d'abord l'appel découverte.");
      return;
    }
    setFlowStep('clarifying');
    try {
      const { data, error } = await supabase.functions.invoke('clarify-proposal', {
        body: {
          structured_notes: discoveryCall.structured_notes,
          mission_type: missionType,
        },
      });
      if (error) throw error;

      if (data.needs_clarification && data.questions?.length > 0) {
        setClarificationQuestions(data.questions);
        setClarificationAnswers(new Array(data.questions.length).fill(''));
        setFlowStep('clarification_questions');
      } else {
        setFlowStep('ready_to_generate');
      }
    } catch (err: any) {
      console.error("Clarification error:", err);
      toast.error("Erreur lors de l'analyse : " + (err?.message || "Réessaie."));
      setFlowStep('idle');
    }
  };

  const handleValidateClarification = () => {
    const qa: ClarificationQA[] = clarificationQuestions.map((q, i) => ({
      question: q,
      answer: clarificationAnswers[i] || '',
    }));
    // Save clarification QA to proposal if it exists
    setFlowStep('ready_to_generate');
  };

  // -- GENERATION --
  const handleGenerate = async () => {
    if (!discoveryCall?.structured_notes) {
      toast.error("Pas de notes structurées.");
      return;
    }
    setFlowStep('generating');

    const qa: ClarificationQA[] = clarificationQuestions.map((q, i) => ({
      question: q,
      answer: clarificationAnswers[i] || '',
    })).filter(qa => qa.answer.trim() !== '');

    try {
      const { data, error } = await supabase.functions.invoke('generate-proposal', {
        body: {
          structured_notes: discoveryCall.structured_notes,
          clarification_qa: qa.length > 0 ? qa : null,
          mission_type: missionType,
          tutoiement,
        },
      });
      if (error) throw error;
      if (!data?.sections) throw new Error("Format de réponse invalide");

      const contentToSave = { sections: data.sections };

      if (proposal?.id) {
        // Update existing
        await supabase
          .from('proposals')
          .update({
            content: contentToSave as any,
            tutoiement,
            clarification_qa: qa.length > 0 ? (qa as any) : null,
          })
          .eq('id', proposal.id);
      } else {
        // Create new
        await supabase
          .from('proposals')
          .insert({
            mission_id: missionId,
            content: contentToSave as any,
            tutoiement,
            clarification_qa: qa.length > 0 ? (qa as any) : null,
            version: 1,
          });
      }

      await refetchProposal();
      queryClient.invalidateQueries({ queryKey: ['proposal', missionId] });
      setFlowStep('done');
      toast.success('Proposition générée !');
    } catch (err: any) {
      console.error("Generate error:", err);
      toast.error("Erreur : " + (err?.message || "La génération a échoué."));
      setFlowStep('ready_to_generate');
    }
  };

  // -- INLINE EDITING --
  const handleStartEdit = (idx: number) => {
    setEditingIndex(idx);
    setEditValue(sections[idx].content);
  };

  const handleSaveEdit = useCallback(async (idx: number, newContent: string) => {
    if (!proposal?.id) return;
    const updatedSections = sections.map((s, i) =>
      i === idx ? { ...s, content: newContent } : s
    );
    const contentToSave = { sections: updatedSections };

    await supabase
      .from('proposals')
      .update({ content: contentToSave as any })
      .eq('id', proposal.id);

    queryClient.invalidateQueries({ queryKey: ['proposal', missionId] });
  }, [proposal?.id, sections, missionId, queryClient]);

  const handleBlurEdit = (idx: number) => {
    setEditingIndex(null);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    handleSaveEdit(idx, editValue);
  };

  // -- REGENERATE SINGLE SECTION --
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);

  const handleRegenerateSection = async (idx: number) => {
    if (!discoveryCall?.structured_notes || !proposal?.id) return;
    const section = sections[idx];
    setRegeneratingIdx(idx);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-proposal-section', {
        body: {
          section_title: section.title,
          section_content: section.content,
          structured_notes: discoveryCall.structured_notes,
          mission_type: missionType,
          tutoiement: proposal.tutoiement,
        },
      });
      if (error) throw error;
      if (!data?.content) throw new Error("Format invalide");

      const updatedSections = sections.map((s, i) =>
        i === idx ? { title: data.title || section.title, content: data.content } : s
      );
      await supabase
        .from('proposals')
        .update({ content: { sections: updatedSections } as any })
        .eq('id', proposal.id);
      await refetchProposal();
      toast.success(`Section "${section.title}" régénérée`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erreur : " + (err?.message || "Régénération échouée."));
    } finally {
      setRegeneratingIdx(null);
    }
  };

  // -- WORD EXPORT --
  const handleGenerateWord = async () => {
    if (sections.length === 0) {
      toast.error('Aucun contenu de proposition à exporter.');
      return;
    }
    setGeneratingWord(true);
    try {
      await generateProposalDocx(clientName, sections);
      toast.success('Document Word téléchargé !');
    } catch (err: any) {
      console.error("Erreur Word:", err);
      toast.error("Erreur : " + (err?.message || "Génération impossible"));
    } finally {
      setGeneratingWord(false);
    }
  };

  // -- EMAIL --
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
      {/* === STEP 1: Prepare / Clarification === */}
      {!hasContent && flowStep === 'idle' && (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
          <p className="font-body text-muted-foreground mb-6">
            Aucune proposition rédigée pour le moment.
          </p>
          <Button
            onClick={handlePrepareProposal}
            disabled={!discoveryCall?.structured_notes}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-body text-base px-8 py-3 h-auto"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Préparer la proposition
          </Button>
          {!discoveryCall?.structured_notes && (
            <p className="font-body text-xs text-muted-foreground mt-3">
              Complète d'abord l'appel découverte et structure les notes.
            </p>
          )}

          <p className="font-body text-xs text-muted-foreground my-4">— ou —</p>

          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            className="font-body text-sm gap-2"
          >
            <Upload className="h-4 w-4" />
            Importer une proposition existante
          </Button>
        </div>
      )}

      {flowStep === 'clarifying' && (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-primary" />
          <p className="font-body text-muted-foreground">Analyse des notes en cours...</p>
        </div>
      )}

      {flowStep === 'clarification_questions' && (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8">
          <h3 className="font-heading text-lg text-foreground mb-2">Quelques précisions avant de rédiger</h3>
          <p className="font-body text-sm text-muted-foreground mb-6">
            Il manque quelques infos pour rédiger une proposition complète. Réponds à ces questions :
          </p>
          <div className="space-y-4">
            {clarificationQuestions.map((q, i) => (
              <div key={i} className="border border-border rounded-lg p-4">
                <p className="font-body text-sm font-medium text-foreground mb-2">{q}</p>
                <Textarea
                  value={clarificationAnswers[i]}
                  onChange={(e) => {
                    const newAnswers = [...clarificationAnswers];
                    newAnswers[i] = e.target.value;
                    setClarificationAnswers(newAnswers);
                  }}
                  placeholder="Ta réponse..."
                  rows={2}
                  className="font-body text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-6 gap-3">
            <Button variant="outline" onClick={() => setFlowStep('ready_to_generate')} className="font-body">
              Passer cette étape
            </Button>
            <Button
              onClick={handleValidateClarification}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-body"
            >
              Valider et générer
            </Button>
          </div>
        </div>
      )}

      {/* === STEP 2: Ready to Generate === */}
      {(flowStep === 'ready_to_generate') && (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8">
          <h3 className="font-heading text-lg text-foreground mb-4">Générer la proposition</h3>
          <div className="flex items-center gap-3 mb-6">
            <Switch
              id="tutoiement-toggle"
              checked={tutoiement}
              onCheckedChange={setTutoiement}
            />
            <Label htmlFor="tutoiement-toggle" className="font-body text-sm">
              {tutoiement ? 'Tutoiement' : 'Vouvoiement'}
            </Label>
          </div>
          <Button
            onClick={handleGenerate}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-body text-base px-8 py-3 h-auto"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Générer la proposition
          </Button>
        </div>
      )}

      {flowStep === 'generating' && (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="font-heading text-base text-foreground mb-2">Rédaction en cours...</p>
          <p className="font-body text-sm text-muted-foreground">
            La proposition est générée avec soin, ça peut prendre jusqu'à 2 minutes.
          </p>
        </div>
      )}

      {/* === STEP 3: Proposal Content (Editable) === */}
      {hasContent && (
        <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-lg text-foreground">Proposition</h2>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
                className="gap-2 font-body"
              >
                <RefreshCw className="h-4 w-4" />
                Remplacer
              </Button>
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
                disabled={generatingWord || sections.length === 0}
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
              <Button
                variant="outline"
                onClick={() => {
                  const md = `# Proposition — ${clientName}\n\n` +
                    sections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n');
                  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                  const date = new Date().toISOString().slice(0, 10);
                  const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '_');
                  saveAs(blob, `Proposition_${safeName}_${date}.md`);
                  toast.success('Export Markdown téléchargé !');
                }}
                disabled={sections.length === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Exporter en .md
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {sections.map((section, idx) => (
              <div
                key={idx}
                className="border-l-4 border-primary bg-card rounded-r-lg p-4 group/section relative"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    {section.title}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerateSection(idx)}
                    disabled={regeneratingIdx === idx}
                    className="opacity-0 group-hover/section:opacity-100 transition-opacity h-7 px-2 text-xs font-body text-muted-foreground"
                  >
                    {regeneratingIdx === idx ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Régénérer
                  </Button>
                </div>
                {editingIndex === idx ? (
                  <Textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleBlurEdit(idx)}
                    rows={8}
                    className="font-body text-sm"
                    autoFocus
                  />
                ) : (
                  <p
                    onClick={() => handleStartEdit(idx)}
                    className="font-body text-sm text-muted-foreground whitespace-pre-wrap cursor-text hover:bg-secondary/50 rounded p-1 -m-1 transition-colors"
                  >
                    {section.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Email draft === */}
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

      <ImportProposalDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        missionId={missionId}
        missionType={missionType}
        proposalId={proposal?.id}
        onImportDone={() => {
          refetchProposal();
          queryClient.invalidateQueries({ queryKey: ['proposal', missionId] });
          setFlowStep('done');
        }}
      />
    </div>
  );
}
