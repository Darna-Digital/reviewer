import { SERVER_PORT } from '../process/reviewerServer';

/**
 * The server's wire shapes (core's `language.schema.ts`), restated: importing
 * core's language feature would pull its sources into this package's stricter
 * type check.
 */
export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  path: string;
  range: Range;
}

export interface SymbolTarget {
  location: Location;
  name: string;
  kind: string;
  containerName: string;
  preview: string;
}

export interface DefinitionResult {
  providerId: string | null;
  origin: Range | null;
  targets: SymbolTarget[];
}

export type ReferenceKind =
  'definition' | 'import' | 'export' | 'write' | 'read';

export interface SymbolReference {
  location: Location;
  kind: ReferenceKind;
  preview: string;
  containerName: string;
  containerKind: string;
}

export interface ReferencesResult {
  providerId: string | null;
  origin: Range | null;
  symbol: string | null;
  declaration: SymbolTarget | null;
  references: SymbolReference[];
}

export interface HoverResult {
  providerId: string | null;
  range: Range | null;
  /** Markdown. */
  contents: string;
}

/** One entry of a file's outline, flattened parents-first. */
export interface DocumentSymbol {
  name: string;
  kind: string;
  containerName: string;
  range: Range;
  selectionRange: Range;
  depth: number;
}

export interface DocumentSymbolsResult {
  providerId: string | null;
  symbols: DocumentSymbol[];
}

export class LanguageRequestError extends Error {}

/**
 * The Reviewer server's language API — the same providers the Mac app asks
 * (TypeScript in-process, Ruby / PHP / Swift language servers). Positions
 * are 0-based lines and UTF-16 characters; `repo` points every request at
 * this repository whatever the server has open.
 */
export function languageClient(root: string) {
  let scoped: Promise<void> | null = null;
  return {
    definition: (path: string, at: Position) =>
      get<DefinitionResult>('definition', { path, ...where(at) }),
    references: (path: string, at: Position) =>
      get<ReferencesResult>('references', { path, ...where(at) }),
    hover: (path: string, at: Position) =>
      get<HoverResult>('hover', { path, ...where(at) }),
    symbols: (path: string) => get<DocumentSymbolsResult>('symbols', { path }),
  };

  async function get<TResult>(
    endpoint: string,
    query: Record<string, string>,
  ): Promise<TResult> {
    scoped ??= ensureScoped().catch((error: unknown) => {
      scoped = null;
      throw error;
    });
    await scoped;
    const params = new URLSearchParams({ ...query, repo: root });
    const response = await call(`/api/language/${endpoint}?${params}`);
    if (response.status === 404)
      throw new LanguageRequestError(
        'This Reviewer server is too old for this — update Reviewer',
      );
    const body = (await response.json().catch(() => null)) as
      (TResult & { reason?: string; _tag?: string }) | null;
    if (!response.ok || !body)
      throw new LanguageRequestError(
        body?.reason ??
          body?._tag ??
          `Language request failed (${response.status})`,
      );
    return body;
  }

  /**
   * A server from before `repo` would quietly answer for whatever project it
   * has open; such a server is only asked when that project is this one.
   */
  async function ensureScoped(): Promise<void> {
    const spec = await call('/api/openapi.json');
    if (spec.ok && (await spec.text()).includes('/api/language/symbols'))
      return;
    const open = (await (await call('/api/workspace')).json()) as {
      project?: string | null;
    };
    if (open.project === root) return;
    const name = open.project?.split('/').at(-1) ?? 'no project';
    throw new LanguageRequestError(
      `Reviewer server is on ${name} and too old to answer for this repo — restart it`,
    );
  }
}

async function call(path: string): Promise<Response> {
  try {
    return await fetch(`http://127.0.0.1:${SERVER_PORT}${path}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new LanguageRequestError(NOT_ANSWERING);
  }
}

const NOT_ANSWERING =
  'The Reviewer server is not answering — it starts with the TUI unless --no-server';

export type LanguageClient = ReturnType<typeof languageClient>;

/** A first request can wait for a language server to start and index. */
const REQUEST_TIMEOUT_MS = 30_000;

function where(at: Position): Record<string, string> {
  return { line: String(at.line), character: String(at.character) };
}
