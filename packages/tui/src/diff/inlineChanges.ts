import type { FileDiff } from './parseDiff';

export interface Span {
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{N}_$]/u;
/** Past this share of the line, the change reads better as a rewrite. */
const REWRITE_SHARE = 0.7;

/** Position of a line within its file. */
export function lineKey(hunk: number, line: number): string {
  return `${hunk}:${line}`;
}

/**
 * The changed stretch of a removed/added pair: everything between their
 * common prefix and suffix, snapped outward to word edges.
 */
export function changedSpans(
  before: string,
  after: string,
): { del: Span; add: Span } | null {
  if (before === after) return null;
  const shortest = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shortest && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const del = {
    start: snapStart(before, prefix),
    end: snapEnd(before, before.length - suffix),
  };
  const add = {
    start: snapStart(after, prefix),
    end: snapEnd(after, after.length - suffix),
  };
  if (share(del, before) > REWRITE_SHARE && share(add, after) > REWRITE_SHARE) {
    return null;
  }
  return { del, add };
}

/**
 * Bands for every line in a change block, pairing each removal with the
 * addition at the same position, keyed by `lineKey`.
 */
export function inlineChanges(file: FileDiff): Map<string, Span> {
  const spans = new Map<string, Span>();
  file.hunks.forEach((hunk, h) => {
    const { lines } = hunk;
    let i = 0;
    while (i < lines.length) {
      if (lines[i]!.kind !== 'del') {
        i += 1;
        continue;
      }
      const dels: number[] = [];
      while (i < lines.length && lines[i]!.kind === 'del') dels.push(i++);
      const adds: number[] = [];
      while (i < lines.length && lines[i]!.kind === 'add') adds.push(i++);

      for (let p = 0; p < Math.min(dels.length, adds.length); p += 1) {
        const d = dels[p]!;
        const a = adds[p]!;
        const found = changedSpans(lines[d]!.text, lines[a]!.text);
        if (!found) continue;
        if (found.del.end > found.del.start)
          spans.set(lineKey(h, d), found.del);
        if (found.add.end > found.add.start)
          spans.set(lineKey(h, a), found.add);
      }
    }
  });
  return spans;
}

const cache = new WeakMap<FileDiff, Map<string, Span>>();

export function inlineChangesOf(file: FileDiff): Map<string, Span> {
  let spans = cache.get(file);
  if (!spans) {
    spans = inlineChanges(file);
    cache.set(file, spans);
  }
  return spans;
}

function share(span: Span, text: string): number {
  return text.trim().length === 0 ? 1 : (span.end - span.start) / text.length;
}

function snapStart(text: string, at: number): number {
  let i = at;
  while (i > 0 && WORD.test(text[i - 1]!) && WORD.test(text[i] ?? '')) i -= 1;
  return i;
}

function snapEnd(text: string, at: number): number {
  let i = at;
  while (
    i < text.length &&
    WORD.test(text[i]!) &&
    WORD.test(text[i - 1] ?? '')
  ) {
    i += 1;
  }
  return i;
}
