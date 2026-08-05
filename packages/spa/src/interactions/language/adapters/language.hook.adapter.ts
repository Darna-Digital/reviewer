/**
 * Wires the real language API into the pure logic.
 *
 * Diagnostics and hover are queries: both are asked the same question over and
 * over — the same file as it re-renders, the same symbol as the pointer crosses
 * it — and both answer with something that only changes when the file does.
 *
 * Definition and references are one-shot fetches. They answer a click and move
 * the user somewhere, and a stale jump is worse than a slow one.
 */
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  applyTextEdits,
  type Diagnostic,
  type FileEdits,
  type Position,
} from "@byconvo/core/language";
import { api, fetchClient } from "@/lib/api/client";
import { createLanguageFunctions } from "../functions/language.functions";
import type { LanguageFunctions } from "../interfaces/language.interfaces";

/** How long diagnostics stay fresh; long enough to survive a scroll. */
const DIAGNOSTICS_STALE_MS = 10_000;

const fail = (error: unknown, fallback: string): never => {
  throw new Error((error as { reason?: string })?.reason ?? fallback);
};

/** Installed language providers and whether each can serve this repository. */
export const useLanguageProviders = () =>
  api.useQuery("get", "/api/language/providers", {}, { retry: false });

/**
 * Diagnostics for `path`. Pass `contents` to analyse an unsaved buffer instead
 * of what is on disk. Disabled when there is no file open.
 *
 * `ready` is what keeps the language server off the critical path. The first
 * request against a repository costs a whole TypeScript program — a second or
 * more — and firing it in the same commit as the view means the file competes
 * with it for the network and the main thread. The caller flips `ready` once
 * the code is on screen, so the text paints first and the squiggles arrive
 * after, which is the order an IDE does it in too.
 */
export const useDiagnostics = (
  path: string | null,
  contents?: string | null,
  ready = true
) =>
  api.useQuery(
    "post",
    "/api/language/diagnostics",
    {
      body: {
        path: path ?? "",
        ...(contents === null || contents === undefined ? {} : { contents }),
      },
    },
    {
      enabled: path !== null && ready,
      staleTime: DIAGNOSTICS_STALE_MS,
      // A repository without a provider is the normal case, not a problem to
      // retry; real failures show up in the providers list.
      retry: false,
    }
  );

const positionQuery = (path: string, position: Position) => ({
  params: {
    query: {
      path,
      line: String(position.line),
      character: String(position.character),
    },
  },
});

/** How long a symbol's documentation stays fresh. */
const HOVER_STALE_MS = 60_000;

/**
 * The language actions, bound to the real API. Each call carries its own path,
 * so only the diagnostics on screen are part of the identity.
 *
 * Hover goes through the query cache rather than straight to `fetch`. The
 * pointer crosses the same identifier constantly — moving away and back, or
 * along a line and returning — and each crossing was a round trip for an answer
 * that had not changed. Keyed by position, so the second look at a symbol is
 * instant, and two tokens resting under the pointer at once share one request
 * instead of racing.
 *
 * Definition and references stay uncached on purpose: they answer a click, they
 * move the user somewhere, and a stale jump is worse than a slow one.
 */
export const useLanguageActions = (
  diagnostics: ReadonlyArray<Diagnostic>
): LanguageFunctions => {
  const queryClient = useQueryClient();
  return useMemo(
    () =>
      createLanguageFunctions({
        data: { diagnostics },
        sideEffects: {
          definition: async (filePath, position) => {
            const { data, error } = await fetchClient.GET(
              "/api/language/definition",
              positionQuery(filePath, position)
            );
            if (error) return fail(error, "could not resolve the definition");
            return data;
          },
          references: async (filePath, position) => {
            const { data, error } = await fetchClient.GET(
              "/api/language/references",
              positionQuery(filePath, position)
            );
            if (error) return fail(error, "could not find usages");
            return data;
          },
          hover: (filePath, position) =>
            queryClient.fetchQuery({
              queryKey: [
                "language",
                "hover",
                filePath,
                position.line,
                position.character,
              ],
              queryFn: async () => {
                const { data, error } = await fetchClient.GET(
                  "/api/language/hover",
                  positionQuery(filePath, position)
                );
                if (error) return fail(error, "could not read the symbol");
                return data;
              },
              staleTime: HOVER_STALE_MS,
            }),
        },
      }),
    [diagnostics, queryClient]
  );
};

/** Completions at a caret, narrowed by what has been typed so far. */
export const requestCompletions = async (
  path: string,
  position: Position,
  prefix: string,
  contents: string | null
) => {
  const { data, error } = await fetchClient.POST("/api/language/completions", {
    body: {
      path,
      line: position.line,
      character: position.character,
      prefix,
      ...(contents === null ? {} : { contents }),
    },
  });
  if (error) return fail(error, "could not read completions");
  return data;
};

/** Documentation and any import edits for the item about to be accepted. */
export const resolveCompletion = async (
  path: string,
  position: Position,
  item: { label: string; source: string; data: string | null },
  contents: string | null
) => {
  const { data, error } = await fetchClient.POST(
    "/api/language/completion-resolve",
    {
      body: {
        path,
        line: position.line,
        character: position.character,
        label: item.label,
        source: item.source,
        data: item.data,
        ...(contents === null ? {} : { contents }),
      },
    }
  );
  if (error) return fail(error, "could not resolve the completion");
  return data;
};

/**
 * Forget what a file's symbols said. Its contents have moved on, so both the
 * answers and the positions they were keyed by are about a file that no longer
 * exists.
 */
export const forgetHovers = (queryClient: QueryClient, path: string): void => {
  queryClient.removeQueries({ queryKey: ["language", "hover", path] });
};

/** Quick fixes covering a range — import resolution among them. */
export const requestCodeActions = async (
  path: string,
  range: { start: Position; end: Position },
  contents: string | null
) => {
  const { data, error } = await fetchClient.POST("/api/language/code-actions", {
    body: {
      path,
      start: range.start,
      end: range.end,
      ...(contents === null ? {} : { contents }),
    },
  });
  if (error) return fail(error, "could not read quick fixes");
  return data;
};

/**
 * Apply edits to files other than the open one, which the editor cannot reach.
 * Read, edit, write — the same round trip the editor's own save makes.
 */
export const writeFileEdits = async (
  files: ReadonlyArray<FileEdits>
): Promise<void> => {
  for (const file of files) {
    const read = await fetchClient.GET("/api/file", {
      params: { query: { path: file.path } },
    });
    if (read.error || read.data === undefined) continue;
    const next = applyTextEdits(read.data.contents, file.edits);
    if (next === read.data.contents) continue;
    await fetchClient.PUT("/api/file", {
      body: { path: file.path, contents: next },
    });
  }
};
