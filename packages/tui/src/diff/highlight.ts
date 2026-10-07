import { highlightCode } from '@reviewer/core/themes';
import type { CodeToken, loadTheme } from '@reviewer/core/themes';
import type { HighlightReply, HighlightRequest } from './highlightWorker';
import type { FileDiff } from './parseDiff';

export type Theme = Awaited<NonNullable<ReturnType<typeof loadTheme>>>;
export type LineTokens = CodeToken[];
/** Tokens per hunk line, keyed by `lineKey`. */
export type FileTokens = Map<string, LineTokens>;

/**
 * `build:bin` bundles the worker as a second entry point; inside the binary
 * it is addressed relative to the entry's folder (`src/`), not this module.
 */
const WORKER_URL = import.meta.url.includes('$bunfs')
  ? './diff/highlightWorker.ts'
  : new URL('./highlightWorker.ts', import.meta.url).href;

/** Sides past this are left plain rather than stall the UI. */
const MAX_SIDE_CHARS = 200_000;

const BY_NAME: Record<string, string> = {
  dockerfile: 'docker',
  makefile: 'make',
  'cmakelists.txt': 'cmake',
  gemfile: 'ruby',
  rakefile: 'ruby',
  podfile: 'ruby',
  '.gitignore': 'ignore',
  '.npmrc': 'ini',
};

const BY_EXTENSION: Record<string, string> = {
  mjs: 'js',
  cjs: 'js',
  mts: 'ts',
  cts: 'ts',
  h: 'c',
  hpp: 'cpp',
  cc: 'cpp',
  yml: 'yaml',
  lock: 'yaml',
  sh: 'bash',
  zsh: 'bash',
  kt: 'kotlin',
  rs: 'rust',
  rb: 'ruby',
  py: 'python',
  md: 'markdown',
  txt: 'text',
};

export function languageFor(path: string): string {
  const name = path.split('/').at(-1)?.toLowerCase() ?? '';
  if (BY_NAME[name]) return BY_NAME[name];
  if (name.startsWith('.env')) return 'dotenv';
  const extension = name.includes('.') ? name.split('.').at(-1)! : '';
  return BY_EXTENSION[extension] ?? extension;
}

/**
 * Highlights a file's old and new sides as whole texts (so the grammar sees
 * surrounding code), then maps each hunk line back to its side's row.
 */
export async function highlightFile(
  file: FileDiff,
  theme: Theme,
  themeName: string,
): Promise<FileTokens> {
  const language = languageFor(file.path);
  const oldSide: string[] = [];
  const newSide: string[] = [];
  const where: Array<[key: string, side: 'old' | 'new', row: number]> = [];

  file.hunks.forEach((hunk, h) => {
    hunk.lines.forEach((line, l) => {
      const key = `${h}:${l}`;
      if (line.kind === 'del') {
        where.push([key, 'old', oldSide.length]);
        oldSide.push(line.text);
        return;
      }
      where.push([key, 'new', newSide.length]);
      newSide.push(line.text);
      if (line.kind === 'context') oldSide.push(line.text);
    });
  });

  const [oldTokens, newTokens] = await Promise.all([
    highlightSide(oldSide, language, theme, themeName),
    highlightSide(newSide, language, theme, themeName),
  ]);
  const tokens: FileTokens = new Map();
  for (const [key, side, row] of where) {
    const line = (side === 'old' ? oldTokens : newTokens)[row];
    if (line) tokens.set(key, line);
  }
  return tokens;
}

const cache = new Map<string, Promise<LineTokens[]>>();

function highlightSide(
  lines: string[],
  language: string,
  theme: Theme,
  themeName: string,
): Promise<LineTokens[]> {
  if (lines.length === 0) return Promise.resolve([]);
  const text = lines.join('\n');
  const key = `${themeName}\0${language}\0${Bun.hash(text)}`;
  let pending = cache.get(key);
  if (!pending) {
    pending =
      text.length > MAX_SIDE_CHARS
        ? Promise.resolve([])
        : tokenize(text, language, theme, themeName);
    cache.set(key, pending);
  }
  return pending;
}

interface Job {
  text: string;
  language: string;
  theme: Theme;
  resolve: (lines: LineTokens[]) => void;
}

let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, Job>();

/** In the highlight worker when there is one, so scrolling never waits on a grammar. */
function tokenize(
  text: string,
  language: string,
  theme: Theme,
  themeName: string,
): Promise<LineTokens[]> {
  return new Promise((resolve) => {
    const job = { text, language, theme, resolve };
    const thread = highlightWorker();
    if (!thread) return void inline(job);
    const id = (nextId += 1);
    waiting.set(id, job);
    thread.postMessage({
      id,
      text,
      language,
      themeName,
    } satisfies HighlightRequest);
  });
}

function highlightWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(WORKER_URL);
    worker.onmessage = (event: MessageEvent<HighlightReply>) => {
      waiting.get(event.data.id)?.resolve(event.data.lines);
      waiting.delete(event.data.id);
    };
    worker.onerror = () => {
      worker = null;
      for (const job of waiting.values()) inline(job);
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

function inline(job: Job) {
  highlightCode(job.text, job.language, job.theme).then(
    (result) => job.resolve(result.lines.map((line) => [...line])),
    () => job.resolve([]),
  );
}
