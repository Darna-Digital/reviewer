/**
 * The provider list for a repository: whatever `.reviewer/languages.json`
 * configures, then the built-in ones — TypeScript, and Ruby and Swift when a
 * server for them is installed.
 *
 * Configured servers come first deliberately — `selectProvider` takes the first
 * match, so a project that would rather use its own TypeScript language server
 * can claim `.ts` and shadow the built-in one without any special case here.
 */
import { readFileSync, statSync } from "node:fs";
import type { LanguageProvider } from "@reviewer/core/ports/language-provider";
import {
  CONFIG_PATH,
  parseLanguageConfigText,
  type LanguageConfig,
} from "./lsp/lsp-config.ts";
import { makeLspProvider } from "./lsp/lsp-provider.ts";
import { rubyProviderFor } from "./ruby/ruby-server.ts";
import { swiftProviderFor } from "./swift/swift-server.ts";
import { typescriptProvider } from "./typescript/ts-provider.ts";

export interface RepositoryProviders {
  readonly providers: ReadonlyArray<LanguageProvider>;
  /** Configuration problems, surfaced by the providers endpoint. */
  readonly problems: ReadonlyArray<string>;
}

/**
 * How long a built list is reused before the machine is looked at again.
 *
 * The configuration file is watched by mtime, but a built-in provider is found
 * by searching PATH and the project's bundle, and neither of those changes a
 * file reviewer is watching: `gem install ruby-lsp` in a terminal beside the
 * app would otherwise leave Ruby reported missing until a restart. Rebuilding
 * costs a few `stat` calls, and language servers themselves are cached
 * elsewhere — by repository and server id — so nothing restarts with it.
 */
const DETECT_TTL_MS = 5_000;

interface CacheEntry extends RepositoryProviders {
  /** mtime of the config file when this was built; -1 when absent. */
  readonly configMtimeMs: number;
  /** When the list was built, for {@link DETECT_TTL_MS}. */
  readonly builtAt: number;
}

const cache = new Map<string, CacheEntry>();

const readConfig = (
  root: string
): { config: LanguageConfig; mtimeMs: number } => {
  const path = `${root.replace(/\/+$/, "")}/${CONFIG_PATH}`;
  let mtimeMs = -1;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    return { config: { servers: [], problems: [] }, mtimeMs: -1 };
  }
  try {
    return {
      config: parseLanguageConfigText(readFileSync(path, "utf8")),
      mtimeMs,
    };
  } catch (error) {
    return {
      config: {
        servers: [],
        problems: [
          `${CONFIG_PATH} could not be read: ${error instanceof Error ? error.message : String(error)}`,
        ],
      },
      mtimeMs,
    };
  }
};

const build = (root: string, config: LanguageConfig): RepositoryProviders => ({
  providers: [
    ...config.servers.map((server) => makeLspProvider(server)),
    typescriptProvider,
    rubyProviderFor(root),
    swiftProviderFor(),
  ],
  problems: config.problems,
});

/**
 * Providers for `root`, rebuilt whenever the configuration file changes so
 * editing it takes effect without restarting the server, and periodically so
 * a language server installed while the app is open is picked up too.
 */
export const providersFor = (
  root: string,
  now: number = Date.now()
): RepositoryProviders => {
  const { config, mtimeMs } = readConfig(root);
  const cached = cache.get(root);
  if (
    cached !== undefined &&
    cached.configMtimeMs === mtimeMs &&
    now - cached.builtAt < DETECT_TTL_MS
  ) {
    return cached;
  }
  const built = {
    ...build(root, config),
    configMtimeMs: mtimeMs,
    builtAt: now,
  };
  cache.set(root, built);
  return built;
};

/** Test seam — drops cached provider lists. */
export const resetProviders = (): void => cache.clear();
