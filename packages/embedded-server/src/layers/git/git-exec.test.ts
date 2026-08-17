/**
 * How git is run, rather than what it answers: which commands are allowed to
 * take the index lock, which of them may run at the same time, and what happens
 * when something outside the server is holding it.
 */
import { it } from "@effect/vitest";
import { Effect, Layer, Sink, Stream } from "effect";
import * as Duration from "effect/Duration";
import { ChildProcessSpawner } from "effect/unstable/process";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect } from "vitest";
import { GitExec, makeAt } from "./git-exec.ts";

const REPO = "/work/repo";
const LOCK_ERROR = `fatal: Unable to create '${REPO}/.git/index.lock': File exists.`;

interface Reply {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly exitCode?: number;
  /** How long the command keeps running — what makes an overlap observable. */
  readonly runsFor?: Duration.Input;
}

/**
 * A git that answers per invocation and reports how many of its commands were
 * ever in flight together.
 */
const fakeGit = (reply: (args: ReadonlyArray<string>) => Reply) => {
  const runs: Array<ReadonlyArray<string>> = [];
  let inFlight = 0;
  let peak = 0;
  const spawner = ChildProcessSpawner.make((command) => {
    if (command._tag !== "StandardCommand") {
      return Effect.die("only plain commands are run here");
    }
    const args = [...command.args];
    runs.push(args);
    const answer = reply(args);
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    const bytes = (text: string) => new TextEncoder().encode(text);
    return Effect.succeed(
      ChildProcessSpawner.makeHandle({
        pid: 1 as never,
        exitCode: Effect.delay(
          Effect.sync(() => {
            inFlight -= 1;
            return (answer.exitCode ?? 0) as never;
          }),
          answer.runsFor ?? "0 millis"
        ),
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        stdin: Sink.drain,
        stdout: Stream.make(bytes(answer.stdout ?? "")),
        stderr: Stream.make(bytes(answer.stderr ?? "")),
        all: Stream.make(bytes(answer.stdout ?? "")),
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        unref: Effect.die("unref is not used here"),
      })
    );
  });
  return { runs, spawner, peak: () => peak };
};

const withGit = (reply: (args: ReadonlyArray<string>) => Reply) => {
  const { runs, spawner, peak } = fakeGit(reply);
  const layer = Layer.effect(GitExec)(makeAt(REPO)).pipe(
    Layer.provide(
      Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(spawner)
    )
  );
  return { layer, runs, peak };
};

describe("GitExec", () => {
  it.effect("reads ask git not to take the lock at all", () => {
    const { layer, runs } = withGit(() => ({ stdout: "" }));
    return Effect.gen(function* () {
      const git = yield* GitExec;
      yield* git.run("status", "--porcelain");
      expect(runs[0]).toEqual(["--no-optional-locks", "status", "--porcelain"]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("writes are left to take the lock they need", () => {
    const { layer, runs } = withGit(() => ({ stdout: "" }));
    return Effect.gen(function* () {
      const git = yield* GitExec;
      yield* git.run("commit", "-m", "a message");
      yield* git.run("-c", "core.editor=true", "commit", "--no-edit");
      expect(runs[0]).toEqual(["commit", "-m", "a message"]);
      expect(runs[1]).toEqual([
        "-c",
        "core.editor=true",
        "commit",
        "--no-edit",
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("reads run alongside each other", () => {
    const { layer, peak } = withGit(() => ({ runsFor: "40 millis" }));
    return Effect.gen(function* () {
      const git = yield* GitExec;
      yield* Effect.all([git.run("status"), git.run("diff", "HEAD")], {
        concurrency: "unbounded",
      });
      expect(peak()).toBe(2);
    }).pipe(Effect.provide(layer));
  });

  it.live("writes to one repository take their turn", () => {
    const { layer, peak } = withGit(() => ({ runsFor: "40 millis" }));
    return Effect.gen(function* () {
      const git = yield* GitExec;
      yield* Effect.all(
        [git.run("add", "-A"), git.run("checkout", "HEAD", "--", "a.ts")],
        { concurrency: "unbounded" }
      );
      expect(peak()).toBe(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("a lock held by something else is waited out", () => {
    let held = true;
    const { layer, runs } = withGit((args) => {
      const wasHeld = held;
      held = false;
      return {
        exitCode: wasHeld ? 1 : 0,
        stderr: wasHeld ? LOCK_ERROR : "",
        stdout: args.join(" "),
      };
    });
    return Effect.gen(function* () {
      const git = yield* GitExec;
      const output = yield* git.run("commit", "-m", "a message");
      expect(runs).toHaveLength(2);
      expect(output).toBe("commit -m a message");
    }).pipe(Effect.provide(layer));
  });

  /**
   * A git that cannot commit while `index.lock` is on disk, and can once it is
   * gone — which is what makes clearing an abandoned lock observable.
   */
  const gitBlockedByLock = (lockPath: string, gitDir: string) =>
    withGit((args) =>
      args.includes("--absolute-git-dir")
        ? { stdout: `${gitDir}\n` }
        : existsSync(lockPath)
          ? { exitCode: 1, stderr: LOCK_ERROR }
          : { stdout: "committed" }
    );

  const lockFile = (age: Duration.Input) => {
    const gitDir = mkdtempSync(join(tmpdir(), "byconvo-git-"));
    const lockPath = join(gitDir, "index.lock");
    writeFileSync(lockPath, "");
    const touched = new Date(Date.now() - Duration.toMillis(age));
    utimesSync(lockPath, touched, touched);
    return { gitDir, lockPath };
  };

  it.live("a lock left behind by something that died is cleared", () => {
    const { gitDir, lockPath } = lockFile("5 minutes");
    const { layer } = gitBlockedByLock(lockPath, gitDir);
    return Effect.gen(function* () {
      const git = yield* GitExec;
      const output = yield* git.run("commit", "-m", "a message");
      expect(output).toBe("committed");
      expect(existsSync(lockPath)).toBe(false);
    }).pipe(
      Effect.provide(layer),
      Effect.ensuring(
        Effect.sync(() => rmSync(gitDir, { recursive: true, force: true }))
      )
    );
  });

  it.live("a lock something is still working behind is left alone", () => {
    const { gitDir, lockPath } = lockFile("1 second");
    const { layer, runs } = gitBlockedByLock(lockPath, gitDir);
    return Effect.gen(function* () {
      const git = yield* GitExec;
      const failure = yield* Effect.flip(git.run("commit", "-m", "a message"));
      expect(runs.length).toBeGreaterThan(1);
      expect(existsSync(lockPath)).toBe(true);
      expect(failure.message).toContain("index.lock");
      expect(failure.message).toContain("Another program is using");
    }).pipe(
      Effect.provide(layer),
      Effect.ensuring(
        Effect.sync(() => rmSync(gitDir, { recursive: true, force: true }))
      )
    );
  });
});
