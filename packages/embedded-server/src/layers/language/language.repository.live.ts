/**
 * The live language backend: find the root that holds the file, pick the
 * provider that claims it, and delegate.
 *
 * All the root-relative bookkeeping stops here. Paths arrive named from the
 * project — `web-app/src/a.ts` in a project holding several roots, `src/a.ts`
 * in one that is itself a repository — and a provider only ever sees an
 * absolute root plus a path inside it, so a language server runs per repository
 * with the workspace it expects. Whatever comes back is named from the project
 * again, so a definition in another root opens like any other file.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import {
  selectProvider,
  type CodeActionItem,
  type CodeActionsResult,
  type Diagnostic,
  type DiagnosticsResult,
  type FileEdits,
  type LanguageProviderInfo,
  type LanguageRepo,
  type Location,
  type Position,
} from "@byconvo/core/language";
import { locateProjectPath, prefixProjectPath } from "@byconvo/core/project";
import type {
  LanguageFailure,
  LanguageProvider,
} from "@byconvo/core/ports/language-provider";
import { scanRepos } from "../workspace/repo-scan.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import {
  providersFor,
  type RepositoryProviders,
} from "./language.providers.ts";

/** A file located in the project, and the provider that claims it. */
interface Resolved {
  /** The repository root the provider runs in. */
  readonly root: string;
  /** The path as that root knows it. */
  readonly path: string;
  /** What the root's own paths are prefixed with from the project. */
  readonly prefix: string;
  readonly provider: LanguageProvider | null;
}

/** What a provider is given: its own root, and the path inside it. */
const requestOf = (target: Resolved, contents: string | null) => ({
  root: target.root,
  path: target.path,
  contents,
});

/**
 * Rename a root's own paths from the project. Every path a provider answers
 * with is relative to the root it ran in, and the views address files from the
 * project, so this is the one place the two meet. A no-op for a project that is
 * itself a repository, where the two namings are already the same.
 */
const namedFromProject = (prefix: string) => {
  const location = (value: Location): Location => ({
    ...value,
    path: prefixProjectPath(prefix, value.path),
  });
  const edits = (value: FileEdits): FileEdits => ({
    ...value,
    path: prefixProjectPath(prefix, value.path),
  });
  return {
    edits,
    /** Anything anchored to one place — a definition target, a reference. */
    located: <A extends { readonly location: Location }>(value: A): A => ({
      ...value,
      location: location(value.location),
    }),
    diagnostic: (value: Diagnostic): Diagnostic => ({
      ...value,
      related: value.related.map((related) => ({
        ...related,
        location: location(related.location),
      })),
    }),
    action: (value: CodeActionItem): CodeActionItem => ({
      ...value,
      edits: value.edits.map(edits),
    }),
  };
};

/**
 * The repository over a provider lookup. `providersFor` is the real one; a test
 * stands in its own to see which root a request reached.
 */
