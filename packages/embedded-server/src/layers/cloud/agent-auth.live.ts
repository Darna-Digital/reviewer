/**
 * `AgentAuth` on this machine: run the vendor's own login, read what it wrote.
 *
 * This is the half a hosted sandbox cannot do. `codex login` starts a server
 * on `localhost:1455`, opens a browser at `auth.openai.com`, and writes the
 * tokens it receives to `$CODEX_HOME/auth.json`. The redirect only arrives if
 * the browser and the listener are the same machine, which is why the cloud is
 * otherwise left asking someone to type a device code.
 *
 * Nothing is parsed here. The file the CLI wrote is the credential, carried up
 * to byconvo cloud exactly as it is, and the cloud hands the same bytes back to
 * a sandbox's `codex` later.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  AgentAuth,
  AgentAuthError,
  type AgentAuthProvider,
} from "@byconvo/core/ports/agent-auth";

/** Where each vendor's CLI keeps its credential, and how to make one. */
interface AgentAuthProgram {
  readonly file: string;
  readonly args: ReadonlyArray<string>;
  /** Overridable by the CLI's own environment variable, as it would be. */
  readonly home: () => string;
  readonly credentialFile: string;
}

const PROGRAMS: Record<AgentAuthProvider, AgentAuthProgram> = {
  codex: {
    file: "codex",
    args: ["login"],
    home: () => process.env["CODEX_HOME"] ?? join(homedir(), ".codex"),
    credentialFile: "auth.json",
  },
};

/**
 * How long to wait for someone to finish in their browser. Generous: the
 * window may be behind other things, and the alternative to waiting is
 * cancelling a login they are halfway through.
 */
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const credentialPath = (program: AgentAuthProgram): string =>
  join(program.home(), program.credentialFile);

const readCredential = async (
  program: AgentAuthProgram
): Promise<string | null> => {
  try {
    const contents = await readFile(credentialPath(program), "utf8");
    return contents.trim().length > 0 ? contents : null;
  } catch {
    // Not signed in on this machine, which is a fact rather than a failure.
    return null;
  }
};

/**
 * Runs the vendor's login to completion. Its stdout is a person's instructions
 * — a URL it has usually already opened — so the last of it is kept to explain
 * a failure, and otherwise discarded.
 */
const runLogin = (program: AgentAuthProgram): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(program.file, [...program.args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let output = "";
    const keep = (chunk: string) => {
      output = (output + chunk).slice(-2000);
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", keep);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", keep);

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("the sign-in was not finished in time"));
    }, LOGIN_TIMEOUT_MS);
    timer.unref();

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(
        error.message.includes("ENOENT")
          ? new Error(
              `${program.file} is not installed on this machine — install it and try again`
            )
          : error
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      const tail = output.trim().slice(-500);
      reject(
        new Error(
          tail.length > 0
            ? tail
            : `${program.file} login exited (${code ?? "signal"})`
        )
      );
    });
  });

const asAuthError = (error: unknown): AgentAuthError =>
  new AgentAuthError({
    reason: error instanceof Error ? error.message : String(error),
  });

export const AgentAuthLive: Layer.Layer<AgentAuth> = Layer.succeed(AgentAuth)(
  AgentAuth.of({
    existing: (provider) =>
      Effect.tryPromise({
        try: () => readCredential(PROGRAMS[provider]),
        catch: asAuthError,
      }),
    signIn: (provider) =>
      Effect.tryPromise({
        try: async () => {
          const program = PROGRAMS[provider];
          await runLogin(program);
          const credential = await readCredential(program);
          if (credential === null) {
            throw new Error(
              `${program.file} reported success but wrote no ${program.credentialFile}`
            );
          }
          return credential;
        },
        catch: asAuthError,
      }),
  })
);
