/**
 * Locating the TypeScript compiler to analyse a repository with.
 *
 * The repository's own `typescript` is used, never a copy bundled with byconvo
 * — the same rule editors follow with "use workspace version". A project's
 * diagnostics have to match what its `tsc` would say, and a compiler two majors
 * ahead of the one in its lockfile would invent errors nobody can reproduce.
 * When a repository has no TypeScript installed, the provider reports itself
 * unavailable rather than guessing.
 *
 * The lookup is anchored at the directory of the file being analysed, not at
 * the repository root: a pnpm workspace installs `typescript` under each
 * package rather than at the top, so a root-anchored resolution finds nothing
 * in exactly the repositories most likely to be reviewed here.
 *
 * Do not verify this path under `pnpm dev`. The dev server runs through `tsx`,
 * whose resolution hook answers every bare specifier from byconvo's own
 * dependency graph — `require("typescript")` succeeds there from any directory
 * on the machine, including ones with no `node_modules` at all. Only the
 * bundled server on plain node resolves the way this module intends.
 */
import { createRequire } from "node:module";
import type * as TSModule from "typescript";

export type TypeScriptModule = typeof TSModule;

/** Absolute path to a `typescript` entry point, overriding repository lookup. */
export const OVERRIDE_ENV = "BYCONVO_TYPESCRIPT_PATH";

export interface TypeScriptLookup {
  readonly module: TypeScriptModule | null;
  /** Where it came from, or why nothing was found — shown in settings. */
  readonly detail: string;
}

const cache = new Map<string, TypeScriptLookup>();

const reasonOf = (error: unknown) =>
  error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error);

const load = (
  fromDirectory: string,
  env: NodeJS.ProcessEnv
): TypeScriptLookup => {
  const requireFrom = createRequire(`${fromDirectory.replace(/\/+$/, "")}/`);

  const override = env[OVERRIDE_ENV]?.trim();
  const specifier =
    override !== undefined && override.length > 0 ? override : "typescript";
  const origin = specifier === "typescript" ? "repository" : OVERRIDE_ENV;

  try {
    const module = requireFrom(specifier) as TypeScriptModule;
    return { module, detail: `TypeScript ${module.version} (${origin})` };
  } catch (error) {
    return {
      module: null,
      detail:
        origin === "repository"
          ? `no TypeScript resolvable from here — install the repository's dependencies, or set ${OVERRIDE_ENV} (${reasonOf(error)})`
          : `${OVERRIDE_ENV} could not be loaded: ${reasonOf(error)}`,
    };
  }
};

/**
 * The compiler visible from `fromDirectory`, memoised per directory. A failed
 * lookup is cached too — every keystroke would otherwise retry a module
 * resolution that walks the whole directory tree.
 */
export const loadTypeScript = (
  fromDirectory: string,
  env: NodeJS.ProcessEnv = process.env
): TypeScriptLookup => {
  const cached = cache.get(fromDirectory);
  if (cached !== undefined) return cached;
  const lookup = load(fromDirectory, env);
  cache.set(fromDirectory, lookup);
  return lookup;
};

/** Test seam — drops memoised lookups. */
export const resetTypeScriptCache = (): void => cache.clear();
