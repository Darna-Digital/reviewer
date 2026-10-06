/**
 * PHPStan's findings, as diagnostics beside the language server's.
 *
 * Intelephense reports what a PHP parser and an index can see: syntax errors,
 * undefined symbols, wrong argument counts. What it cannot see is what
 * `tsc` sees for TypeScript — that this relation returns a collection of
 * `Post`, not a `User`; that this column is nullable — and in a Laravel app
 * that is most of what goes wrong, behind Eloquent's magic. PHPStan with
 * Larastan is the tool that does see it, and an app that already runs it has
 * said, in its `phpstan.neon`, exactly how strictly it wants to be checked.
 *
 * So nothing is configured here and nothing is installed: an app with
 * `vendor/bin/phpstan` and a config gets its own analysis, file by file, at its
 * own level; an app without gets intelephense alone. Only the files that config
 * covers are analysed — its `paths`, less its `excludePaths` — because naming a
 * file on the command line overrides them, and a test suite the project never
 * checks (Pest's `$this` is a mystery to PHPStan without its plugin) would
 * otherwise light up with errors no lint run reports. A file is analysed through
 * PHPStan's editor mode when the buffer is unsaved, so the findings track what
 * is on screen, and the answer is remembered per text so looking at the same
 * file twice does not run it twice.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import type { Diagnostic } from "@reviewer/core/language";
import { loginEnvironment } from "../../shell/login-environment.ts";

/** Config files PHPStan picks up by itself, in the order it looks. */
const CONFIG_FILES = ["phpstan.neon", "phpstan.neon.dist", "phpstan.dist.neon"];

/**
 * How long one file may take. A cold run boots the framework through Larastan
 * and builds PHPStan's result cache, which on a large app is tens of seconds;
 * every later one reuses that cache and takes about one.
 */
const RUN_TIMEOUT_MS = 90_000;

/** How many analysed texts are remembered, across files. */
const CACHE_LIMIT = 200;

/** A finding as PHPStan reports it, before it is placed on a line. */
export interface PhpstanMessage {
  /** One-based, as PHPStan counts; null for a finding about the whole file. */
  readonly line: number | null;
  readonly message: string;
  readonly identifier: string | null;
  readonly tip: string | null;
}

/** The app's PHPStan, when it has one set up. */
export const phpstanFor = (
  app: string,
  exists: (absolute: string) => boolean
): string | null => {
  const binary = `${app}/vendor/bin/phpstan`;
  if (!exists(binary)) return null;
  return CONFIG_FILES.some((name) => exists(`${app}/${name}`)) ? binary : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const messageOf = (raw: unknown): PhpstanMessage | null => {
  if (!isRecord(raw) || typeof raw["message"] !== "string") return null;
  const line = raw["line"];
  const identifier = raw["identifier"];
  const tip = raw["tip"];
  return {
    line: typeof line === "number" && line > 0 ? line : null,
    message: raw["message"],
    identifier: typeof identifier === "string" ? identifier : null,
    tip: typeof tip === "string" ? tip : null,
  };
};

/**
 * The findings in PHPStan's JSON output. Its documented shape files them under
 * `files[path].messages`; under an AI agent's environment it switches by itself
 * to `error_details[path]`, and a server started from a terminal running one
 * inherits that, so both are read. Only the file asked about is kept.
 */
export const parsePhpstanOutput = (
  output: string
): ReadonlyArray<PhpstanMessage> => {
  const start = output.indexOf("{");
  if (start === -1) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.slice(start));
  } catch {
    return [];
  }
  if (!isRecord(parsed)) return [];

  const lists: Array<unknown> = [];
  const files = parsed["files"];
  if (isRecord(files)) {
    for (const entry of Object.values(files)) {
      if (isRecord(entry) && Array.isArray(entry["messages"]))
        lists.push(...entry["messages"]);
    }
  }
  const details = parsed["error_details"];
  if (isRecord(details)) {
    for (const entry of Object.values(details)) {
      if (Array.isArray(entry)) lists.push(...entry);
    }
  }
  return lists.flatMap((raw) => {
    const message = messageOf(raw);
    return message === null ? [] : [message];
  });
};

