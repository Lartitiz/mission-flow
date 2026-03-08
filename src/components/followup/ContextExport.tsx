import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ContextExportProps {
  missionId: string;
  clientName: string;
}

async function fetchAllContext(missionId: string) {
  const [discovery, proposal, kickoff, actions, sessions, journal] = await Promise.all([
    supabase.from('discovery_calls').select('*').eq('mission_id', missionId).maybeSingle(),
    supabase.from('proposals').select('*').eq('mission_id', missionId).order('version', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('kickoffs').select('*').eq('mission_id', missionId).maybeSingle(),
    supabase.from('actions').select('*').eq('mission_id', missionId).order('sort_order'),
    supabase.from('sessions').select('*').eq('mission_id', missionId).order('session_date', { ascending: false }),
    supabase.from('journal_entries').select('*').eq('mission_id', missionId).order('entry_date', { ascending: false }),
  ]);
  return {
    discovery: discovery.data,
    proposal: proposal.data,
    kickoff: kickoff.data,
    actions: actions.data ?? [],
    sessions: sessions.data ?? [],
    journal: journal.data ?? [],
  };
}

function buildDiscoveryMd(d: any): string {
  if (!d) return '';
  let md = '# Appel découverte\n\n';
  const structured = d.structured_notes as { sections?: { title: string; content: string }[] } | null;
  if (structured?.sections) {
    structured.sections.forEach((s: any) => { md += `## ${s.title}\n\n${s.content}\n\n`; });
  }
  if (d.raw_notes) md += `## Notes brutes\n\n${d.raw_notes}\n\n`;
  return md;
}

function buildProposalMd(p: any): string {
  if (!p) return '';
  let md = '# Proposition commerciale\n\n';
  const content = p.content as { sections?: { title: string; content: string }[] } | null;
  if (content?.sections) {
    content.sections.forEach((s: any) => { md += `## ${s.title}\n\n${s.content}\n\n`; });
  }
  return md;
}

function buildKickoffMd(k: any): string {
  if (!k) return '';
  let md = '# Kick-off\n\n';
  const structured = k.structured_notes as { sections?: { title: string; content: string }[] } | null;
  if (structured?.sections) {
    structured.sections.forEach((s: any) => { md += `## ${s.title}\n\n${s.content}\n\n`; });
  } else if (k.raw_notes) {
    md += `${k.raw_notes}\n\n`;
  }
  return md;
}

function buildActionsMd(actions: any[]): string {
  if (actions.length === 0) return '';
  let md = "# Plan d'actions\n\n";
  const laetitia = actions.filter((a) => a.assignee === 'laetitia');
  const client = actions.filter((a) => a.assignee === 'client');
  if (laetitia.length) {
    md += '## Mes actions\n\n';
    laetitia.forEach((a) => { md += `- [${a.status}] ${a.task}${a.description ? ' — ' + a.description : ''}${a.target_date ? ' (cible: ' + a.target_date + ')' : ''}\n`; });
    md += '\n';
  }
  if (client.length) {
    md += '## Actions client·e\n\n';
    client.forEach((a) => { md += `- [${a.status}] ${a.task}${a.description ? ' — ' + a.description : ''}${a.target_date ? ' (cible: ' + a.target_date + ')' : ''}\n`; });
    md += '\n';
  }
  return md;
}

function buildSessionsMd(sessions: any[]): string {
  if (sessions.length === 0) return '';
  let md = '# Sessions\n\n';
  sessions.forEach((s) => {
    md += `## ${format(new Date(s.session_date), 'dd MMMM yyyy', { locale: fr })} (${s.session_type})\n\n`;
    const structured = s.structured_notes as { sections?: { title: string; content: string }[] } | null;
    if (structured?.sections) {
      structured.sections.forEach((sec: any) => { md += `### ${sec.title}\n\n${sec.content}\n\n`; });
    } else if (s.raw_notes) {
      md += `${s.raw_notes}\n\n`;
    }
  });
  return md;
}

function buildJournalMd(entries: any[]): string {
  if (entries.length === 0) return '';
  let md = '# Journal de bord\n\n';
  entries.forEach((e) => {
    md += `- **${e.entry_date}** [${e.source}] ${e.content}\n`;
  });
  md += '\n';
  return md;
}

export function ContextExport({ missionId, clientName }: ContextExportProps) {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const dateStr = format(new Date(), 'yyyy-MM-dd');

  const exportFull = async () => {
    setIsExporting(true);
    try {
      const ctx = await fetchAllContext(missionId);
      let md = `# Contexte complet — ${clientName}\n\n---\n\n`;
      md += buildDiscoveryMd(ctx.discovery);
      md += buildProposalMd(ctx.proposal);
      md += buildKickoffMd(ctx.kickoff);
      md += buildActionsMd(ctx.actions);
      md += buildSessionsMd(ctx.sessions);
      md += buildJournalMd(ctx.journal);
      saveAs(new Blob([md], { type: 'text/markdown' }), `Contexte_${clientName.replace(/\s+/g, '_')}_${dateStr}.md`);
      toast({ title: 'Export terminé' });
    } catch {
      toast({ title: 'Erreur', description: "Impossible d'exporter.", variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const exportSection = async (section: string) => {
    setIsExporting(true);
    try {
      const ctx = await fetchAllContext(missionId);
      let md = '';
      let filename = '';
      switch (section) {
        case 'discovery': md = buildDiscoveryMd(ctx.discovery); filename = 'Appel_decouverte'; break;
        case 'proposal': md = buildProposalMd(ctx.proposal); filename = 'Proposition'; break;
        case 'kickoff': md = buildKickoffMd(ctx.kickoff); filename = 'Kickoff'; break;
        case 'actions': md = buildActionsMd(ctx.actions); filename = 'Plan_actions'; break;
        case 'sessions': md = buildSessionsMd(ctx.sessions); filename = 'Sessions'; break;
        case 'journal': md = buildJournalMd(ctx.journal); filename = 'Journal'; break;
      }
      if (!md.trim()) {
        toast({ title: 'Section vide', description: 'Rien à exporter pour cette section.' });
        return;
      }
      saveAs(new Blob([md], { type: 'text/markdown' }), `${filename}_${clientName.replace(/\s+/g, '_')}_${dateStr}.md`);
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl shadow-[var(--card-shadow)] p-5 space-y-3">
      <h3 className="font-heading text-base font-medium text-foreground">Export contexte</h3>
      <div className="flex flex-wrap gap-3">
        <Button onClick={exportFull} disabled={isExporting} className="font-body gap-2">
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exporter le contexte complet (.md)
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isExporting} className="font-body gap-2">
              Exporter par section
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => exportSection('discovery')} className="font-body text-sm">Appel découverte</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportSection('proposal')} className="font-body text-sm">Proposition</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportSection('kickoff')} className="font-body text-sm">Kick-off</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportSection('actions')} className="font-body text-sm">Plan d'actions</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportSection('sessions')} className="font-body text-sm">Sessions</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportSection('journal')} className="font-body text-sm">Journal</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
