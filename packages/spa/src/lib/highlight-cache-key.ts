/**
 * Identities for the shared Shiki worker pool's highlighted-AST cache.
 *
 * The pool caches nothing for a file or diff that arrives without a `cacheKey`,
 * so every mount re-highlights from scratch and paints plain text until the
 * worker answers. A file read gives us no revision to key on, so the key is a
 * hash of what was read — it has to change whenever the text does.
 */

// FNV-1a, paired with the length so a collision needs both to match.
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function contentCacheKey(text: string): string {
  return `${text.length}-${hash(text)}`;
}
