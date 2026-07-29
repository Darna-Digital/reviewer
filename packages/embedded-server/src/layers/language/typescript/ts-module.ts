/**
 * Locating the TypeScript compiler to analyse a repository with.
 *
 * The repository's own `typescript` is used, never a copy bundled with byconvo
 * — the same rule editors follow with "use workspace version". A project's
 * diagnostics have to match what its `tsc` would say, and a compiler two majors
 * ahead of the one in its lockfile would invent errors nobody can reproduce.
 * When a repository has no TypeScript installed, the provider reports itself
 * unavailable rather than guessing.
 */
import { createRequire } from "node:module"
import type * as TSModule from "typescript"

export type TypeScriptModule = typeof TSModule

/** Absolute path to a `typescript` entry point, overriding repository lookup. */
export const OVERRIDE_ENV = "BYCONVO_TYPESCRIPT_PATH"

export interface TypeScriptLookup {
  readonly module: TypeScriptModule | null
  /** Where it came from, or why nothing was found — shown in settings. */
  readonly detail: string
}

const cache = new Map<string, TypeScriptLookup>()

const reasonOf = (error: unknown) =>
  error instanceof Error ? (error.message.split("\n")[0] ?? "") : String(error)

const load = (root: string, env: NodeJS.ProcessEnv): TypeScriptLookup => {
  // Resolving from a path *inside* the repository makes node walk up from
  // there, so a package in a monorepo picks up the workspace-root install.
  const requireFrom = createRequire(`${root.replace(/\/+$/, "")}/`)

  const override = env[OVERRIDE_ENV]?.trim()
  const specifier =
    override !== undefined && override.length > 0 ? override : "typescript"
  const origin = specifier === "typescript" ? "repository" : OVERRIDE_ENV

  try {
    const module = requireFrom(specifier) as TypeScriptModule
    return { module, detail: `TypeScript ${module.version} (${origin})` }
  } catch (error) {
    return {
      module: null,
      detail:
        origin === "repository"
          ? `no TypeScript found in this repository — install its dependencies, or set ${OVERRIDE_ENV} (${reasonOf(error)})`
          : `${OVERRIDE_ENV} could not be loaded: ${reasonOf(error)}`,
    }
  }
}

/**
 * The compiler for `root`, memoised per repository. A failed lookup is cached
 * too — every keystroke would otherwise retry a module resolution that walks
 * the whole directory tree.
 */
export const loadTypeScript = (
  root: string,
  env: NodeJS.ProcessEnv = process.env
): TypeScriptLookup => {
  const cached = cache.get(root)
  if (cached !== undefined) return cached
  const lookup = load(root, env)
  cache.set(root, lookup)
  return lookup
}

/** Test seam — drops memoised lookups. */
export const resetTypeScriptCache = (): void => cache.clear()
