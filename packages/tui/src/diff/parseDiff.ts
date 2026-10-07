import { printable } from '../text/measure';

export type LineKind = 'context' | 'add' | 'del';

export interface DiffLine {
  kind: LineKind;
  /** Tabs expanded, control characters made visible. */
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

export interface Hunk {
  oldStart: number;
  newStart: number;
  /** Whatever git printed after the second `@@` — usually the scope. */
  section: string;
  lines: DiffLine[];
}

export type FileStatus = 'added' | 'deleted' | 'modified' | 'renamed';

export interface FileDiff {
  /** Current path, or the old one for a deleted file. */
  path: string;
  /** Set for renames only. */
  oldPath: string | null;
  status: FileStatus;
  binary: boolean;
  hunks: Hunk[];
  additions: number;
  deletions: number;
  /** Why the content was left out, e.g. a file too large to read. */
  skipped?: string;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/;

const ESCAPES: Record<string, number> = {
  n: 10,
  t: 9,
  r: 13,
  a: 7,
  b: 8,
  f: 12,
  v: 11,
  '"': 34,
  '\\': 92,
};

/** Undoes git's C-style path quoting; octal escapes are UTF-8 bytes. */
export function unquotePath(raw: string): string {
  if (!raw.startsWith('"') || !raw.endsWith('"')) return raw;
  const body = raw.slice(1, -1);
  const encoder = new TextEncoder();
  const bytes: number[] = [];
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i]!;
    if (char !== '\\') {
      bytes.push(...encoder.encode(char));
      continue;
    }
    const next = body[i + 1] ?? '';
    if (/[0-7]/.test(next)) {
      bytes.push(parseInt(body.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(ESCAPES[next] ?? next.charCodeAt(0));
      i += 1;
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/**
 * Parses unified diff text. Paths come from `---`/`+++` (the `diff --git`
 * header is ambiguous once a name contains ` b/`) and fall back to the header
 * for changes with no content lines: renames, mode changes, binaries.
 */
export function parseDiff(text: string): FileDiff[] {
  const files: FileDiff[] = [];
  let draft: Draft | null = null;
  let hunk: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;

  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (draft) files.push(finish(draft));
      draft = createDraft(line);
      hunk = null;
      continue;
    }
    if (!draft) continue;

    const header = HUNK_HEADER.exec(line);
    if (header) {
      oldNo = Number(header[1]);
      newNo = Number(header[2]);
      hunk = {
        oldStart: oldNo,
        newStart: newNo,
        section: (header[3] ?? '').trim(),
        lines: [],
      };
      draft.hunks.push(hunk);
      continue;
    }

    if (hunk) {
      const marker = line[0];
      const body = printable(line.slice(1));
      if (marker === '+') {
        hunk.lines.push({
          kind: 'add',
          text: body,
          oldNo: null,
          newNo: newNo++,
        });
        continue;
      }
      if (marker === '-') {
        hunk.lines.push({
          kind: 'del',
          text: body,
          oldNo: oldNo++,
          newNo: null,
        });
        continue;
      }
      if (marker === ' ') {
        hunk.lines.push({
          kind: 'context',
          text: body,
          oldNo: oldNo++,
          newNo: newNo++,
        });
        continue;
      }
      // `\ No newline at end of file` annotates the previous line.
      if (marker === '\\') continue;
      hunk = null;
    }

    readMeta(draft, line);
  }
  if (draft) files.push(finish(draft));
  return files;
}

export function lineCount(file: FileDiff): number {
  return file.hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0);
}

interface Draft {
  header: string;
  oldPath: string | null;
  newPath: string | null;
  renameFrom: string | null;
  renameTo: string | null;
  isNew: boolean;
  isDeleted: boolean;
  binary: boolean;
  hunks: Hunk[];
}

function createDraft(header: string): Draft {
  return {
    header,
    oldPath: null,
    newPath: null,
    renameFrom: null,
    renameTo: null,
    isNew: false,
    isDeleted: false,
    binary: false,
    hunks: [],
  };
}

function readMeta(draft: Draft, line: string) {
  if (line.startsWith('--- ')) draft.oldPath = sidePath(line.slice(4));
  else if (line.startsWith('+++ ')) draft.newPath = sidePath(line.slice(4));
  else if (line.startsWith('rename from '))
    draft.renameFrom = unquotePath(line.slice(12));
  else if (line.startsWith('rename to '))
    draft.renameTo = unquotePath(line.slice(10));
  else if (line.startsWith('new file mode')) draft.isNew = true;
  else if (line.startsWith('deleted file mode')) draft.isDeleted = true;
  else if (line.startsWith('Binary files ') || line === 'GIT binary patch')
    draft.binary = true;
}

function finish(draft: Draft): FileDiff {
  const fallback = headerPath(draft.header);
  const before = draft.renameFrom ?? draft.oldPath;
  const after = draft.renameTo ?? draft.newPath;
  const renamed =
    draft.renameFrom !== null ||
    (before !== null && after !== null && before !== after);
  const status: FileStatus = draft.isNew
    ? 'added'
    : draft.isDeleted
      ? 'deleted'
      : renamed
        ? 'renamed'
        : 'modified';

  let additions = 0;
  let deletions = 0;
  for (const hunk of draft.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add') additions += 1;
      if (line.kind === 'del') deletions += 1;
    }
  }

  return {
    path:
      status === 'deleted'
        ? (before ?? fallback)
        : (after ?? before ?? fallback),
    oldPath: status === 'renamed' ? before : null,
    status,
    binary: draft.binary,
    hunks: draft.hunks,
    additions,
    deletions,
  };
}

/** `a/src/x.ts` → `src/x.ts`; `/dev/null` → `null`. */
function sidePath(raw: string): string | null {
  const path = unquotePath(raw.replace(/\t$/, ''));
  return path === '/dev/null' ? null : path.replace(/^[ab]\//, '');
}

/** Unambiguous whenever both sides name the same path (`a/P b/P`). */
function headerPath(header: string): string {
  const rest = header.slice('diff --git '.length);
  if (rest.startsWith('"')) {
    return sidePath(rest.slice(0, rest.indexOf('" ', 1) + 1)) ?? '';
  }
  const half = (rest.length - 1) / 2;
  if (Number.isInteger(half) && rest[half] === ' ') {
    return sidePath(rest.slice(0, half)) ?? '';
  }
  return sidePath(rest.split(' b/')[0] ?? rest) ?? '';
}
