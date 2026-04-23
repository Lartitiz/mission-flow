import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Copy, ChevronDown, ChevronRight, Download, Loader2, AlertTriangle, Info, AlertCircle, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { saveAs } from 'file-saver';

interface PromptChainItem {
  order: number;
  phase: 'K' | 'A' | 'B' | 'C';
  title: string;
  prompt: string;
  output_format: string;
  depends_on: number | null;
  is_pause: boolean;
}

interface Warning {
  type: 'missing_info' | 'overscope' | 'dependency' | 'inconsistency';
  message: string;
}

interface ClaudeProjectData {
  prompt_system: string;
  prompt_chain: PromptChainItem[];
  warnings: Warning[];
}

interface ClaudeProjectExportProps {
  missionId: string;
  clientName: string;
}

const PHASE_COLORS: Record<string, string> = {
  K: 'bg-rose-100 text-rose-800',
  A: 'bg-blue-100 text-blue-800',
  B: 'bg-purple-100 text-purple-800',
  C: 'bg-green-100 text-green-800',
};

const PHASE_LABELS: Record<string, string> = {
  K: 'Kick-off',
  A: 'Recherche',
  B: 'Stratégie',
  C: 'Production',
};

const WARNING_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; label: string }> = {
  missing_info: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-800', label: 'Info manquante' },
  overscope: { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: 'Surproduction' },
  dependency: { icon: Link2, color: 'bg-blue-100 text-blue-800', label: 'Dépendance' },
  inconsistency: { icon: Info, color: 'bg-orange-100 text-orange-800', label: 'Incohérence' },
};

