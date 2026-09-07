/**
 * The built-in TypeScript provider — diagnostics, go-to-definition, find-usages
 * and hover, served straight from the compiler's `LanguageService`.
 *
 * It speaks the same LSP-shaped port as an external language server but skips
 * the subprocess: the compiler runs in this process, so the program stays warm
 * between requests (see `ts-project.ts`) and a hover costs a lookup rather than
 * a round trip. Everything TypeScript-specific stops here — mapping to wire
 * types lives in `ts-mapping.ts`, and the rest of the system only sees the port.
 */
import * as Effect from "effect/Effect";
import type * as TS from "typescript";
import {
  LanguageError,
  type DocumentRequest,
  type LanguageProvider,
  type PositionRequest,
} from "@reviewer/core/ports/language-provider";
import {
  filterCompletions,
  identifierAt,
  offsetAt,
  positionAt,
  type CodeActionItem,
  type CompletionItem,
  type CompletionResolution,
  type CompletionResult,
  type DefinitionResult,
  type Diagnostic,
  type DiagnosticRelated,
  type FileEdits,
  type HoverResult,
  type Range,
  type ReferencesResult,
  type SymbolReference,
  type SymbolTarget,
} from "@reviewer/core/language";
import { loadTypeScript } from "./ts-module.ts";
import { projectFor, type TsProject } from "./ts-project.ts";
import { containerAt, usageKind, NO_CONTAINER } from "./ts-usages.ts";
import {
  completionKind,
  hoverMarkdown,
  referenceKind,
  spanPreview,
  spanToRange,
  toAbsolute,
  toDiagnostic,
  toFileEdits,
  toRepoRelative,
} from "./ts-mapping.ts";

export const TYPESCRIPT_PROVIDER_ID = "typescript";

/** What the compiler analyses. `.d.ts` files match `.ts`. */
const PATTERNS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
] as const;

const fail = (reason: string) =>
  new LanguageError({ providerId: TYPESCRIPT_PROVIDER_ID, reason });

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Empty results, used when no TypeScript is installed for the repository. */
const unsupported: {
  readonly diagnostics: ReadonlyArray<Diagnostic>;
  readonly definition: DefinitionResult;
  readonly references: ReferencesResult;
  readonly hover: HoverResult;
  readonly completions: CompletionResult;
  readonly resolution: CompletionResolution;
  readonly codeActions: ReadonlyArray<CodeActionItem>;
} = {
  diagnostics: [],
  definition: { providerId: null, origin: null, targets: [] },
  references: {
    providerId: null,
    origin: null,
    symbol: null,
    declaration: null,
    references: [],
  },
  hover: { providerId: null, range: null, contents: "" },
  completions: {
    providerId: null,
    replace: null,
    items: [],
    incomplete: false,
  },
  resolution: { detail: "", documentation: "", additionalEdits: [] },
  codeActions: [],
};

interface OpenDocument {
  readonly project: TsProject;
  readonly ts: TsProject["ts"];
  readonly service: TS.LanguageService;
  readonly fileName: string;
  readonly text: string;
}

/**
 * Attach the request's document to its project. Returns null when the
 * repository has no TypeScript — the caller answers "unsupported", which the
 * UI renders as no analysis rather than as an error.
 */
const open = (request: DocumentRequest): OpenDocument | null => {
  const fileName = toAbsolute(request.root, request.path);
  const project = projectFor(request.root, fileName);
  if (project === null) return null;
  project.openFile(fileName, request.contents);
  return {
    project,
    ts: project.ts,
    service: project.service,
    fileName,
    text: project.textOf(fileName) ?? request.contents ?? "",
  };
};

/** Run a compiler call, turning a thrown compiler error into a port failure. */
const attempt = <A>(
  what: string,
  run: () => A
): Effect.Effect<A, LanguageError> =>
  Effect.try({
    try: run,
    catch: (error) => fail(`${what} failed: ${reasonOf(error)}`),
  });

const relatedOf = (
  ts: TsProject["ts"],
  root: string,
  diagnostic: TS.Diagnostic
): ReadonlyArray<DiagnosticRelated> => {
  const out: Array<DiagnosticRelated> = [];
  for (const related of diagnostic.relatedInformation ?? []) {
    const file = related.file;
    if (file === undefined) continue;
    const path = toRepoRelative(root, file.fileName);
    if (path === null) continue;
    out.push({
      location: {
        path,
        range: spanToRange(file.text, {
          start: related.start ?? 0,
          length: related.length ?? 0,
        }),
      },
      message: ts.flattenDiagnosticMessageText(related.messageText, " "),
    });
  }
  return out;
};

