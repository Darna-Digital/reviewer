/**
 * The provider list for a repository: whatever `.byconvo/languages.json`
 * configures, then the built-in TypeScript provider.
 *
 * Configured servers come first deliberately — `selectProvider` takes the first
 * match, so a project that would rather use its own TypeScript language server
 * can claim `.ts` and shadow the built-in one without any special case here.
 */
import { readFileSync, statSync } from "node:fs";
import type { LanguageProvider } from "@byconvo/core/ports/language-provider";
import {
  CONFIG_PATH,
  parseLanguageConfigText,
  type LanguageConfig,
} from "./lsp/lsp-config.ts";
import { makeLspProvider } from "./lsp/lsp-provider.ts";
import { typescriptProvider } from "./typescript/ts-provider.ts";

export interface RepositoryProviders {
  readonly providers: ReadonlyArray<LanguageProvider>;
  /** Configuration problems, surfaced by the providers endpoint. */
  readonly problems: ReadonlyArray<string>;
}

interface CacheEntry extends RepositoryProviders {
  /** mtime of the config file when this was built; -1 when absent. */
  readonly configMtimeMs: number;
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

const build = (config: LanguageConfig): RepositoryProviders => ({
  providers: [...config.servers.map(makeLspProvider), typescriptProvider],
  problems: config.problems,
});

/**
 * Providers for `root`, rebuilt whenever the configuration file changes so
 * editing it takes effect without restarting the server.
 */
export const providersFor = (root: string): RepositoryProviders => {
  const { config, mtimeMs } = readConfig(root);
  const cached = cache.get(root);
  if (cached !== undefined && cached.configMtimeMs === mtimeMs) return cached;
  const built = { ...build(config), configMtimeMs: mtimeMs };
  cache.set(root, built);
  return built;
};

/** Test seam — drops cached provider lists. */
export const resetProviders = (): void => cache.clear();
