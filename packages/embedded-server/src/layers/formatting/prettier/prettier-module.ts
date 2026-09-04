/**
 * Finding the Prettier a project would run itself.
 *
 * Never this server's own copy: a repository pins a version and a set of
 * plugins, and formatting with anything else would rewrite files to rules the
 * project never agreed to. Resolution therefore starts at the file (or at the
 * configuration file that governs it) and walks up, which is Node's own
 * algorithm and so lands on exactly the copy the project's scripts use.
 *
 * That also settles the monorepo case, where the root declares nothing and each
 * package brings its own Prettier and plugins.
 */
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

/** Prettier's Node API, as much of it as formatting needs. */
export interface PrettierModule {
  readonly version: string;
  readonly format: (
    source: string,
    options: Record<string, unknown>
  ) => Promise<string>;
  readonly resolveConfig: (
    filePath: string,
    options?: Record<string, unknown>
  ) => Promise<Record<string, unknown> | null>;
  readonly resolveConfigFile: (filePath: string) => Promise<string | null>;
  readonly getFileInfo: (
    filePath: string,
    options?: Record<string, unknown>
  ) => Promise<{ ignored: boolean; inferredParser: string | null }>;
}

/**
 * A require rooted at `directory`. The path need not exist — Node only uses it
 * as the starting point of the upward search.
 */
const requireFrom = (directory: string) =>
  createRequire(join(directory, "package.json"));

/**
 * Where `directory` resolves Prettier's manifest, or null when it resolves none
 * inside `root`.
 *
 * The containment check is the other half of using the project's own copy:
 * Node's search does not stop at the repository, so a Prettier installed in a
 * parent folder — or in the user's home directory — would otherwise be used to
 * reformat a project that never asked for it.
 */
const manifestWithin = (directory: string, root: string): string | null => {
  try {
    const manifest = requireFrom(directory).resolve("prettier/package.json");
    // Both sides as real paths: resolution reports one, and a package manager
    // that links its store (pnpm) or a symlinked checkout gives the other.
    const contained = `${realpathSync(root).replace(/\/+$/, "")}/`;
    return manifest.startsWith(contained) ? manifest : null;
  } catch {
    return null;
  }
};

/** The version of the Prettier `directory` resolves to within `root`. */
export const prettierVersion = (
  directory: string,
  root: string
): string | null => {
  const manifest = manifestWithin(directory, root);
  if (manifest === null) return null;
  try {
    const { version } = requireFrom(directory)(manifest) as {
      version?: string;
    };
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
};

/** The Prettier `directory` resolves to within `root`, loaded. */
export const loadPrettier = (
  directory: string,
  root: string
): PrettierModule | null => {
  if (manifestWithin(directory, root) === null) return null;
  try {
    return requireFrom(directory)("prettier") as PrettierModule;
  } catch {
    return null;
  }
};

/**
 * A plugin named in a configuration file, resolved to an absolute path.
 *
 * Prettier resolves bare plugin names against the working directory, which for
 * a long-lived server is wherever it happened to start — not the package that
 * declared the plugin. Resolving them here, from the configuration file that
 * asked for them, is what makes a project's own plugins load at all. A name
 * that resolves to nothing is passed through untouched so Prettier reports it.
 */
export const resolvePlugins = (
  plugins: unknown,
  directory: string
): ReadonlyArray<unknown> => {
  if (!Array.isArray(plugins)) return [];
  const resolver = requireFrom(directory);
  return plugins.map((plugin) => {
    if (typeof plugin !== "string") return plugin;
    if (plugin.startsWith(".") || plugin.startsWith("/")) return plugin;
    try {
      return resolver.resolve(plugin);
    } catch {
      return plugin;
    }
  });
};