export const makeLanguageRepository = (
  lookup: (root: string) => RepositoryProviders
) =>
  Effect.gen(function* () {
    const workspace = yield* WorkspaceContext;
    const fs = yield* FileSystem.FileSystem;

    /**
     * The project's roots, freshly scanned so a repository cloned into the
     * folder is understood without the app being reopened.
     */
    const roots = Effect.flatMap(workspace.requireProject, (project) =>
      Effect.map(scanRepos(fs, project), (repos) => ({ project, repos }))
    );

    const resolve = (path: string): Effect.Effect<Resolved, LanguageFailure> =>
      Effect.gen(function* () {
        const { project, repos } = yield* roots;
        const located = locateProjectPath(project, repos, path);
        // A path no root claims is one named from the selected repository
        // rather than from the project — what a repo-scoped view sends — so it
        // is answered where it was asked about, and comes back unprefixed.
        const root = located?.repo.path ?? (yield* workspace.requireCurrent);
        const inRoot = located?.path ?? path;
        return {
          root,
          path: inRoot,
          prefix: located?.prefix ?? "",
          provider: selectProvider(lookup(root).providers, inRoot),
        };
      });

    const describe = (
      root: string,
      provider: LanguageProvider,
      problems: ReadonlyArray<string>
    ): Effect.Effect<LanguageProviderInfo> =>
      Effect.map(provider.probe(root), (availability) => ({
        id: provider.id,
        name: provider.name,
        patterns: [...provider.patterns],
        transport: provider.transport,
        capabilities: provider.capabilities,
        available: availability.available,
        // Configuration problems belong to whoever the configuration produced;
        // appending them here keeps the settings screen a single list.
        detail: [availability.detail, ...problems]
          .filter((part) => part.length > 0)
          .join(" · "),
      }));

    /** Shared plumbing for the position-addressed operations. */
    const withPosition = <A>(
      path: string,
      position: Position,
      contents: string | null,
      run: (
        provider: LanguageProvider,
        request: {
          root: string;
          path: string;
          contents: string | null;
          position: Position;
        }
      ) => Effect.Effect<A, LanguageFailure>,
      empty: A,
      named: (result: A, naming: ReturnType<typeof namedFromProject>) => A
    ): Effect.Effect<A, LanguageFailure> =>
      Effect.flatMap(resolve(path), (target) => {
        const provider = target.provider;
        if (provider === null) return Effect.succeed(empty);
        return Effect.map(
          run(provider, { ...requestOf(target, contents), position }),
          (result) => named(result, namedFromProject(target.prefix))
        );
      });

    const repo: LanguageRepo = {
      /**
       * Every root's providers as one list. Languages are configured per
       * repository, so a root that adds a language server adds it to the
       * project; a provider found in several roots is listed once, and counts
       * as available when any root can run it.
       */
      providers: Effect.gen(function* () {
        const { repos } = yield* roots;
        const paths =
          repos.length === 0
            ? [yield* workspace.requireCurrent]
            : repos.map((entry) => entry.path);
        const listed = new Map<string, LanguageProviderInfo>();
        for (const root of paths) {
          const { providers, problems } = lookup(root);
          for (const provider of providers) {
            const info = yield* describe(
              root,
              provider,
              provider.transport === "lsp-stdio" ? problems : []
            );
            const seen = listed.get(info.id);
            if (seen === undefined || (!seen.available && info.available)) {
              listed.set(info.id, info);
            }
          }
        }
        return [...listed.values()];
      }),

      diagnostics: (path, contents) =>
        Effect.flatMap(
          resolve(path),
          (target): Effect.Effect<DiagnosticsResult, LanguageFailure> => {
            const provider = target.provider;
            if (provider === null) {
              return Effect.succeed({
                path,
                providerId: null,
                diagnostics: [],
              });
            }
            const naming = namedFromProject(target.prefix);
            return Effect.map(
              provider.diagnostics(requestOf(target, contents)),
              (diagnostics) => ({
                // The path as it was asked about, not as its root knows it.
                path,
                providerId: provider.id,
                diagnostics: diagnostics.map(naming.diagnostic),
              })
            );
          }
        ),

      definition: (path, position, contents) =>
        withPosition(
          path,
          position,
          contents,
          (provider, request) => provider.definition(request),
          { providerId: null, origin: null, targets: [] },
          (result, naming) => ({
            ...result,
            targets: result.targets.map(naming.located),
          })
        ),

      references: (path, position, contents) =>
        withPosition(
          path,
          position,
          contents,
          (provider, request) => provider.references(request),
          {
            providerId: null,
            origin: null,
            symbol: null,
            declaration: null,
            references: [],
          },
          (result, naming) => ({
            ...result,
            declaration:
              result.declaration === null
                ? null
                : naming.located(result.declaration),
            references: result.references.map(naming.located),
          })
        ),

      hover: (path, position, contents) =>
        withPosition(
          path,
          position,
          contents,
          (provider, request) => provider.hover(request),
          { providerId: null, range: null, contents: "" },
          (result) => result
        ),

      completions: (path, position, prefix, contents) =>
        withPosition(
          path,
          position,
          contents,
          (provider, request) => provider.completions({ ...request, prefix }),
          { providerId: null, replace: null, items: [], incomplete: false },
          (result) => result
        ),

      resolveCompletion: (path, position, item, contents) =>
        withPosition(
          path,
          position,
          contents,
          (provider, request) =>
            provider.resolveCompletion({ ...request, ...item }),
          { detail: "", documentation: "", additionalEdits: [] },
          (result, naming) => ({
            ...result,
            // The caller reads and writes these files itself, so they have to
            // be named the way it addresses them.
            additionalEdits: result.additionalEdits.map(naming.edits),
          })
        ),

      codeActions: (path, range, contents) =>
        Effect.flatMap(
          resolve(path),
          (target): Effect.Effect<CodeActionsResult, LanguageFailure> => {
            const provider = target.provider;
            if (provider === null) {
              return Effect.succeed({ providerId: null, actions: [] });
            }
            const naming = namedFromProject(target.prefix);
            return Effect.map(
              provider.codeActions({ ...requestOf(target, contents), range }),
              (actions) => ({
                providerId: provider.id,
                actions: actions.map(naming.action),
              })
            );
          }
        ),
    };

    return repo;
  });

export const makeLiveLanguageRepository = makeLanguageRepository(providersFor);
