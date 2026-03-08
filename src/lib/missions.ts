import { Tables } from '@/integrations/supabase/types';

export type Mission = Tables<'missions'>;

export const PIPELINE_COLUMNS = [
  { id: 'discovery_call', label: 'Appel découverte' },
  { id: 'proposal_drafting', label: 'Proposition en cours' },
  { id: 'proposal_sent', label: 'Proposition envoyée' },
  { id: 'signed', label: 'Signée' },
  { id: 'active', label: 'En cours' },
  { id: 'completed', label: 'Terminée' },
  { id: 'lost', label: 'Perdue' },
] as const;

export type PipelineStatus = typeof PIPELINE_COLUMNS[number]['id'];

const STATUS_ORDER: Record<string, number> = {
  discovery_call: 0,
  proposal_drafting: 1,
  proposal_sent: 2,
  signed: 3,
  active: 4,
  completed: 5,
  lost: 6,
};

export function statusIndex(status: string): number {
  return STATUS_ORDER[status] ?? 0;
}

export function statusLabel(status: string): string {
  return PIPELINE_COLUMNS.find((c) => c.id === status)?.label ?? status;
}

export function statusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'discovery_call': return { bg: 'bg-secondary', text: 'text-secondary-foreground' };
    case 'proposal_drafting': return { bg: 'bg-accent', text: 'text-accent-foreground' };
    case 'proposal_sent': return { bg: 'bg-badge-rose/20', text: 'text-badge-rose' };
    case 'signed': return { bg: 'bg-badge-bordeaux/20', text: 'text-badge-bordeaux' };
    case 'active': return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
    case 'completed': return { bg: 'bg-muted', text: 'text-muted-foreground' };
    case 'lost': return { bg: 'bg-muted', text: 'text-muted-foreground' };
    default: return { bg: 'bg-muted', text: 'text-muted-foreground' };
  }
}

export function formatMissionType(type: string) {
  switch (type) {
    case 'binome': return 'Binôme';
    case 'agency': return 'Agency';
    default: return 'Non déterminé';
  }
}

export function formatAmount(amount: number | null): string | null {
  if (amount == null) return null;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  if (diffDays < 30) return `il y a ${diffDays} jours`;
  if (diffDays < 365) return `il y a ${Math.floor(diffDays / 30)} mois`;
  return `il y a ${Math.floor(diffDays / 365)} ans`;
}

export function getDaysSince(dateStr: string): number {
  const now = new Date();
  const date = new Date(dateStr);
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}
