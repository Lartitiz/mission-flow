/**
 * Liens personnalisés de l'espace client.
 *
 * Format : /client/{slug}/{token}
 * Le slug (nom lisible) est purement cosmétique : seul le token UUID donne
 * accès à l'espace. Les anciens liens /client/{token} restent valides.
 */

export function slugifyClientSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function buildClientLink(
  token: string,
  slug?: string | null,
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const clean = slug ? slugifyClientSlug(slug) : '';
  return clean
    ? `${origin}/client/${clean}/${token}`
    : `${origin}/client/${token}`;
}
