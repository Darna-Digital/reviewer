import * as React from 'react';
import { readFile } from '../git/files';
import type { FileContent } from '../git/files';
import { languageClient } from '../language/client';
import type {
  DefinitionResult,
  DocumentSymbol,
  Position,
  ReferencesResult,
} from '../language/client';
import { identifierAt } from '../language/identifier';
import type { Identifier } from '../language/identifier';
import { sourceIndex } from '../language/sourceIndex';
import { usageRows } from '../language/usageRows';
import type { UsageRow } from '../language/usageRows';
import type { Review } from './useReview';

/** A symbol in the code on screen: its file, 1-based line and shown text. */
export interface SymbolSpot {
  path: string;
  line: number;
  text: string;
  identifier: Identifier;
}

export type UsagesState =
  | { status: 'loading'; symbol: string }
  | { status: 'failed'; symbol: string; message: string }
  | {
      status: 'done';
      symbol: string;
      result: ReferencesResult;
      rows: UsageRow[];
    };

export interface HoverCard {
  /** Screen cell the card hangs from. */
  at: { x: number; y: number };
  symbol: string;
  contents: string;
}

const HOVER_DELAY_MS = 350;
const HOVER_CACHE_MS = 60_000;
const LINES_CACHE_MS = 2000;
const OUTLINE_CACHE_MS = 5000;

export type Symbols = ReturnType<typeof useSymbols>;

/**
 * Symbol features through the Reviewer server — definition, usages, hover
 * and a file's outline — with the state the panes draw: the usages tree and
 * its selection, the preview file, the hover card.
 */
export function useSymbols(review: Review) {
  const { root, notify } = review;
  const client = React.useMemo(() => languageClient(root), [root]);
  const [usages, setUsages] = React.useState<UsagesState | null>(null);
  const [selected, setSelected] = React.useState(0);
  const [preview, setPreview] = React.useState<{
    path: string;
    file: FileContent;
  } | null>(null);
  const [hover, setHover] = React.useState<HoverCard | null>(null);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverKey = React.useRef<string | null>(null);
  const hoverCache = React.useRef(
    new Map<string, { at: number; text: string }>(),
  );
  const lines = React.useRef(
    new Map<string, { at: number; lines: string[] }>(),
  );
  const lastSearch = React.useRef<SymbolSpot | null>(null);
  const outlines = React.useRef(
    new Map<string, { at: number; symbols: DocumentSymbol[] }>(),
  );

  const usageIndexes = React.useMemo(
    () =>
      usages?.status === 'done'
        ? usages.rows.flatMap((row, i) => (row.kind === 'usage' ? [i] : []))
        : [],
    [usages],
  );
  const selectedRow =
    usages?.status === 'done'
      ? usages.rows[usageIndexes[selected] ?? -1]
      : undefined;
  const selectedUsage =
    selectedRow?.kind === 'usage' ? selectedRow.reference : undefined;

  React.useEffect(() => {
    const path = selectedUsage?.location.path;
    if (!path) return setPreview(null);
    let cancelled = false;
    void readFile(root, path).then((file) => {
      if (!cancelled) setPreview({ path, file });
    });
    return () => {
      cancelled = true;
    };
  }, [root, selectedUsage?.location.path]);

  return {
    usages,
    usageIndexes,
    selected,
    selectedUsage,
    preview,
    hover,
    selectUsage: (index: number) =>
      setSelected(Math.max(0, Math.min(usageIndexes.length - 1, index))),
    stepUsage: (delta: number) =>
      setSelected((i) =>
        Math.max(0, Math.min(usageIndexes.length - 1, i + delta)),
      ),
    /** Selects the usage drawn on row `row` of the tree. */
    selectRow(row: number) {
      const index = usageIndexes.indexOf(row);
      if (index !== -1) setSelected(index);
    },

    spotAt,
    async definition(spot: SymbolSpot): Promise<DefinitionResult | null> {
      return guard(async () =>
        client.definition(spot.path, await positionOf(spot)),
      );
    },
    findUsages,
    /** Searches the last symbol again, e.g. after edits. */
    rerun: () => lastSearch.current && findUsages(lastSearch.current),
    /** The file's outline, kept a few seconds; `quiet` skips the error notice. */
    async outline(
      path: string,
      { quiet = false }: { quiet?: boolean } = {},
    ): Promise<DocumentSymbol[] | null> {
      const cached = outlines.current.get(path);
      if (cached && Date.now() - cached.at < OUTLINE_CACHE_MS)
        return cached.symbols;
      const result = quiet
        ? await client.symbols(path).catch(() => null)
        : await guard(() => client.symbols(path));
      if (!result) return null;
      outlines.current.set(path, { at: Date.now(), symbols: result.symbols });
      return result.symbols;
    },

    /** Shows the hover card for `spot` once the pointer has rested on it. */
    hoverAt(
      spot: SymbolSpot | null,
      at: { x: number; y: number },
      { now = false }: { now?: boolean } = {},
    ) {
      const key = spot
        ? `${spot.path}:${spot.line}:${spot.identifier.start}`
        : null;
      if (key === hoverKey.current) return;
      hoverKey.current = key;
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      setHover(null);
      if (!spot || !key) return;
      hoverTimer.current = setTimeout(
        async () => {
          const cached = hoverCache.current.get(key);
          let text =
            cached && Date.now() - cached.at < HOVER_CACHE_MS
              ? cached.text
              : null;
          if (text === null) {
            try {
              const result = await client.hover(
                spot.path,
                await positionOf(spot),
              );
              text = result.contents.trim();
              hoverCache.current.set(key, { at: Date.now(), text });
            } catch {
              return;
            }
          }
          if (hoverKey.current === key && text)
            setHover({ at, symbol: spot.identifier.name, contents: text });
        },
        now ? 0 : HOVER_DELAY_MS,
      );
    },
    hideHover() {
      hoverKey.current = null;
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      setHover(null);
    },
  };

  async function findUsages(spot: SymbolSpot) {
    lastSearch.current = spot;
    const symbol = spot.identifier.name;
    setUsages({ status: 'loading', symbol });
    setSelected(0);
    try {
      const result = await client.references(spot.path, await positionOf(spot));
      setUsages({ status: 'done', symbol, result, rows: usageRows(result) });
    } catch (error) {
      setUsages({ status: 'failed', symbol, message: messageOf(error) });
    }
  }

  /** The symbol under shown index `index` of `text`, line `line` of `path`. */
  function spotAt(
    path: string,
    line: number,
    text: string,
    index: number,
  ): SymbolSpot | null {
    const identifier = identifierAt(text, index);
    return identifier ? { path, line, text, identifier } : null;
  }

  /** The server's position: the file's own line, tabs and all, in UTF-16. */
  async function positionOf(spot: SymbolSpot): Promise<Position> {
    const raw = (await fileLines(spot.path))[spot.line - 1] ?? spot.text;
    return {
      line: spot.line - 1,
      character: sourceIndex(raw, spot.identifier.start),
    };
  }

  async function fileLines(path: string): Promise<string[]> {
    const cached = lines.current.get(path);
    if (cached && Date.now() - cached.at < LINES_CACHE_MS) return cached.lines;
    const file = await readFile(root, path);
    const next = file.text.split('\n');
    lines.current.set(path, { at: Date.now(), lines: next });
    return next;
  }

  async function guard<TResult>(
    run: () => Promise<TResult>,
  ): Promise<TResult | null> {
    try {
      return await run();
    } catch (error) {
      notify('error', messageOf(error));
      return null;
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