const diagnosticsOf = (
  document: OpenDocument,
  root: string
): ReadonlyArray<Diagnostic> => {
  const { service, fileName, ts, text } = document;
  const collected: Array<TS.Diagnostic> = [
    ...service.getSyntacticDiagnostics(fileName),
    ...service.getSemanticDiagnostics(fileName),
    // TypeScript's weak warnings — unused locals, promotable JSDoc types. They
    // arrive as hints so the UI can fade them instead of flagging them.
    ...service.getSuggestionDiagnostics(fileName),
  ];
  return collected.map((diagnostic) =>
    toDiagnostic({
      // A diagnostic without a file (a bad compiler option) is anchored to the
      // start of the document so it still has somewhere to render.
      text: diagnostic.file?.text ?? text,
      start: diagnostic.start ?? 0,
      length: diagnostic.length ?? 0,
      category: diagnostic.category,
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      unnecessary: diagnostic.reportsUnnecessary === true,
      deprecated: diagnostic.reportsDeprecated === true,
      related: relatedOf(ts, root, diagnostic),
    })
  );
};

/** The identifier span a position resolves to, for highlighting the origin. */
const boundSpan = (document: OpenDocument, offset: number): Range | null => {
  const bound = document.service.getDefinitionAndBoundSpan(
    document.fileName,
    offset
  );
  return bound?.textSpan === undefined
    ? null
    : spanToRange(document.text, bound.textSpan);
};

const targetsOf = (
  document: OpenDocument,
  root: string,
  definitions: ReadonlyArray<TS.DefinitionInfo>
): ReadonlyArray<SymbolTarget> => {
  const out: Array<SymbolTarget> = [];
  for (const definition of definitions) {
    const path = toRepoRelative(root, definition.fileName);
    if (path === null) continue;
    const text = document.project.textOf(definition.fileName) ?? "";
    out.push({
      location: { path, range: spanToRange(text, definition.textSpan) },
      name: definition.name,
      kind: definition.kind,
      containerName: definition.containerName,
      preview: spanPreview(text, definition.textSpan.start),
    });
  }
  return out;
};

/**
 * The parsed form of the files a search touched, looked up once each.
 *
 * A symbol used a hundred times in one file is a hundred questions about the
 * same syntax tree; the program already holds it, so the only cost worth
 * avoiding is asking for it again per usage.
 */
const sourceFiles = (document: OpenDocument) => {
  const program = document.service.getProgram();
  const cache = new Map<string, TS.SourceFile | undefined>();
  return (fileName: string): TS.SourceFile | undefined => {
    if (!cache.has(fileName))
      cache.set(fileName, program?.getSourceFile(fileName));
    return cache.get(fileName);
  };
};

/**
 * Where the symbol is declared, as the compiler describes it — the header a
 * usages view stands above its results. `findReferences` groups by declaration
 * and a search starts from one symbol, so the first group is that symbol; the
 * rest, when there are any, are the other declarations of an overload or a
 * merged interface, and their usages are already in the list.
 */
const declarationOf = (
  root: string,
  document: OpenDocument,
  symbols: ReadonlyArray<TS.ReferencedSymbol>
): SymbolTarget | null => {
  const definition = symbols[0]?.definition;
  if (definition === undefined) return null;
  const path = toRepoRelative(root, definition.fileName);
  if (path === null) return null;
  const text = document.project.textOf(definition.fileName) ?? "";
  return {
    location: { path, range: spanToRange(text, definition.textSpan) },
    name: definition.name,
    kind: definition.kind,
    containerName: definition.containerName,
    preview: spanPreview(text, definition.textSpan.start),
  };
};

const referencesOf = (
  document: OpenDocument,
  root: string,
  symbols: ReadonlyArray<TS.ReferencedSymbol>
): ReadonlyArray<SymbolReference> => {
  const sourceOf = sourceFiles(document);
  const out: Array<SymbolReference> = [];
  for (const symbol of symbols) {
    for (const entry of symbol.references) {
      const path = toRepoRelative(root, entry.fileName);
      if (path === null) continue;
      const text = document.project.textOf(entry.fileName) ?? "";
      // A file the program has dropped still has a span and a preview; it is
      // only the syntactic reading that goes with it, which the wire shapes
      // already allow to be absent.
      const source = sourceOf(entry.fileName);
      const container =
        source === undefined
          ? NO_CONTAINER
          : containerAt(document.ts, source, entry.textSpan.start);
      out.push({
        location: { path, range: spanToRange(text, entry.textSpan) },
        kind:
          source === undefined
            ? referenceKind(entry)
            : usageKind(document.ts, source, entry.textSpan.start, entry),
        preview: spanPreview(text, entry.textSpan.start),
        containerName: container.name,
        containerKind: container.kind,
      });
    }
  }
  return out;
};

