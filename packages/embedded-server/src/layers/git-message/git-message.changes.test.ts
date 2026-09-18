/**
 * Collecting what a commit message is drafted from. What matters here is where
 * each git ran and in whose terms it was asked: a project holding several roots
 * gets project-named paths back, and each root is asked with the paths it knows
 * — the same split the commit across roots makes.
 */
import { it } from "@effect/vitest";
import { Effect, Layer, Option, Sink, Stream } from "effect";
import * as ByteSize from "effect/ByteSize";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vitest";
import { GitMessageChanges } from "@reviewer/core/git-message";
import { layer as gitExecLayer, subcommandOf } from "../git/git-exec.ts";
import { memoryLayer } from "../workspace/workspace-context.ts";
import { makeWorkspaceChanges } from "./git-message.changes.ts";

const PROJECT = "/work";
const MULTI_ROOTS = ["/work/backend", "/work/frontend"];

const directory: FileSystem.File.Info = {
  type: "Directory",
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  size: ByteSize.bytes(0),
  blksize: Option.none(),
  blocks: Option.none(),
};

const TREE: Readonly<Record<string, ReadonlyArray<string>>> = {
  "/work": ["backend", "frontend"],
  "/work/backend": [],
  "/work/frontend": [],
};

interface Run {
  readonly cwd: string;
  readonly args: ReadonlyArray<string>;
}

/** Returned in place of output by a root git cannot be run in at all. */
const UNREADABLE = Symbol("unreadable");

/** What was asked, past the lock flags GitExec puts in front of a read. */
const asked = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  args.filter((arg) => arg !== "--no-optional-locks");

const fakeSpawner = (stdout: (run: Run) => string | typeof UNREADABLE) => {
  const runs: Array<Run> = [];
  const spawner = ChildProcessSpawner.make((command) => {
    if (command._tag !== "StandardCommand") {
      return Effect.die("only plain commands are run here");
    }
    const run: Run = {
      cwd: String(command.options.cwd ?? ""),
      args: asked(command.args),
    };
    runs.push(run);
    const out = stdout(run);
    if (out === UNREADABLE) {
      return Effect.fail(
        PlatformError.systemError({
          _tag: "NotFound",
          module: "Command",
          method: "spawn",
          pathOrDescriptor: run.cwd,
        })
      );
    }
    const bytes = new TextEncoder().encode(out);
    return Effect.succeed(
      ChildProcessSpawner.makeHandle({
        pid: 1 as never,
        exitCode: Effect.succeed(0 as never),
        isRunning: Effect.succeed(false),
        kill: () => Effect.void,
        stdin: Sink.drain,
        stdout: Stream.make(bytes),
        stderr: Stream.empty,
        all: Stream.make(bytes),
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
        unref: Effect.die("unref is not used here"),
      })
    );
  });
  return { runs, spawner };
};

const withGit = (
  roots: ReadonlyArray<string>,
  stdout: (run: Run) => string | typeof UNREADABLE
) => {
  const { runs, spawner } = fakeSpawner(stdout);
  const infra = Layer.mergeAll(
    memoryLayer(PROJECT),
    FileSystem.layerNoop({
      readDirectory: (path) => Effect.succeed([...(TREE[String(path)] ?? [])]),
      stat: () => Effect.succeed(directory),
      exists: (path) =>
        Effect.succeed(roots.some((root) => `${root}/.git` === String(path))),
      readFileString: () => Effect.succeed("ref: refs/heads/main\n"),
    }),
    Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(spawner)
  );
  const layer = Layer.effect(GitMessageChanges)(makeWorkspaceChanges).pipe(
    Layer.provide(gitExecLayer),
    Layer.provideMerge(infra)
  );
  return { layer, runs };
};

const diffFor = (path: string) =>
  [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "",
  ].join("\n");

const answer =
  (perRoot: Readonly<Record<string, { diff: string; untracked?: string }>>) =>
  ({ args, cwd }: Run) => {
    const root = perRoot[cwd];
    if (root === undefined) return "";
    if (subcommandOf(args) === "diff") return root.diff;
    if (subcommandOf(args) === "ls-files") return root.untracked ?? "";
    if (subcommandOf(args) === "rev-parse")
      return "feature/DAR-144-add-thing\n";
    return "";
  };

describe("workspace commit-message changes", () => {
  it.effect(
    "collects every root the chosen paths reach, in its own terms",
    () =>
      Effect.gen(function* () {
        const { layer, runs } = withGit(
          MULTI_ROOTS,
          answer({
            "/work/backend": { diff: diffFor("src/server.ts") },
            "/work/frontend": { diff: diffFor("src/app.tsx") },
          })
        );
        const changes = yield* Effect.provide(
          Effect.flatMap(GitMessageChanges, (source) =>
            source.collect(["backend/src/server.ts", "frontend/src/app.tsx"])
          ),
          layer
        );
        const diffs = runs.filter((run) => subcommandOf(run.args) === "diff");
        expect(diffs.map((run) => run.cwd)).toEqual(MULTI_ROOTS);
        expect(diffs.map((run) => run.args.at(-1))).toEqual([
          "src/server.ts",
          "src/app.tsx",
        ]);
        expect(changes.diff).toContain(
          "diff --git a/backend/src/server.ts b/backend/src/server.ts"
        );
        expect(changes.diff).toContain(
          "diff --git a/frontend/src/app.tsx b/frontend/src/app.tsx"
        );
        expect(changes.branch).toBe("feature/DAR-144-add-thing");
      })
  );

  it.effect("names untracked files from the project", () =>
    Effect.gen(function* () {
      const { layer } = withGit(
        MULTI_ROOTS,
        answer({
          "/work/backend": { diff: "", untracked: "src/new.ts\n" },
          "/work/frontend": { diff: diffFor("src/app.tsx") },
        })
      );
      const changes = yield* Effect.provide(
        Effect.flatMap(GitMessageChanges, (source) =>
          source.collect(["backend/src/new.ts", "frontend/src/app.tsx"])
        ),
        layer
      );
      expect(changes.untracked).toEqual(["backend/src/new.ts"]);
    })
  );

  it.effect("keeps the roots it can read when one cannot be", () =>
    Effect.gen(function* () {
      const { layer } = withGit(MULTI_ROOTS, (run) =>
        run.cwd === "/work/backend"
          ? UNREADABLE
          : answer({ "/work/frontend": { diff: diffFor("src/app.tsx") } })(run)
      );
      const changes = yield* Effect.provide(
        Effect.flatMap(GitMessageChanges, (source) =>
          source.collect(["backend/src/server.ts", "frontend/src/app.tsx"])
        ),
        layer
      );
      expect(changes.diff).toContain("frontend/src/app.tsx");
      expect(changes.diff).not.toContain("backend/");
    })
  );

  it.effect("asks the selected repository as it stands for one root", () =>
    Effect.gen(function* () {
      const { layer, runs } = withGit([PROJECT], () => diffFor("src/a.ts"));
      const changes = yield* Effect.provide(
        Effect.flatMap(GitMessageChanges, (source) =>
          source.collect(["src/a.ts"])
        ),
        layer
      );
      const diffs = runs.filter((run) => subcommandOf(run.args) === "diff");
      expect(diffs.map((run) => run.cwd)).toEqual([PROJECT]);
      expect(diffs[0]?.args.at(-1)).toBe("src/a.ts");
      expect(changes.diff).toContain("diff --git a/src/a.ts b/src/a.ts");
    })
  );
});
