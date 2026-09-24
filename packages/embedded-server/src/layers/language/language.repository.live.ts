/**
 * The live language backend: pick the provider that claims the file in the
 * open repository, and delegate. A provider only ever sees an absolute root
 * plus a path inside it, so a language server runs with the workspace it
 * expects, and everything it answers with is already named the way the views
 * address files — from the repository.
 */
import * as Effect from "effect/Effect";
import {
  selectProvider,
  type CodeActionsResult,
  type DiagnosticsResult,
  type LanguageProviderInfo,
  type LanguageRepo,
  type Position,
} from "@reviewer/core/language";
import type {
  LanguageFailure,
  LanguageProvider,
} from "@reviewer/core/ports/language-provider";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import {
  providersFor,
  type RepositoryProviders,
} from "./language.providers.ts";

/** A file in the open repository, and the provider that claims it. */
interface Resolved {
  readonly root: string;
  readonly path: string;
  readonly provider: LanguageProvider | null;
}

/** What a provider is given: its root, and the path inside it. */
const requestOf = (target: Resolved, contents: string | null) => ({
  root: target.root,
  path: target.path,
  contents,
});

/**
 * The repository over a provider lookup. `providersFor` is the real one; a test
 * stands in its own to see which root a request reached.
 */
export const makeLanguageRepository = (
  lookup: (root: string) => RepositoryProviders
) =>
  Effect.gen(function* () {
    const workspace = yield* WorkspaceContext;

    const resolve = (path: string): Effect.Effect<Resolved, LanguageFailure> =>
      Effect.map(workspace.requireCurrent, (root) => ({
        root,
        path,
        provider: selectProvider(lookup(root).providers, path),
      }));

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
      empty: A
    ): Effect.Effect<A, LanguageFailure> =>
      Effect.flatMap(resolve(path), (target) => {
        const provider = target.provider;
        if (provider === null) return Effect.succeed(empty);
        return run(provider, { ...requestOf(target, contents), position });
      });

    const repo: LanguageRepo = {
      providers: Effect.gen(function* () {
        const root = yield* workspace.requireCurrent;
        const { providers, problems } = lookup(root);
        return yield* Effect.forEach(providers, (provider) =>
          describe(
            root,
            provider,
            provider.transport === "lsp-stdio" ? problems : []
          )
        );
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
            return Effect.map(
              provider.diagnostics(requestOf(target, contents)),
              (diagnostics) => ({ path, providerId: provider.id, diagnostics })
            );
          }
        ),

      definition: (path, position, contents) =>
        withPosition(
          path,
          position,
          contents,
          (provider, request) => provider.definition(request),
          { providerId: null, origin: null, targets: [] }
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
          }
        ),

      hover: (path, position, contents) =>
        withPosition(
          path,
          position,
          contents,
          (provider, request) => provider.hover(request),
          { providerId: null, range: null, contents: "" }
        ),

      completions: (path, position, prefix, contents) =>
        withPosition(
          path,
          position,
          contents,
          (provider, request) => provider.completions({ ...request, prefix }),
          { providerId: null, replace: null, items: [], incomplete: false }
        ),

      resolveCompletion: (path, position, item, contents) =>
        withPosition(
          path,
          position,
          contents,
          (provider, request) =>
            provider.resolveCompletion({ ...request, ...item }),
          { detail: "", documentation: "", additionalEdits: [] }
        ),

      codeActions: (path, range, contents) =>
        Effect.flatMap(
          resolve(path),
          (target): Effect.Effect<CodeActionsResult, LanguageFailure> => {
            const provider = target.provider;
            if (provider === null) {
              return Effect.succeed({ providerId: null, actions: [] });
            }
            return Effect.map(
              provider.codeActions({ ...requestOf(target, contents), range }),
              (actions) => ({ providerId: provider.id, actions })
            );
          }
        ),
    };

    return repo;
  });

export const makeLiveLanguageRepository = makeLanguageRepository(providersFor);
