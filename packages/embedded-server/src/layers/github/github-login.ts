/**
 * Signing in to GitHub from the app: `gh auth login --web`, driven headless.
 *
 * The token the server uses comes from the `gh` CLI (see `GitHubClient`), so
 * the way to get one is the CLI's own device flow — it asks GitHub for a
 * one-time code, prints it, and polls until the code has been typed on
 * github.com/login/device, then keeps the token where every later `gh auth
 * token` finds it. Run without a terminal the CLI prompts for nothing: it
 * prints the code and the page to type it on, and waits. So the flow here is
 * to start it, read the code out of what it prints, hand that to the settings
 * window to show, and report how the process ends.
 *
 * One sign-in at a time, and it outlives the request that started it: the
 * process polls GitHub for as long as the code is valid, so this is a global
 * of the server's rather than a per-request service.
 */
import { spawn, type ChildProcess } from "node:child_process";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  GitProviderError,
  type GitHubLoginState,
} from "@reviewer/core/ports/git-provider";
import { loginEnvironment } from "../shell/login-environment.ts";

export interface GitHubLoginShape {
  /** Start a sign-in, or return the one under way; resolves once the code is known. */
  readonly start: Effect.Effect<GitHubLoginState, GitProviderError>;
  readonly status: Effect.Effect<GitHubLoginState>;
  /** Stop a sign-in under way; a finished one is forgotten. */
  readonly cancel: Effect.Effect<GitHubLoginState>;
}

export class GitHubLogin extends Context.Service<GitHubLogin, GitHubLoginShape>()(
  "GitHubLogin"
) {}

const DEVICE_URL = "https://github.com/login/device";
/** How long the CLI is given to come back with a code before the start is refused. */
const CODE_TIMEOUT_MS = 20_000;

const idle: GitHubLoginState = {
  phase: "idle",
  code: null,
  url: null,
  reason: null,
};

/**
 * The code and the page, out of what the CLI prints — "First copy your
 * one-time code: XXXX-XXXX", then "Open this URL to continue in your web
 * browser: https://github.com/login/device". Colour codes are stripped in
 * case the CLI decides it is talking to a terminal after all.
 */
export const parseLoginOutput = (
  output: string
): { code: string; url: string } | null => {
  const plain = output.replace(/\x1b\[[0-9;]*m/g, "");
  const code = /one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i.exec(plain)?.[1];
  if (code === undefined) return null;
  const url = /(https?:\/\/\S+login\/device\S*)/.exec(plain)?.[1] ?? DEVICE_URL;
  return { code, url };
};

/**
 * Why the CLI stopped, from what it printed — its last line is the reason
 * it gives — or from how it could not be run at all.
 */
const failureReason = (
  error: NodeJS.ErrnoException | null,
  output: string
): string => {
  if (error?.code === "ENOENT")
    return "The GitHub CLI (gh) is not installed or not on PATH.";
  const lines = output
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("!"));
  return lines.at(-1) ?? error?.message ?? "gh auth login stopped without saying why.";
};

interface Flow {
  readonly child: ChildProcess;
  state: GitHubLoginState;
  /** Resolved once the code is printed, or the process ends first. */
  readonly ready: Promise<GitHubLoginState>;
}

const launch = (): Flow => {
  const child = spawn(
    "gh",
    [
      "auth",
      "login",
      "--hostname",
      "github.com",
      "--web",
      "--git-protocol",
      "https",
      "--skip-ssh-key",
    ],
    { env: loginEnvironment(), stdio: ["ignore", "pipe", "pipe"] }
  );
  let output = "";
  let settled = false;
  const flow: Flow = {
    child,
    state: { phase: "waiting", code: null, url: null, reason: null },
    ready: new Promise<GitHubLoginState>((resolve) => {
      const settle = (state: GitHubLoginState) => {
        flow.state = state;
        if (!settled) {
          settled = true;
          resolve(state);
        }
      };
      const read = (chunk: Buffer) => {
        output += chunk.toString("utf8");
        if (flow.state.code !== null) return;
        const parsed = parseLoginOutput(output);
        if (parsed !== null)
          settle({ phase: "waiting", ...parsed, reason: null });
      };
      child.stdout?.on("data", read);
      child.stderr?.on("data", read);
      child.on("error", (error: NodeJS.ErrnoException) =>
        settle({
          phase: "failed",
          code: null,
          url: null,
          reason: failureReason(error, output),
        })
      );
      child.on("close", (exitCode) =>
        settle(
          exitCode === 0
            ? { phase: "done", code: null, url: null, reason: null }
            : {
                phase: "failed",
                code: null,
                url: null,
                reason: failureReason(null, output),
              }
        )
      );
      setTimeout(() => {
        if (settled) return;
        child.kill();
        settle({
          phase: "failed",
          code: null,
          url: null,
          reason: "The GitHub CLI did not come back with a code in time.",
        });
      }, CODE_TIMEOUT_MS).unref();
    }),
  };
  return flow;
};

export const make = Effect.sync(() => {
  let current: Flow | null = null;

  const status: GitHubLoginShape["status"] = Effect.sync(
    () => current?.state ?? idle
  );

  const start: GitHubLoginShape["start"] = Effect.gen(function* () {
    if (current === null || current.state.phase !== "waiting")
      current = launch();
    const flow = current;
    const state = yield* Effect.promise(() => flow.ready);
    if (state.phase === "failed") {
      current = null;
      return yield* Effect.fail(
        new GitProviderError({ reason: state.reason ?? "sign-in failed" })
      );
    }
    return state;
  });

  const cancel: GitHubLoginShape["cancel"] = Effect.sync(() => {
    if (current?.state.phase === "waiting") current.child.kill();
    current = null;
    return idle;
  });

  return GitHubLogin.of({ start, status, cancel });
});

export const layer: Layer.Layer<GitHubLogin> = Layer.effect(GitHubLogin)(make);