/** Formatting the compiler applies to the edits it generates. */
const FORMAT_OPTIONS: TS.FormatCodeSettings = {
  convertTabsToSpaces: true,
  indentSize: 2,
  tabSize: 2,
};

/**
 * Diagnostics that mean "this name is not in scope", which is what makes an
 * import worth offering: cannot-find-name, and its did-you-mean variants.
 */
const UNRESOLVED_NAME_CODES = new Set([2304, 2552, 2503, 2593, 2686]);

/** Preferences that turn on auto-import suggestions and snippet inserts. */
const COMPLETION_PREFERENCES: TS.UserPreferences = {
  includeCompletionsForModuleExports: true,
  includeCompletionsForImportStatements: true,
  includeCompletionsWithInsertText: true,
  includeCompletionsWithSnippetText: false,
};

/**
 * Collect the file changes of a code action, dropping any that fall outside the
 * repository — the UI could not open those files to apply them.
 */
const editsOf = (
  document: OpenDocument,
  root: string,
  changes: ReadonlyArray<TS.FileTextChanges>
): ReadonlyArray<FileEdits> => {
  const out: Array<FileEdits> = [];
  for (const change of changes) {
    const text = document.project.textOf(change.fileName) ?? "";
    const mapped = toFileEdits(root, change.fileName, text, change.textChanges);
    if (mapped !== null) out.push(mapped);
  }
  return out;
};

const positionOffset = (document: OpenDocument, request: PositionRequest) =>
  offsetAt(document.text, request.position);

