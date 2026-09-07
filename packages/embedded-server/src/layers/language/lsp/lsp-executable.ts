/**
 * Finding a language server binary — the difference between "not configured"
 * and "configured but not installed", which is the first thing anyone debugging
 * `.reviewer/languages.json` needs to know.
 *
 * The filesystem check is injected so the search order itself can be tested
 * without planting executables on disk.
 */
import { accessSync, constants } from "node:fs";
import { posix, win32 } from "node:path";

const isExecutable = (path: string): boolean => {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

/** Extensions Windows treats as executable; empty elsewhere. */
const executableSuffixes = (env: NodeJS.ProcessEnv, platform: string) =>
  platform === "win32"
    ? (env["PATHEXT"] ?? ".EXE;.CMD;.BAT;.COM")
        .split(";")
        .filter((s) => s.length > 0)
    : [""];

export interface FindExecutableOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: string;
  readonly cwd?: string;
  readonly exists?: (path: string) => boolean;
}

/**
 * The resolved path of `command`, or null when it cannot be run. A command
 * containing a separator is treated as a path (relative to `cwd`); anything
 * else is searched for on PATH.
 */
export const findExecutable = (
  command: string,
  options: FindExecutableOptions = {}
): string | null => {
  const {
    env = process.env,
    platform = process.platform,
    cwd = process.cwd(),
    exists = isExecutable,
  } = options;

  const trimmed = command.trim();
  if (trimmed.length === 0) return null;

  // Path semantics follow the target platform, not the host: separators and the
  // PATH delimiter both differ, and splitting a Windows PATH on ":" would cut
  // every drive letter in half.
  const path = platform === "win32" ? win32 : posix;
  const suffixes = executableSuffixes(env, platform);

  const firstExisting = (base: string): string | null => {
    for (const suffix of suffixes) {
      const candidate = `${base}${suffix}`;
      if (exists(candidate)) return candidate;
    }
    return null;
  };

  if (
    trimmed.includes("/") ||
    (platform === "win32" && trimmed.includes("\\"))
  ) {
    return firstExisting(
      path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed)
    );
  }

  const pathValue = env["PATH"] ?? env["Path"] ?? "";
  for (const directory of pathValue.split(path.delimiter)) {
    if (directory.length === 0) continue;
    const found = firstExisting(path.resolve(directory, trimmed));
    if (found !== null) return found;
  }
  return null;
};
