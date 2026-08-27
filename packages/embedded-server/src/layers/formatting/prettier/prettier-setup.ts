/**
 * Detecting a repository's Prettier setup, for settings to show.
 *
 * Formatting a file needs none of this — Prettier finds the configuration
 * governing a file itself, walking up from it. What settings needs is the
 * shallower answer: whether this project formats with Prettier at all, and
 * which file says so. That means looking down rather than up, and a bounded
 * scan is the honest way to do it: deep enough to find a monorepo package's own
 * configuration, shallow enough that a repository of any size answers at once.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  declaresPrettierConfig,
  formatterDetail,
  isPrettierConfigFile,
  pickConfigPath,
} from "@byconvo/core/formatting";
import type { FormatterSetup } from "@byconvo/core/ports/formatter";
import { prettierVersion } from "./prettier-module.ts";

/** How far below the root a package's own configuration is still found. */
const MAX_DEPTH = 3;

/** Directories that never hold a project's own configuration. */
const SKIPPED = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  "coverage",
  "vendor",
  "target",
  "tmp",
]);

const configPathsIn = (root: string): ReadonlyArray<string> => {
  const found: string[] = [];

  const walk = (directory: string, prefix: string, depth: number): void => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (depth + 1 > MAX_DEPTH) continue;
        // Dot-directories are tooling's own; the configuration a project
        // formats by is never inside one.
        if (SKIPPED.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(join(directory, entry.name), relative, depth + 1);
      } else if (isPrettierConfigFile(entry.name)) {
        found.push(relative);
      } else if (entry.name === "package.json") {
        try {
          if (
            declaresPrettierConfig(
              readFileSync(join(directory, entry.name), "utf8")
            )
          )
            found.push(relative);
        } catch {
          // A package.json that cannot be read configures nothing.
        }
      }
    }
  };

  walk(root, "", 0);
  return found;
};

/**
 * What `root` has: the configuration file that stands for the project, and the
 * Prettier the package holding it would run. Resolving the version from beside
 * that file rather than from the root is what makes a monorepo answer — the
 * root of one declares no dependencies at all.
 */
export const detectPrettier = (root: string): FormatterSetup => {
  const configPath = pickConfigPath(configPathsIn(root));
  const from = configPath === null ? root : join(root, dirname(configPath));
  const version = prettierVersion(from, root) ?? prettierVersion(root, root);
  return {
    available: version !== null,
    version,
    configPath,
    detail: formatterDetail({ version, configPath }),
  };
};