export const typescriptProvider: LanguageProvider = {
  id: TYPESCRIPT_PROVIDER_ID,
  name: "TypeScript",
  patterns: [...PATTERNS],
  transport: "in-process",
  capabilities: {
    diagnostics: true,
    definition: true,
    references: true,
    hover: true,
    completions: true,
    codeActions: true,
  },

  probe: (root) =>
    Effect.sync(() => {
      const { module, detail } = loadTypeScript(root);
      return { available: module !== null, detail };
    }),

  diagnostics: (request) =>
    attempt("typescript diagnostics", () => {
      const document = open(request);
      if (document === null) return unsupported.diagnostics;
      return diagnosticsOf(document, request.root);
    }),

  definition: (request) =>
    attempt("typescript definition", () => {
      const document = open(request);
      if (document === null) return unsupported.definition;
      const offset = positionOffset(document, request);
      const bound = document.service.getDefinitionAndBoundSpan(
        document.fileName,
        offset
      );
      return {
        providerId: TYPESCRIPT_PROVIDER_ID,
        origin:
          bound?.textSpan === undefined
            ? null
            : spanToRange(document.text, bound.textSpan),
        targets: targetsOf(document, request.root, bound?.definitions ?? []),
      };
    }),

  references: (request) =>
    attempt("typescript references", () => {
      const document = open(request);
      if (document === null) return unsupported.references;
      const offset = positionOffset(document, request);
      const origin = boundSpan(document, offset);
      const symbols =
        document.service.findReferences(document.fileName, offset) ?? [];
      return {
        providerId: TYPESCRIPT_PROVIDER_ID,
        origin,
        // The token under the cursor reads better than TypeScript's rendered
        // signature ("Usages of greet", not "Usages of function greet(…): …").
        symbol:
          origin === null
            ? null
            : document.text.slice(
                offsetAt(document.text, origin.start),
                offsetAt(document.text, origin.end)
              ),
        declaration: declarationOf(request.root, document, symbols),
        references: referencesOf(document, request.root, symbols),
      };
    }),

  hover: (request) =>
    attempt("typescript hover", () => {
      const document = open(request);
      if (document === null) return unsupported.hover;
      const offset = positionOffset(document, request);
      const info = document.service.getQuickInfoAtPosition(
        document.fileName,
        offset
      );
      if (info === undefined) return unsupported.hover;
      const { ts } = document;
      return {
        providerId: TYPESCRIPT_PROVIDER_ID,
        range: spanToRange(document.text, info.textSpan),
        contents: hoverMarkdown({
          signature: ts.displayPartsToString(info.displayParts),
          documentation: ts.displayPartsToString(info.documentation),
          tags: (info.tags ?? []).map((tag) => ({
            name: tag.name,
            text: ts.displayPartsToString(tag.text),
          })),
        }),
      };
    }),

  completions: (request) =>
    attempt("typescript completions", (): CompletionResult => {
      const document = open(request);
      if (document === null) return unsupported.completions;
      const offset = positionOffset(document, request);
      const answered = document.service.getCompletionsAtPosition(
        document.fileName,
        offset,
        COMPLETION_PREFERENCES
      );
      // A position with nothing to suggest is not the same as an unsupported
      // one: the caller shows an empty list rather than deciding the language
      // has no provider.
      if (answered === undefined) {
        return {
          providerId: TYPESCRIPT_PROVIDER_ID,
          replace: null,
          items: [],
          incomplete: false,
        };
      }

      const items: Array<CompletionItem> = answered.entries.map((entry) => ({
        label: entry.name,
        kind: completionKind(entry.kind),
        detail: entry.labelDetails?.detail ?? "",
        insertText: entry.insertText ?? entry.name,
        sortText: entry.sortText,
        // A `source` means the symbol is not in scope yet, so accepting it has
        // to add an import — which `resolveCompletion` works out.
        source: entry.source ?? "",
        data: entry.data === undefined ? null : JSON.stringify(entry.data),
      }));

      // The compiler answers with everything in scope plus every exported
      // symbol it could import; the prefix is what makes that a usable list.
      const filtered = filterCompletions(items, request.prefix);
      const start = offset - request.prefix.length;
      return {
        providerId: TYPESCRIPT_PROVIDER_ID,
        replace: {
          start: positionAt(document.text, start),
          end: positionAt(document.text, offset),
        },
        items: filtered,
        incomplete: true,
      };
    }),

  resolveCompletion: (request) =>
    attempt("typescript completion detail", (): CompletionResolution => {
      const document = open(request);
      if (document === null) return unsupported.resolution;
      const offset = positionOffset(document, request);
      const details = document.service.getCompletionEntryDetails(
        document.fileName,
        offset,
        request.label,
        FORMAT_OPTIONS,
        request.source.length > 0 ? request.source : undefined,
        COMPLETION_PREFERENCES,
        request.data === null ? undefined : (JSON.parse(request.data) as never)
      );
      if (details === undefined) return unsupported.resolution;
      const { ts } = document;
      return {
        detail: ts.displayPartsToString(details.displayParts),
        documentation: ts.displayPartsToString(details.documentation),
        additionalEdits: (details.codeActions ?? []).flatMap((action) =>
          editsOf(document, request.root, action.changes)
        ),
      };
    }),

  codeActions: (request) =>
    attempt("typescript code actions", (): ReadonlyArray<CodeActionItem> => {
      const document = open(request);
      if (document === null) return unsupported.codeActions;
      const start = offsetAt(document.text, request.range.start);
      const end = offsetAt(document.text, request.range.end);

      const overlapping = [
        ...document.service.getSemanticDiagnostics(document.fileName),
        ...document.service.getSyntacticDiagnostics(document.fileName),
      ].filter((diagnostic) => {
        const from = diagnostic.start ?? 0;
        const to = from + (diagnostic.length ?? 0);
        return from <= end && to >= start;
      });
      if (overlapping.length === 0) return unsupported.codeActions;

      const actions: Array<CodeActionItem> = [];

      // Imports come from the completion machinery rather than from
      // `getCodeFixesAtPosition`. The fix API keys off a span whose exact
      // shape varies with how the error was produced, whereas asking what
      // could complete to this identifier names every module it could come
      // from — which is also more useful, since it offers the choice.
      const identifier = identifierAt(document.text, start);
      const unresolved = overlapping.some((diagnostic) =>
        UNRESOLVED_NAME_CODES.has(diagnostic.code)
      );
      if (identifier !== null && unresolved) {
        const candidates = document.service.getCompletionsAtPosition(
          document.fileName,
          identifier.end,
          COMPLETION_PREFERENCES
        );
        for (const entry of candidates?.entries ?? []) {
          if (entry.name !== identifier.text) continue;
          if (entry.source === undefined || entry.source.length === 0) continue;
          const details = document.service.getCompletionEntryDetails(
            document.fileName,
            identifier.end,
            entry.name,
            FORMAT_OPTIONS,
            entry.source,
            COMPLETION_PREFERENCES,
            entry.data
          );
          for (const action of details?.codeActions ?? []) {
            actions.push({
              title: action.description,
              kind: "quickfix.import",
              edits: editsOf(document, request.root, action.changes),
            });
          }
        }
      }

      // Everything else the compiler offers for the diagnostics in range.
      const fixes = document.service.getCodeFixesAtPosition(
        document.fileName,
        start,
        end,
        [...new Set(overlapping.map((diagnostic) => diagnostic.code))],
        FORMAT_OPTIONS,
        COMPLETION_PREFERENCES
      );
      for (const fix of fixes) {
        actions.push({
          title: fix.description,
          kind: "quickfix",
          edits: editsOf(document, request.root, fix.changes),
        });
      }

      // The import path and the fix API can find the same import.
      const seen = new Set<string>();
      return actions.filter((action) => {
        if (seen.has(action.title)) return false;
        seen.add(action.title);
        return action.edits.length > 0;
      });
    }),
};
