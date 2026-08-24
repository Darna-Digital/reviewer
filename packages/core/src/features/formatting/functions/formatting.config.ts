/**
 * Recognising a Prettier setup from the files a repository contains.
 *
 * Prettier's own resolution is per file — it walks up from the file being
 * formatted — but settings has to say something about the project as a whole,
 * so these answer the shallower question: does this repository configure
 * Prettier anywhere, and which file says so. Pure, because the interesting part
 * is the ranking, not the reading.
 */

/**
 * The configuration filenames Prettier reads, in its own precedence order. A
 * `prettier` key in package.json also counts and is handled separately, since
 * finding it means parsing rather than matching a name.
 */
export const PRETTIER_CONFIG_FILES: ReadonlyArray<string> = [
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.json5",
  ".prettierrc.yaml",
  ".prettierrc.yml",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.mjs",
  ".prettierrc.ts",
  ".prettierrc.toml",
  "prettier.config.js",
  "prettier.config.cjs",
  "prettier.config.mjs",
  "prettier.config.ts",
];

export const isPrettierConfigFile = (fileName: string): boolean =>
  PRETTIER_CONFIG_FILES.includes(fileName);

/**
 * Where a filename sits in Prettier's precedence. Anything unlisted ranks last,
 * which is where package.json belongs — Prettier reads its `prettier` key only
 * when no dedicated file answers.
 */
export const configRank = (fileName: string): number => {
  const index = PRETTIER_CONFIG_FILES.indexOf(fileName);
  return index === -1 ? PRETTIER_CONFIG_FILES.length : index;
};

const depth = (path: string): number => path.split("/").length;

const fileNameOf = (path: string): string => path.split("/").at(-1) ?? path;

/**
 * The one configuration file that stands for the project: the shallowest, and
 * among equals the first in Prettier's own precedence order, then by path.
 *
 * A monorepo configures Prettier once per package as often as once at the root,
 * and settings needs a single line — the shallowest file is the one a reader
 * would name if asked where this project keeps its formatting rules.
 */
export const pickConfigPath = (paths: ReadonlyArray<string>): string | null => {
  const ranked = [...paths].sort((a, b) => {
    const byDepth = depth(a) - depth(b);
    if (byDepth !== 0) return byDepth;
    const byPrecedence = configRank(fileNameOf(a)) - configRank(fileNameOf(b));
    return byPrecedence !== 0 ? byPrecedence : a.localeCompare(b);
  });
  return ranked[0] ?? null;
};

/** Whether a package.json carries Prettier's own `prettier` configuration key. */
export const declaresPrettierConfig = (packageJsonText: string): boolean => {
  try {
    const parsed: unknown = JSON.parse(packageJsonText);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      "prettier" in (parsed as Record<string, unknown>)
    );
  } catch {
    return false;
  }
};

/** The line settings shows: what was found, or what is missing. */
export const formatterDetail = (found: {
  readonly version: string | null;
  readonly configPath: string | null;
}): string => {
  if (found.version === null) {
    return "Prettier is not installed in this project — add it as a dependency to format on save";
  }
  return found.configPath === null
    ? `Prettier v${found.version} · no configuration file, so its defaults apply`
    : `Prettier v${found.version} · ${found.configPath}`;
};
