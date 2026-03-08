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
