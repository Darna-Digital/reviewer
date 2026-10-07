const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export const TAB_WIDTH = 4;

interface Grapheme {
  text: string;
  width: number;
}

function graphemes(text: string): Grapheme[] {
  return Array.from(segmenter.segment(text), ({ segment }) => ({
    text: segment,
    width: Bun.stringWidth(segment),
  }));
}

/** Terminal cells taken by `text`. ASCII takes a fast path. */
export function cellWidth(text: string): number {
  return PRINTABLE_ASCII.test(text) ? text.length : Bun.stringWidth(text);
}

/**
 * Expands tabs, drops `\r` and swaps other control characters for `·` so a
 * raw escape in a diff line is drawn instead of interpreted.
 */
export function printable(text: string): string {
  if (PRINTABLE_ASCII.test(text)) return text;
  let out = '';
  for (const char of text) {
    if (char === '\t') {
      out += ' '.repeat(TAB_WIDTH - (cellWidth(out) % TAB_WIDTH));
    } else if (char === '\r') {
      continue;
    } else {
      out += char < ' ' || char === '\x7f' ? '·' : char;
    }
  }
  return out;
}

/** Offsets where `text` must break to fit `width` cells per row. */
export function wrapPoints(text: string, width: number): number[] {
  if (width <= 0) return [];
  const points: number[] = [];
  if (PRINTABLE_ASCII.test(text)) {
    for (let at = width; at < text.length; at += width) points.push(at);
    return points;
  }
  let used = 0;
  let offset = 0;
  for (const g of graphemes(text)) {
    if (used + g.width > width && used > 0) {
      points.push(offset);
      used = 0;
    }
    used += g.width;
    offset += g.text.length;
  }
  return points;
}

/** Cuts to `width` cells, ending in `…` when anything was dropped. */
export function truncate(text: string, width: number): string {
  if (width <= 0) return '';
  if (cellWidth(text) <= width) return text;
  if (PRINTABLE_ASCII.test(text)) return `${text.slice(0, width - 1)}…`;
  let out = '';
  let used = 0;
  for (const g of graphemes(text)) {
    if (used + g.width > width - 1) break;
    out += g.text;
    used += g.width;
  }
  return `${out}${' '.repeat(width - 1 - used)}…`;
}

/** Cuts from the left — for paths, whose end is the part worth reading. */
export function truncateStart(text: string, width: number): string {
  if (width <= 0) return '';
  if (cellWidth(text) <= width) return text;
  const parts = graphemes(text);
  let out = '';
  let used = 0;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const g = parts[i]!;
    if (used + g.width > width - 1) break;
    out = g.text + out;
    used += g.width;
  }
  return `…${out}`;
}

export function padEnd(text: string, width: number): string {
  const cut = truncate(text, width);
  return cut + ' '.repeat(Math.max(0, width - cellWidth(cut)));
}

export function padStart(text: string, width: number): string {
  const cut = truncate(text, width);
  return ' '.repeat(Math.max(0, width - cellWidth(cut))) + cut;
}

/** Word-wraps prose; a word wider than `width` is broken where it must be. */
export function wrapProse(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    const paragraph = printable(raw.replace(/\t/g, '  '));
    if (paragraph.trim().length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      if (word.length === 0) continue;
      if (cellWidth(line + word) <= width) {
        line += word;
        continue;
      }
      if (line.trim().length > 0) lines.push(line.trimEnd());
      line = /^\s+$/.test(word) ? '' : word;
      while (cellWidth(line) > width) {
        const [first = line.length] = wrapPoints(line, width);
        lines.push(line.slice(0, first));
        line = line.slice(first);
      }
    }
    if (line.trim().length > 0) lines.push(line.trimEnd());
  }
  return lines;
}
