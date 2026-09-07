/**
 * The environment a real terminal tab has, for the programs reviewer starts
 * itself.
 *
 * A process spawned from `process.env` sees only what the app was launched
 * with, and under a GUI launch — the Electron app from Finder, or an IDE — that
 * is launchd's minimal PATH: no Homebrew, no `~/.local/bin`, and none of the
 * shims a version manager (rbenv, asdf, mise, nvm) puts a language's tools
 * behind. So `ruby-lsp` is "not installed" to reviewer while sitting right
 * there in the developer's terminal.
 *
 * The terminal and agent layers already answer this by running their commands
 * *through* `$SHELL -lic`. A language server cannot: its stdout is a framed
 * JSON-RPC stream, and anything a startup file prints would land in the middle
 * of it. So the shell is asked once, for its environment, and the servers are
 * started directly with it.
 *
 * The answer is cached for the life of the process — a shell that has to be
 * sourced costs a few hundred milliseconds, and the developer's PATH does not
 * change under a running app. Nothing waits for it: until it arrives, callers
 * get `process.env`, which is right on Linux and under `pnpm dev`, and is what
 * the app did before this existed.
 */
import { execFile } from "node:child_process";

/** How long the shell is given to answer before its environment is given up on. */
const TIMEOUT_MS = 5_000;
/** Bounds what a chatty startup file can hand back. */
const MAX_OUTPUT = 1024 * 1024;

/**
 * Printed either side of `env`, because a login shell is entitled to print
 * anything it likes — a greeting, a version manager's notice — and only what
 * lies between these is the environment.
 */
const MARK = "__REVIEWER_ENV__";
const COMMAND = `printf '%s\\n' ${MARK}; env; printf '%s\\n' ${MARK}`;

let resolved: NodeJS.ProcessEnv | null = null;
let inFlight: Promise<NodeJS.ProcessEnv> | null = null;

/** `KEY=VALUE` lines between the marks; a value may itself span lines. */
export const parseEnvironment = (output: string): NodeJS.ProcessEnv => {
  const start = output.indexOf(MARK);
  if (start === -1) return {};
  const end = output.indexOf(MARK, start + MARK.length);
  if (end === -1) return {};
  // `env` ends its last line with a newline; splitting on it would otherwise
  // hand that last variable an empty continuation line.
  const body = output.slice(start + MARK.length, end).replace(/\n$/, "");

  const environment: NodeJS.ProcessEnv = {};
  let key: string | null = null;
  for (const line of body.split("\n")) {
    const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (assignment !== null) {
      key = assignment[1] ?? null;
      if (key !== null) environment[key] = assignment[2] ?? "";
      continue;
    }
    // A continuation of the value before it, which is how `env` prints a
    // variable holding a newline.
    if (key !== null) environment[key] = `${environment[key] ?? ""}\n${line}`;
  }
  return environment;
};

const ask = (shell: string): Promise<NodeJS.ProcessEnv> =>
  new Promise((resolve) => {
    execFile(
      shell,
      ["-l", "-i", "-c", COMMAND],
      { timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT, encoding: "utf8" },
      (error, stdout) => {
        // A shell that fails, hangs or prints nothing usable leaves the
        // process's own environment in charge; this is an improvement on it,
        // never a requirement.
        if (error !== null && stdout.length === 0) {
          resolve({});
          return;
        }
        resolve(parseEnvironment(stdout));
      }
    );
  });

/**
 * The developer's environment merged over this process's own, or just this
 * process's until the shell has answered. Cheap to call: the work happens once.
 */
export const loginEnvironment = (): NodeJS.ProcessEnv =>
  resolved ?? process.env;

/**
 * Ask the shell, once. Safe to call more than once — later callers join the
 * first attempt. Resolves to the environment that {@link loginEnvironment} will
 * return from then on.
 */
export const loadLoginEnvironment = (
  shell = process.env["SHELL"],
  platform = process.platform
): Promise<NodeJS.ProcessEnv> => {
  if (resolved !== null) return Promise.resolve(resolved);
  if (inFlight !== null) return inFlight;

  // Windows has no login shell to source, and its own environment is what a
  // terminal there sees anyway.
  if (platform === "win32" || shell === undefined || shell.length === 0) {
    resolved = process.env;
    return Promise.resolve(resolved);
  }

  inFlight = ask(shell).then((environment) => {
    resolved = { ...process.env, ...environment };
    inFlight = null;
    return resolved;
  });
  return inFlight;
};

/** Test seam — forgets the shell's answer. */
export const resetLoginEnvironment = (): void => {
  resolved = null;
  inFlight = null;
};
