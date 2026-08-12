/**
 * The live language backend: resolve the repository the path belongs to, pick
 * the provider that claims the file, and delegate.
 *
 * All the path bookkeeping stops here. Paths crossing the API are named from
 * the project, the same as every other file-addressed feature; providers
 * receive an absolute repository root plus a repository-relative path, and
 * whatever they name back gets the repository's prefix put on again. The
 * service above receives LSP shapes, and neither end knows the difference
 * between a monorepo and a project holding several repositories.
 */
import * as Effect from "effect/Effect";
import {
  selectProvider,
  type CodeActionsResult,
  type Diagnostic,
  type DiagnosticsResult,
  type FileEdits,
  type LanguageProviderInfo,
  type LanguageRepo,
  type Location,
  type Position,
  type SymbolReference,
  type SymbolTarget,
} from "@byconvo/core/language";
import type {
  LanguageFailure,
  LanguageProvider,
} from "@byconvo/core/ports/language-provider";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import { locateRepo } from "./language.roots.ts";
import { providersFor } from "./language.providers.ts";

/** A provider chosen for a path, with the repository it works against. */
interface Resolved {
  readonly root: string;
  /** The requested path, relative to `root`. */
  readonly path: string;
  /** Where `root` sits in the project; empty for a monorepo. */
  readonly prefix: string;
  readonly provider: LanguageProvider | null;
}

const inProject = (prefix: string, path: string): string =>
  prefix === "" ? path : `${prefix}/${path}`;

const locationIn = (prefix: string, location: Location): Location =>
  prefix === ""
    ? location
    : { ...location, path: inProject(prefix, location.path) };

const diagnosticIn = (prefix: string, diagnostic: Diagnostic): Diagnostic =>
  prefix === "" || diagnostic.related.length === 0
    ? diagnostic
    : {
        ...diagnostic,
        related: diagnostic.related.map((related) => ({
          ...related,
          location: locationIn(prefix, related.location),
        })),
      };

const targetIn = (prefix: string, target: SymbolTarget): SymbolTarget =>
  prefix === ""
    ? target
    : { ...target, location: locationIn(prefix, target.location) };

const referenceIn = (
  prefix: string,
  reference: SymbolReference
): SymbolReference =>
  prefix === ""
    ? reference
    : { ...reference, location: locationIn(prefix, reference.location) };

const editsIn = (
  prefix: string,
  edits: ReadonlyArray<FileEdits>
): ReadonlyArray<FileEdits> =>
  prefix === ""
    ? edits
    : edits.map((file) => ({ ...file, path: inProject(prefix, file.path) }));

export const makeLiveLanguageRepository = Effect.gen(function* () {
  const workspace = yield* WorkspaceContext;

  const resolve = (path: string): Effect.Effect<Resolved, LanguageFailure> =>
    Effect.map(
      Effect.all([workspace.requireProject, workspace.current]),
      ([project, current]) => {
        const location = locateRepo(project, current, path);
        return {
          ...location,
          provider: selectProvider(
            providersFor(location.root).providers,
            location.path
          ),
        };
      }
    );

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
          path: inRepo,
          prefix,
          provider,
        }): Effect.Effect<DiagnosticsResult, LanguageFailure> =>
          provider === null
            ? Effect.succeed({ path, providerId: null, diagnostics: [] })
            : Effect.map(
                provider.diagnostics({ root, path: inRepo, contents }),
                (diagnostics) => ({
                  path,
                  providerId: provider.id,
                  diagnostics: diagnostics.map((diagnostic) =>
                    diagnosticIn(prefix, diagnostic)
                  ),
                })
              )
      ),

    definition: (path, position, contents) =>
      withPosition(
        resolve(path),
        position,
        contents,
        (provider, request) => provider.definition(request),
        { providerId: null, origin: null, targets: [] },
        (prefix, result) => ({
          ...result,
          targets: result.targets.map((target) => targetIn(prefix, target)),
        })
      ),

    references: (path, position, contents) =>
      withPosition(
        resolve(path),
        position,
        contents,
        (provider, request) => provider.references(request),
        { providerId: null, origin: null, symbol: null, references: [] },
        (prefix, result) => ({
          ...result,
          references: result.references.map((reference) =>
            referenceIn(prefix, reference)
          ),
        })
      ),

    hover: (path, position, contents) =>
      withPosition(
        resolve(path),
        position,
        contents,
        (provider, request) => provider.hover(request),
        { providerId: null, range: null, contents: "" }
      ),

    completions: (path, position, prefix, contents) =>
      withPosition(
        resolve(path),
        position,
        contents,
        (provider, request) => provider.completions({ ...request, prefix }),
        { providerId: null, replace: null, items: [], incomplete: false }
      ),

    resolveCompletion: (path, position, item, contents) =>
      withPosition(
        resolve(path),
        position,
        contents,
        (provider, request) =>
          provider.resolveCompletion({ ...request, ...item }),
        { detail: "", documentation: "", additionalEdits: [] },
        (prefix, result) => ({
          ...result,
          additionalEdits: editsIn(prefix, result.additionalEdits),
        })
      ),

    codeActions: (path, range, contents) =>
      Effect.flatMap(
        resolve(path),
        ({
          root,
          path: inRepo,
          prefix,
          provider,
        }): Effect.Effect<CodeActionsResult, LanguageFailure> =>
          provider === null
            ? Effect.succeed({ providerId: null, actions: [] })
            : Effect.map(
                provider.codeActions({ root, path: inRepo, contents, range }),
                (actions) => ({
                  providerId: provider.id,
                  actions: actions.map((action) => ({
                    ...action,
                    edits: editsIn(prefix, action.edits),
                  })),
                })
              )
      ),
  };

  return repo;
});

/** Shared plumbing for the position-addressed operations. */
const withPosition = <A>(
  resolved: Effect.Effect<Resolved, LanguageFailure>,
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
  rename: (prefix: string, result: A) => A = (_prefix, result) => result
): Effect.Effect<A, LanguageFailure> =>
  Effect.flatMap(resolved, ({ root, path, prefix, provider }) =>
    provider === null
      ? Effect.succeed(empty)
      : Effect.map(
          run(provider, { root, path, contents, position }),
          (result) => (prefix === "" ? result : rename(prefix, result))
        )
  );
