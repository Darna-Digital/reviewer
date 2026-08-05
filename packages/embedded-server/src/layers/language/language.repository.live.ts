/**
 * The live language backend: resolve the selected repository, pick the provider
 * that claims the file, and delegate.
 *
 * All the root-relative bookkeeping stops here. Providers receive an absolute
 * root plus a repository-relative path, the service above receives LSP shapes,
 * and neither knows which repository is selected.
 */
import * as Effect from "effect/Effect";
import {
  selectProvider,
  type CodeActionsResult,
  type DiagnosticsResult,
  type LanguageProviderInfo,
  type LanguageRepo,
  type Position,
  type Range,
} from "@byconvo/core/language";
import type {
  LanguageFailure,
  LanguageProvider,
} from "@byconvo/core/ports/language-provider";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import { providersFor } from "./language.providers.ts";

/** A provider chosen for a path, with the repository root it works against. */
interface Resolved {
  readonly root: string;
  readonly provider: LanguageProvider;
}

export const makeLiveLanguageRepository = Effect.gen(function* () {
  const workspace = yield* WorkspaceContext;

  const resolve = (
    path: string
  ): Effect.Effect<
    Resolved | { root: string; provider: null },
    LanguageFailure
  > =>
    Effect.map(workspace.requireCurrent, (root) => ({
      root,
      provider: selectProvider(providersFor(root).providers, path),
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

  const repo: LanguageRepo = {
    providers: Effect.gen(function* () {
      const root = yield* workspace.requireCurrent;
      const { providers, problems } = providersFor(root);
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
        ({
          root,
          provider,
        }): Effect.Effect<DiagnosticsResult, LanguageFailure> =>
          provider === null
            ? Effect.succeed({ path, providerId: null, diagnostics: [] })
            : Effect.map(
                provider.diagnostics({ root, path, contents }),
                (diagnostics) => ({
                  path,
                  providerId: provider.id,
                  diagnostics,
                })
              )
      ),

    definition: (path, position, contents) =>
      withPosition(
        resolve(path),
        path,
        position,
        contents,
        (provider, request) => provider.definition(request),
        { providerId: null, origin: null, targets: [] }
      ),

    references: (path, position, contents) =>
      withPosition(
        resolve(path),
        path,
        position,
        contents,
        (provider, request) => provider.references(request),
        { providerId: null, origin: null, symbol: null, references: [] }
      ),

    hover: (path, position, contents) =>
      withPosition(
        resolve(path),
        path,
        position,
        contents,
        (provider, request) => provider.hover(request),
        { providerId: null, range: null, contents: "" }
      ),

    completions: (path, position, prefix, contents) =>
      withPosition(
        resolve(path),
        path,
        position,
        contents,
        (provider, request) => provider.completions({ ...request, prefix }),
        { providerId: null, replace: null, items: [], incomplete: false }
      ),

    resolveCompletion: (path, position, item, contents) =>
      withPosition(
        resolve(path),
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
        ({
          root,
          provider,
        }): Effect.Effect<CodeActionsResult, LanguageFailure> =>
          provider === null
            ? Effect.succeed({ providerId: null, actions: [] })
            : Effect.map(
                provider.codeActions({ root, path, contents, range }),
                (actions) => ({ providerId: provider.id, actions })
              )
      ),
  };

  return repo;
});

/** Shared plumbing for the three position-addressed operations. */
const withPosition = <A>(
  resolved: Effect.Effect<
    { root: string; provider: LanguageProvider | null },
    LanguageFailure
  >,
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
  Effect.flatMap(resolved, ({ root, provider }) =>
    provider === null
      ? Effect.succeed(empty)
      : run(provider, { root, path, contents, position })
  );
