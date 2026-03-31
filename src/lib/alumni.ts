export type WarmthLevel = 'recent' | 'cooling' | 'cold';

export function getWarmthLevel(lastContactAt: string | null, updatedAt: string): WarmthLevel {
  const reference = lastContactAt || updatedAt;
  const daysSince = Math.floor((Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince <= 30) return 'recent';
  if (daysSince <= 90) return 'cooling';
  return 'cold';
}

export function getWarmthConfig(level: WarmthLevel) {
  switch (level) {
    case 'recent': return { color: 'bg-emerald-400', label: 'Contact récent', textColor: 'text-emerald-700' };
    case 'cooling': return { color: 'bg-amber-400', label: 'À relancer bientôt', textColor: 'text-amber-700' };
    case 'cold': return { color: 'bg-badge-rose', label: 'Pas de nouvelles depuis longtemps', textColor: 'text-badge-rose' };
  }
}

export function daysSinceContact(lastContactAt: string | null, updatedAt: string): string {
  const reference = lastContactAt || updatedAt;
  const days = Math.floor((Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} jours`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `il y a ${Math.floor(days / 365)} an${Math.floor(days / 365) > 1 ? 's' : ''}`;
}