/**
 * Tips that only say where to read more are dropped; the rest — "use
 * `?->` instead", "did you mean …" — say something about the line.
 */
const usefulTip = (tip: string | null): string | null =>
  tip === null || /^Learn more/i.test(tip) ? null : tip;

/**
 * A finding as a diagnostic. PHPStan names a line, not a span, so the range is
 * the line's code — from its first non-blank character to its end — which is
 * what the gutter and the squiggle need.
 */
export const toPhpstanDiagnostic = (
  message: PhpstanMessage,
  text: string
): Diagnostic => {
  const index = Math.max(0, (message.line ?? 1) - 1);
  const line = text.split("\n")[index] ?? "";
  const indent = line.length - line.trimStart().length;
  const tip = usefulTip(message.tip);
  return {
    range: {
      start: { line: index, character: indent },
      end: { line: index, character: line.trimEnd().length },
    },
    severity: "error",
    code: message.identifier,
    source: "phpstan",
    message: tip === null ? message.message : `${message.message}\n${tip}`,
    tags: [],
    related: [],
  };
};

const cache = new Map<string, ReadonlyArray<Diagnostic>>();
const running = new Map<string, Promise<ReadonlyArray<Diagnostic>>>();
/** One run at a time per app: PHPStan already uses every core it can. */
const queues = new Map<string, Promise<unknown>>();

const remember = (key: string, diagnostics: ReadonlyArray<Diagnostic>) => {
  cache.delete(key);
  cache.set(key, diagnostics);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
};

const run = (
  binary: string,
  app: string,
  args: ReadonlyArray<string>
): Promise<string> =>
  new Promise((resolve) => {
    let stdout = "";
    const child = spawn(binary, [...args], {
      cwd: app,
      // `vendor/bin/phpstan` starts with `#!/usr/bin/env php`, so the PHP it
      // runs on is whichever the developer's shell would find.
      env: { ...process.env, ...loginEnvironment() },
      stdio: ["ignore", "pipe", "ignore"],
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), RUN_TIMEOUT_MS);
    timer.unref?.();
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    // A run that fails to start, crashes or times out has found nothing worth
    // reporting; the language server's diagnostics stand on their own.
    child.on("error", () => {
      clearTimeout(timer);
      resolve("");
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(stdout);
    });
  });

/** What the app's own config analyses: absolute paths, and what it leaves out. */
export interface PhpstanScope {
  readonly paths: ReadonlyArray<string>;
  readonly excludes: ReadonlyArray<string>;
}

const stringsIn = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

/**
 * The scope in `phpstan dump-parameters --json` — the parameters after every
 * include and relative path is resolved, which is why PHPStan is asked rather
 * than the neon read here. `excludePaths` is a plain list in older configs and
 * split into `analyse` / `analyseAndScan` in newer ones; both exclude a file
 * from analysis.
 */
export const parsePhpstanScope = (
  output: string,
  app: string
): PhpstanScope | null => {
  const start = output.indexOf("{");
  if (start === -1) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.slice(start));
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const absolute = (path: string) =>
    (path.startsWith("/") ? path : `${app}/${path}`).replace(/\/+$/, "");
  const rawExcludes = parsed["excludePaths"];
  const excludes = isRecord(rawExcludes)
    ? [
        ...stringsIn(rawExcludes["analyse"]),
        ...stringsIn(rawExcludes["analyseAndScan"]),
      ]
    : stringsIn(rawExcludes);
  return {
    paths: stringsIn(parsed["paths"]).map(absolute),
    excludes: excludes.map(absolute),
  };
};

