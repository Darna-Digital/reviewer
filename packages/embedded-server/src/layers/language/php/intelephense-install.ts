/**
 * Intelephense, fetched for the user who does not have it.
 *
 * TypeScript works out of the box because the compiler ships inside the app.
 * Intelephense cannot ship the same way: its licence lets each user install and
 * run it, not anyone redistribute it. So the app does what an editor's server
 * manager does — fetches it from npm, on the user's say-so, into a directory of
 * reviewer's own — and the user is the one who installed it.
 *
 * It runs on the Node.js the server itself runs on (the app bundles one), so a
 * machine with no Node of its own is no obstacle. Fetching it needs npm, which
 * is used from PATH when there is one; when there is not, npm's own package is
 * downloaded from the registry first — it carries every dependency inside it,
 * so it runs on the same bundled Node with nothing else to install.
 *
 * The install goes into a staging directory and is moved into place only once
 * it is complete, so a half-finished download is never mistaken for a server.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import type { LanguageInstaller } from "@reviewer/core/language";
import { loginEnvironment } from "../../shell/login-environment.ts";
import { findExecutable } from "../lsp/lsp-executable.ts";

/** Where reviewer keeps the servers it installed itself. */
export const MANAGED_DIR = `${homedir()}/.reviewer/language-servers/intelephense`;

/** The server's entry point inside an install directory. */
export const entryPointIn = (directory: string) =>
  `${directory}/node_modules/intelephense/lib/intelephense.js`;

const REGISTRY = "https://registry.npmjs.org";

/** A download and an install of ~150 MB, on a slow connection. */
const INSTALL_TIMEOUT_MS = 10 * 60_000;

/** Stderr kept for the failure message, in characters. */
const FAILURE_TAIL = 600;

const TITLE = "Install intelephense";

/** Said before the button is pressed: what, from where, to where, and whose. */
const DETAIL =
  "Downloads intelephense (about 150 MB) from npm into ~/.reviewer/language-servers. It is free to use; by installing it you accept its licence (intelephense.com). Premium features need a licence key of your own.";

type InstallState =
  | { readonly state: "ready" }
  | { readonly state: "installing" }
  | { readonly state: "failed"; readonly failure: string };

let current: InstallState = { state: "ready" };
let inFlight: Promise<void> | null = null;

/** The installed entry point, or null when reviewer has not installed one. */
export const managedIntelephense = (
  directory: string = MANAGED_DIR,
  exists: (path: string) => boolean = existsSync
): string | null => {
  const entry = entryPointIn(directory);
  return exists(entry) ? entry : null;
};

/** The installer as the settings screen shows it. */
export const intelephenseInstaller = (): LanguageInstaller => ({
  title: TITLE,
  detail: DETAIL,
  state: current.state,
  failure: current.state === "failed" ? current.failure : null,
});

/** Run a command to completion, failing with the tail of what it said. */
const run = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(command, [...args], {
      cwd,
      env: { ...process.env, ...loginEnvironment() },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const keep = (chunk: Buffer) => {
      output = (output + chunk.toString("utf8")).slice(-FAILURE_TAIL);
    };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    const timer = setTimeout(() => child.kill("SIGKILL"), INSTALL_TIMEOUT_MS);
    timer.unref?.();
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${command} ${args[0] ?? ""} exited (${signal ?? code})${output.trim().length > 0 ? `: ${output.trim()}` : ""}`
          )
        );
    });
  });

/**
 * npm, as a command and the arguments that come before its own: the user's
 * when they have one, otherwise npm's package from the registry, unpacked into
 * `staging` and run on this process's Node.
 */
const npmIn = async (
  staging: string
): Promise<{ command: string; prefix: ReadonlyArray<string> }> => {
  const npm = findExecutable("npm");
  if (npm !== null) return { command: npm, prefix: [] };

  const manifest = (await (await fetch(`${REGISTRY}/npm/latest`)).json()) as {
    dist?: { tarball?: unknown };
  };
  const tarball = manifest.dist?.tarball;
  if (typeof tarball !== "string")
    throw new Error("the npm registry did not say where npm is");
  const response = await fetch(tarball);
  if (!response.ok)
    throw new Error(`downloading npm failed (${response.status})`);
  const archive = `${staging}/npm.tgz`;
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  await run("tar", ["-xzf", archive, "-C", staging], staging);
  // The archive unpacks to `package/`, npm's usual layout.
  return {
    command: process.execPath,
    prefix: [`${staging}/package/bin/npm-cli.js`],
  };
};

const install = async (directory: string): Promise<void> => {
  const staging = `${directory}.staging`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(`${staging}/server`, { recursive: true });
  try {
    const npm = await npmIn(staging);
    await run(
      npm.command,
      [
        ...npm.prefix,
        "install",
        "intelephense@latest",
        "--prefix",
        `${staging}/server`,
        "--omit=dev",
        "--no-audit",
        "--no-fund",
        "--no-package-lock",
        // Intelephense needs none of its dependencies' install scripts, and
        // a script is code run on the user's machine at install time.
        "--ignore-scripts",
        "--loglevel=error",
      ],
      staging
    );
    if (!existsSync(entryPointIn(`${staging}/server`)))
      throw new Error(
        "npm finished, but intelephense is not where it should be"
      );
    rmSync(directory, { recursive: true, force: true });
    renameSync(`${staging}/server`, directory);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
};

/**
 * Start installing intelephense, or join the install already under way. The
 * returned promise settles when it is done; the state it leaves behind is what
 * {@link intelephenseInstaller} reports.
 */
export const installIntelephense = (
  directory: string = MANAGED_DIR
): Promise<void> => {
  if (inFlight !== null) return inFlight;
  current = { state: "installing" };
  inFlight = install(directory)
    .then(() => {
      current = { state: "ready" };
    })
    .catch((error: unknown) => {
      current = {
        state: "failed",
        failure: error instanceof Error ? error.message : String(error),
      };
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};