export function ClaudeProjectExport({ missionId, clientName }: ClaudeProjectExportProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRetryingC, setIsRetryingC] = useState(false);
  const [data, setData] = useState<ClaudeProjectData | null>(null);
  const [step, setStep] = useState<'idle' | 'system' | 'phase_k' | 'phase_a' | 'phase_b' | 'phase_c'>('idle');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ system: true, chain: true, warnings: true });
  const [completedPrompts, setCompletedPrompts] = useState<number[]>([]);
  const [lastGenContext, setLastGenContext] = useState<{ context_summary: string; prompt_system: string } | null>(null);

  const { data: savedProject, refetch: refetchProject } = useQuery({
    queryKey: ['claude-project', missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claude_projects' as any)
        .select('*')
        .eq('mission_id', missionId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (savedProject && !data) {
      setData({
        prompt_system: savedProject.prompt_system,
        prompt_chain: savedProject.prompt_chain as unknown as PromptChainItem[],
        warnings: savedProject.warnings as unknown as Warning[],
      });
      const completed = (savedProject as any).completed_prompts;
      if (Array.isArray(completed)) {
        setCompletedPrompts(completed);
      }
    }
  }, [savedProject]);

  const { data: readiness } = useQuery({
    queryKey: ['claude-project-readiness', missionId],
    queryFn: async () => {
      const [proposalRes, kickoffRes] = await Promise.all([
        supabase.from('proposals').select('id').eq('mission_id', missionId).limit(1).maybeSingle(),
        supabase.from('kickoffs').select('id, structured_notes').eq('mission_id', missionId).maybeSingle(),
      ]);
      return {
        hasProposal: !!proposalRes.data,
        hasKickoff: !!kickoffRes.data,
        hasStructuredKickoff: !!kickoffRes.data?.structured_notes,
      };
    },
  });

  const canGenerate = readiness?.hasProposal || readiness?.hasStructuredKickoff;

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copié ✓` });
  };

  const togglePromptComplete = async (order: number) => {
    const updated = completedPrompts.includes(order)
      ? completedPrompts.filter(o => o !== order)
      : [...completedPrompts, order];
    setCompletedPrompts(updated);

    if (savedProject?.id) {
      await supabase
        .from('claude_projects' as any)
        .update({ completed_prompts: updated } as any)
        .eq('id', savedProject.id);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setData(null);
    try {
      // Step 1: Generate prompt system
      setStep('system');
      const { data: step1, error: err1 } = await supabase.functions.invoke('generate-claude-project', {
        body: { mission_id: missionId },
      });
      if (err1 || step1?.error) {
        toast({ title: 'Erreur', description: step1?.error || "Échec du prompt système.", variant: 'destructive' });
        return;
      }

      const allPrompts: PromptChainItem[] = [];
      const allWarnings: Warning[] = [];
      let orderOffset = 0;
      setLastGenContext({ context_summary: step1.context_summary, prompt_system: step1.prompt_system });

      // Step 2: Phase A (Recherche)
      setStep('phase_a');
      const { data: phaseA, error: errA } = await supabase.functions.invoke('generate-claude-project-chain', {
        body: { context_summary: step1.context_summary, prompt_system: step1.prompt_system, phase: 'A', previous_prompts: [] },
      });
      if (!errA && !phaseA?.error && phaseA?.prompts) {
        const mapped = phaseA.prompts.map((p: any, i: number) => ({ ...p, order: orderOffset + i + 1, phase: 'A' as const }));
        allPrompts.push(...mapped);
        orderOffset += mapped.length;
        if (phaseA.warnings) allWarnings.push(...phaseA.warnings);
      }

      // Step 3: Phase B (Stratégie)
      setStep('phase_b');
      const { data: phaseB, error: errB } = await supabase.functions.invoke('generate-claude-project-chain', {
        body: { context_summary: step1.context_summary, prompt_system: step1.prompt_system, phase: 'B', previous_prompts: allPrompts.map(p => ({ order: p.order, phase: p.phase, title: p.title, output_format: p.output_format })) },
      });
      if (!errB && !phaseB?.error && phaseB?.prompts) {
        const mapped = phaseB.prompts.map((p: any, i: number) => ({ ...p, order: orderOffset + i + 1, phase: 'B' as const }));
        allPrompts.push(...mapped);
        orderOffset += mapped.length;
        if (phaseB.warnings) allWarnings.push(...phaseB.warnings);
      }

      // Step 4: Phase C (Production) — avec retry automatique
      setStep('phase_c');
      let phaseC = null;
      let phaseCError = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: result, error: err } = await supabase.functions.invoke('generate-claude-project-chain', {
          body: {
            context_summary: step1.context_summary,
            prompt_system: step1.prompt_system,
            phase: 'C',
            previous_prompts: allPrompts.map(p => ({
              order: p.order,
              phase: p.phase,
              title: p.title,
              output_format: p.output_format,
            })),
          },
        });
        if (!err && !result?.error && result?.prompts) {
          phaseC = result;
          break;
        }
        phaseCError = result?.error || err?.message;
        if (attempt === 0) {
          console.warn('Phase C attempt 1 failed, retrying...', phaseCError);
        }
      }

      if (phaseC?.prompts) {
        const mapped = phaseC.prompts.map((p: any, i: number) => ({
          ...p,
          order: orderOffset + i + 1,
          phase: 'C' as const,
        }));
        allPrompts.push(...mapped);
        if (phaseC.warnings) allWarnings.push(...phaseC.warnings);
      } else {
        allWarnings.push({
          type: 'dependency' as const,
          message: 'La phase C (Production) n\'a pas pu être générée après 2 tentatives. Tu peux la relancer séparément ou rédiger les prompts de production manuellement à partir du prompt système.',
        });
      }

      const newData = {
        prompt_system: step1.prompt_system,
        prompt_chain: allPrompts,
        warnings: allWarnings,
      };
      setData(newData);
      setCompletedPrompts([]);

      // Save to database
      try {
        if (savedProject?.id) {
          await supabase
            .from('claude_projects' as any)
            .update({
              prompt_system: newData.prompt_system,
              prompt_chain: newData.prompt_chain as any,
              warnings: newData.warnings as any,
              completed_prompts: [] as any,
              version: ((savedProject as any).version || 1) + 1,
            } as any)
            .eq('id', savedProject.id);
        } else {
          await supabase
            .from('claude_projects' as any)
            .insert({
              mission_id: missionId,
              prompt_system: newData.prompt_system,
              prompt_chain: newData.prompt_chain as any,
              warnings: newData.warnings as any,
              completed_prompts: [] as any,
            } as any);
        }
        refetchProject();
      } catch (saveErr) {
        console.error('Failed to save claude project:', saveErr);
      }

      if (allPrompts.length > 0) {
        toast({ title: 'Kit projet Claude généré ✓', description: allPrompts.length + ' prompts en ' + new Set(allPrompts.map(p => p.phase)).size + ' phases.' });
      } else {
        toast({ title: 'Prompt système généré', description: 'Les phases n\'ont pas pu être générées. Le prompt système est disponible.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erreur', description: "Erreur inattendue.", variant: 'destructive' });
    } finally {
      setIsGenerating(false);
      setStep('idle');
    }
  };

  const handleRetryPhaseC = async () => {
    if (!data) return;
    setIsRetryingC(true);
    try {
      let ctx = lastGenContext;

      // If no context cached (page was reloaded), regenerate it
      if (!ctx) {
        const { data: step1, error: err1 } = await supabase.functions.invoke('generate-claude-project', {
          body: { mission_id: missionId },
        });
        if (err1 || step1?.error || !step1?.context_summary) {
          toast({ title: 'Erreur', description: 'Impossible de récupérer le contexte. Regénère le kit complet.', variant: 'destructive' });
          return;
        }
        ctx = { context_summary: step1.context_summary, prompt_system: step1.prompt_system };
        setLastGenContext(ctx);
      }

      const existingNonC = data.prompt_chain.filter(p => p.phase !== 'C');
      const orderOffset = existingNonC.length;

      const { data: phaseC, error: errC } = await supabase.functions.invoke('generate-claude-project-chain', {
        body: {
          context_summary: ctx.context_summary,
          prompt_system: ctx.prompt_system,
          phase: 'C',
          previous_prompts: existingNonC.map(p => ({ order: p.order, phase: p.phase, title: p.title, output_format: p.output_format })),
        },
      });

      if (errC || phaseC?.error || !phaseC?.prompts) {
        toast({ title: 'Erreur', description: phaseC?.error || 'La phase C a encore échoué. Réessaie dans quelques instants.', variant: 'destructive' });
        return;
      }

      const mapped = phaseC.prompts.map((p: any, i: number) => ({ ...p, order: orderOffset + i + 1, phase: 'C' as const }));
      const newWarnings = data.warnings.filter(w => !w.message.includes('phase C'));
      if (phaseC.warnings) newWarnings.push(...phaseC.warnings);

      const newData = { ...data, prompt_chain: [...existingNonC, ...mapped], warnings: newWarnings };
      setData(newData);

      if (savedProject?.id) {
        await supabase.from('claude_projects' as any).update({
          prompt_chain: newData.prompt_chain as any,
          warnings: newData.warnings as any,
        } as any).eq('id', savedProject.id);
        refetchProject();
      }

      toast({ title: 'Phase C générée ✓', description: `${mapped.length} prompts de production ajoutés.` });
    } catch {
      toast({ title: 'Erreur', description: 'Erreur inattendue.', variant: 'destructive' });
    } finally {
      setIsRetryingC(false);
    }
  };

  const exportFullMd = () => {
    if (!data) return;
    let md = `# Kit projet Claude — ${clientName}\n\n`;
    md += `---\n\n`;
    md += `## Prompt système\n\n${data.prompt_system}\n\n`;
    md += `---\n\n`;
    md += `## Prompt chain\n\n`;
    md += `> Ce plan évolue au terrain. Si un besoin non prévu émerge, on le signale et on adapte.\n\n`;
    data.prompt_chain.forEach((item) => {
      md += `### ${item.order}. [Phase ${item.phase}] ${item.title}${item.is_pause ? ' ⏸️ PAUSE STRATÉGIQUE' : ''}\n\n`;
      md += `Format de sortie : ${item.output_format}\n`;
      if (item.depends_on) md += `Dépend de : étape ${item.depends_on}\n`;
      md += `\n${item.prompt}\n\n---\n\n`;
    });
    if (data.warnings.length > 0) {
      md += `## Alertes\n\n`;
      data.warnings.forEach((w) => {
        md += `- **[${w.type}]** ${w.message}\n`;
      });
    }
    saveAs(new Blob([md], { type: 'text/markdown' }), `Kit_Claude_${clientName.replace(/\s+/g, '_')}.md`);
    toast({ title: 'Export .md téléchargé ✓' });
  };

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-base font-medium text-foreground">Kit projet Claude</h3>
          {savedProject && (
            <p className="font-body text-xs text-muted-foreground">
              Version {(savedProject as any).version} — généré le {new Date((savedProject as any).updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        {data && (
          <Button variant="outline" size="sm" onClick={exportFullMd} className="font-body gap-2">
            <Download className="h-3.5 w-3.5" />
            Exporter en .md
          </Button>
        )}
      </div>

      {!data && !isGenerating && (
        <div className="space-y-3">
          {!canGenerate && readiness && (
            <p className="font-body text-sm text-muted-foreground bg-muted rounded-lg p-3">
              Il faut au minimum une proposition commerciale ou un kick-off structuré pour générer le kit.
            </p>
          )}
          <Button onClick={handleGenerate} disabled={!canGenerate} className="font-body gap-2">
            <Sparkles className="h-4 w-4" />
            Générer le kit projet Claude
          </Button>
        </div>
      )}

      {isGenerating && (
        <div className="flex items-center gap-3 py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="font-body text-sm text-muted-foreground">
            {step === 'system' && 'Génération du prompt système...'}
            {step === 'phase_a' && 'Phase A : prompts de recherche...'}
            {step === 'phase_b' && 'Phase B : prompts stratégiques...'}
            {step === 'phase_c' && 'Phase C : prompts de production (le plus long)...'}
          </span>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {/* Prompt système */}
          <Collapsible open={openSections.system} onOpenChange={() => toggleSection('system')}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 font-heading text-sm font-medium text-foreground hover:text-primary transition-colors">
                {openSections.system ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Prompt système
              </CollapsibleTrigger>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(data.prompt_system, 'Prompt système')} className="font-body gap-1.5 h-7 text-xs">
                <Copy className="h-3 w-3" />
                Copier
              </Button>
            </div>
            <CollapsibleContent>
              <pre className="mt-2 p-4 bg-muted rounded-lg text-xs font-body whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                {data.prompt_system}
              </pre>
            </CollapsibleContent>
          </Collapsible>

          {/* Prompt chain */}
          <Collapsible open={openSections.chain} onOpenChange={() => toggleSection('chain')}>
            <div className="flex items-center justify-between">
              <CollapsibleTrigger className="flex items-center gap-2 font-heading text-sm font-medium text-foreground hover:text-primary transition-colors">
                {openSections.chain ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Prompt chain ({data.prompt_chain.length} étapes)
                {completedPrompts.length > 0 && (
                  <span className="font-body text-xs text-muted-foreground ml-2">
                    — {completedPrompts.length}/{data.prompt_chain.length} terminés
                  </span>
                )}
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const fullChain = data.prompt_chain
                    .map(item => `--- ÉTAPE ${item.order} [Phase ${item.phase}] : ${item.title} (${item.output_format}) ---\n\n${item.prompt}`)
                    .join('\n\n');
                  copyToClipboard(fullChain, 'Chaîne complète');
                }}
                className="font-body gap-1.5 h-7 text-xs"
              >
                <Copy className="h-3 w-3" />
                Copier toute la chaîne
              </Button>
            </div>
            <CollapsibleContent>
              <div className="mt-2 space-y-2">
                {data.prompt_chain.map((item) => (
                  <div key={item.order} className={`border rounded-lg p-3 transition-opacity ${completedPrompts.includes(item.order) ? 'bg-muted/50 opacity-60' : 'bg-background'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="checkbox"
                          checked={completedPrompts.includes(item.order)}
                          onChange={() => togglePromptComplete(item.order)}
                          className="h-4 w-4 rounded border-gray-300 cursor-pointer accent-primary shrink-0"
                        />
                        <span className="font-body text-xs font-bold text-muted-foreground">
                          #{item.order}
                        </span>
                        <Badge className={`text-[10px] font-semibold ${PHASE_COLORS[item.phase] || 'bg-muted text-muted-foreground'}`}>
                          {PHASE_LABELS[item.phase] || item.phase}
                        </Badge>
                        <span className="font-body text-sm font-medium text-foreground">
                          {item.title}
                        </span>
                        {item.is_pause && (
                          <Badge className="text-[10px] font-semibold bg-orange-100 text-orange-800">
                            ⏸ Pause stratégique
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {item.output_format}
                        </Badge>
                        {item.depends_on && (
                          <span className="text-[10px] text-muted-foreground font-body">
                            dépend de #{item.depends_on}
                          </span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(item.prompt, `Prompt #${item.order}`)} className="font-body gap-1.5 h-7 text-xs shrink-0">
                        <Copy className="h-3 w-3" />
                        Copier
                      </Button>
                    </div>
                    <pre className="p-3 bg-muted rounded text-xs font-body whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                      {item.prompt}
                    </pre>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <Collapsible open={openSections.warnings} onOpenChange={() => toggleSection('warnings')}>
              <CollapsibleTrigger className="flex items-center gap-2 font-heading text-sm font-medium text-foreground hover:text-primary transition-colors">
                {openSections.warnings ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Alertes ({data.warnings.length})
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-2">
                  {data.warnings.map((w, i) => {
                    const config = WARNING_CONFIG[w.type] || WARNING_CONFIG.missing_info;
                    const Icon = config.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 border rounded-lg bg-background">
                        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1">
                          <Badge className={`text-[10px] font-semibold mb-1 ${config.color}`}>
                            {config.label}
                          </Badge>
                          <p className="font-body text-sm text-foreground">{w.message}</p>
                          {w.message.includes('phase C') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRetryPhaseC}
                              disabled={isRetryingC}
                              className="font-body gap-2 mt-2"
                            >
                              {isRetryingC ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Génération phase C...</>
                              ) : (
                                <><Sparkles className="h-3.5 w-3.5" />Relancer la phase C</>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Regenerate */}
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating} className="font-body gap-2">
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Regénérer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
