/** Shared by browser client and Node bake script. Keep .mjs for dual import. */
export function canonicalKey(method, pathname, search) {
  const m = String(method || 'GET').toUpperCase();
  let path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  // Strip trailing slash except for root
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  const raw = String(search || '');
  const q = raw.startsWith('?') ? raw.slice(1) : raw;
  if (!q) return `${m} ${path}`;
  const params = new URLSearchParams(q);
  const keys = [...new Set([...params.keys()])].sort();
  const sorted = new URLSearchParams();
  for (const k of keys) {
    for (const v of params.getAll(k)) sorted.append(k, v);
  }
  return `${m} ${path}?${sorted.toString()}`;
}

/** Map a canonical key to a filesystem-safe filename stem. */
export function keyToFilename(key, ext = 'json') {
  const safe = String(key)
    .replace(/^GET\s+/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return `${safe || 'route'}.${ext}`;
}
