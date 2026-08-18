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

/** UUID (36 car.) -> code court base64url (22 car.), même niveau de sécurité. */
export function encodeCompactToken(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32 || !/^[0-9a-f]{32}$/i.test(hex)) return uuid;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Code court base64url -> UUID. Renvoie la valeur telle quelle si déjà un UUID. */
export function decodeCompactToken(value: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
  if (!/^[A-Za-z0-9_-]{22}$/.test(value)) return value;
  try {
    const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '==');
    if (bin.length !== 16) return value;
    const hex = Array.from(bin, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return value;
  }
}

export function buildClientLink(
  token: string,
  slug?: string | null,
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const clean = slug ? slugifyClientSlug(slug) : '';
  const short = encodeCompactToken(token);
  return clean
    ? `${origin}/c/${clean}/${short}`
    : `${origin}/c/${short}`;
}