/** An `excludePaths` entry as PHPStan matches it: a glob, or a path prefix. */
const excludeMatches = (pattern: string, file: string): boolean => {
  if (!/[*?[]/.test(pattern))
    return file === pattern || file.startsWith(`${pattern}/`);
  const source = pattern
    .split(/(\*\*|\*|\?)/)
    .map((part) =>
      part === "**"
        ? ".*"
        : part === "*"
          ? "[^/]*"
          : part === "?"
            ? "[^/]"
            : part.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    )
    .join("");
  return new RegExp(`^${source}(/.*)?$`).test(file);
};

/** Whether the app's own `phpstan analyse` would look at `file`. */
export const phpstanCovers = (scope: PhpstanScope, file: string): boolean =>
  scope.paths.some((path) => file === path || file.startsWith(`${path}/`)) &&
  !scope.excludes.some((pattern) => excludeMatches(pattern, file));

/** Scopes by app, valid while the config files keep their mtimes. */
const scopes = new Map<
  string,
  { readonly stamp: string; readonly scope: Promise<PhpstanScope | null> }
>();

const configStamp = (app: string): string =>
  CONFIG_FILES.map((name) => {
    try {
      return `${name}:${statSync(`${app}/${name}`).mtimeMs}`;
    } catch {
      return "";
    }
  }).join("|");

/**
 * The app's PHPStan scope, asked once per config. A PHPStan too old to dump
 * its parameters answers null, and nothing is analysed: errors the project's
 * own runs never show are worse than none.
 */
const scopeOf = (binary: string, app: string): Promise<PhpstanScope | null> => {
  const stamp = configStamp(app);
  const cached = scopes.get(app);
  if (cached !== undefined && cached.stamp === stamp) return cached.scope;
  const scope = run(binary, app, ["dump-parameters", "--json"]).then((output) =>
    parsePhpstanScope(output, app)
  );
  scopes.set(app, { stamp, scope });
  return scope;
};

const readDisk = (absolute: string): string | null => {
  try {
    return readFileSync(absolute, "utf8");
  } catch {
    return null;
  }
};

/**
 * PHPStan's diagnostics for one file of the app, as of `text`. When `text` is
 * not what is on disk, it is written to a scratch file and analysed in its
 * place, which is the editor mode PHPStan has for exactly this.
 */
export const phpstanDiagnostics = (
  binary: string,
  app: string,
  absoluteFile: string,
  text: string
): Promise<ReadonlyArray<Diagnostic>> => {
  const hash = createHash("sha1").update(text).digest("hex");
  const key = `${absoluteFile}\0${hash}`;
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);
  const inFlight = running.get(key);
  if (inFlight !== undefined) return inFlight;

  const analyse = async (): Promise<ReadonlyArray<Diagnostic>> => {
    const scope = await scopeOf(binary, app);
    if (scope === null || !phpstanCovers(scope, absoluteFile)) return [];
    const unsaved = readDisk(absoluteFile) !== text;
    const scratch = `${tmpdir()}/reviewer-phpstan-${hash}.php`;
    const args = [
      "analyse",
      "--error-format=json",
      "--no-progress",
      "--no-interaction",
      "--memory-limit=2G",
    ];
    if (unsaved) {
      writeFileSync(scratch, text);
      args.push(`--tmp-file=${scratch}`, `--instead-of=${absoluteFile}`);
    }
    args.push(absoluteFile);
    try {
      const output = await run(binary, app, args);
      return parsePhpstanOutput(output).map((message) =>
        toPhpstanDiagnostic(message, text)
      );
    } finally {
      if (unsaved) rmSync(scratch, { force: true });
    }
  };

  const previous = queues.get(app) ?? Promise.resolve();
  const result = previous.then(analyse, analyse);
  queues.set(
    app,
    result.catch(() => undefined)
  );
  const settled = result
    .then((diagnostics) => {
      remember(key, diagnostics);
      return diagnostics;
    })
    .catch((): ReadonlyArray<Diagnostic> => [])
    .finally(() => running.delete(key));
  running.set(key, settled);
  return settled;
};

/** Test seam — forgets remembered results. */
export const resetPhpstan = (): void => {
  cache.clear();
  scopes.clear();
  running.clear();
  queues.clear();
};
