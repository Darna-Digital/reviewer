/**
 * The project's reads across several roots, driven by a git that answers per
 * repository. What matters here is not the parsing — the `repo` feature owns
 * that — but where each command was run and how the answers were put back
 * together: a search covering every root, and a path filter reaching only the
 * root that owns the path.
 */
import { it } from "@effect/vitest";
import { Effect, Layer, Option, Sink, Stream } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vitest";
import { ProjectRepository } from "@byconvo/core/project";
import { subcommandOf } from "../git/git-exec.ts";
import { memoryLayer } from "../workspace/workspace-context.ts";
import { makeGitProjectRepository } from "./project.repository.git.ts";
import type { SearchQuery } from "@byconvo/core/repo";

const PROJECT = "/work";
const ROOTS = ["/work/backend", "/work/frontend"];

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
  size: FileSystem.Size(0),
  blksize: Option.none(),
  blocks: Option.none(),
};

const TREE: Readonly<Record<string, ReadonlyArray<string>>> = {
  "/work": ["backend", "frontend"],
  "/work/backend": [],
  "/work/frontend": [],
};

const NUL = "\0";
const grepRecord = (path: string, line: number, text: string) =>
  `${[path, String(line), "1", text].join(NUL)}\n`;

interface Run {
  readonly cwd: string;
  readonly args: ReadonlyArray<string>;
}

/** Returned in place of output by a root git cannot be run in at all. */
const UNREADABLE = Symbol("unreadable");

/** What was asked, past the lock flags GitExec puts in front of a read. */
const asked = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  args.filter((arg) => arg !== "--no-optional-locks");

/**
 * A git that replies from `stdout(run)` and records every invocation, so a
 * test can assert on which root was asked what. A root answering `UNREADABLE`
 * fails to spawn, the way a half-cloned repository does.
 */
const fakeSpawner = (stdout: (run: Run) => string | typeof UNREADABLE) => {
  const runs: Array<Run> = [];
  const spawner = ChildProcessSpawner.make((command) => {
    // Nothing here pipes one git into another, so a piped command would be a
    // test that no longer describes what the repository does.
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

const withGit = (stdout: (run: Run) => string | typeof UNREADABLE) => {
  const { runs, spawner } = fakeSpawner(stdout);
  const layer = Layer.effect(ProjectRepository)(makeGitProjectRepository).pipe(
    Layer.provide(
      Layer.mergeAll(
        memoryLayer(PROJECT),
        FileSystem.layerNoop({
          readDirectory: (path) =>
            Effect.succeed([...(TREE[String(path)] ?? [])]),
          stat: () => Effect.succeed(directory),
          exists: (path) =>
            Effect.succeed(
              ROOTS.some((root) => `${root}/.git` === String(path))
            ),
          readFileString: () => Effect.succeed("ref: refs/heads/main\n"),
        }),
        Layer.succeed(ChildProcessSpawner.ChildProcessSpawner)(spawner)
      )
    )
  );
  return { layer, runs };
};

const query = (over: Partial<SearchQuery> = {}): SearchQuery => ({
  query: "openLocation",
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  limit: 200,
  ...over,
});

const logQuery = (path: string | null) => ({
  ref: "HEAD",
  limit: 10,
  skip: 0,
  author: null,
  grep: null,
  regex: false,
  caseSensitive: false,
  after: null,
  before: null,
  path,
  follow: false,
});

describe("GitProjectRepository.search", () => {
  it.effect("greps every root and names the hits from the project", () => {
    const { layer } = withGit(({ cwd }) =>
      cwd === "/work/backend"
        ? grepRecord("src/server.ts", 12, "openLocation()")
        : grepRecord("src/app.tsx", 3, "openLocation()")
    );
    return Effect.gen(function* () {
      const project = yield* ProjectRepository;
      const found = yield* project.search(query());
      expect(found.matches.map((match) => match.path)).toEqual([
        "backend/src/server.ts",
        "frontend/src/app.tsx",
      ]);
      expect(found.failed).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("reports the root it could not read, and keeps the rest", () => {
    const { layer } = withGit(({ cwd }) =>
      cwd === "/work/backend"
        ? UNREADABLE
        : grepRecord("src/app.tsx", 3, "openLocation()")
    );
    return Effect.gen(function* () {
      const project = yield* ProjectRepository;
      const found = yield* project.search(query());
      expect(found.matches.map((match) => match.path)).toEqual([
        "frontend/src/app.tsx",
      ]);
      expect(found.failed.map((entry) => entry.repo.name)).toEqual(["backend"]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("cuts the merged matches to the limit and says it did", () => {
    const { layer } = withGit(({ cwd }) =>
      cwd === "/work/backend"
        ? `${grepRecord("a.ts", 1, "one")}${grepRecord("b.ts", 2, "two")}`
        : grepRecord("c.ts", 3, "three")
    );
    return Effect.gen(function* () {
      const project = yield* ProjectRepository;
      const found = yield* project.search(query({ limit: 2 }));
      expect(found.matches).toHaveLength(2);
      expect(found.truncated).toBe(true);
    }).pipe(Effect.provide(layer));
  });
});

describe("GitProjectRepository.log", () => {
  const commit = `${[
    "sha",
    "short",
    "Ruby",
    "2026-08-07T09:00:00Z",
    "subject",
    "",
    "",
  ].join("\t")}\n`;

  it.effect(
    "asks only the root that owns a filtered path, in its own terms",
    () => {
      const { layer, runs } = withGit(() => commit);
      return Effect.gen(function* () {
        const project = yield* ProjectRepository;
        const page = yield* project.log(logQuery("frontend/src/app.tsx"));
        const logs = runs.filter((run) => subcommandOf(run.args) === "log");
        expect(logs.map((run) => run.cwd)).toEqual(["/work/frontend"]);
        expect(logs[0]?.args.at(-1)).toBe("src/app.tsx");
        expect(page.commits.map((entry) => entry.repo.name)).toEqual([
          "frontend",
        ]);
      }).pipe(Effect.provide(layer));
    }
  );

  it.effect("walks every root when nothing narrows the history", () => {
    const { layer, runs } = withGit(() => commit);
    return Effect.gen(function* () {
      const project = yield* ProjectRepository;
      yield* project.log(logQuery(null));
      const logs = runs.filter((run) => subcommandOf(run.args) === "log");
      expect(logs.map((run) => run.cwd).sort()).toEqual(ROOTS);
    }).pipe(Effect.provide(layer));
  });

  it.effect("has no history for a path no root claims", () => {
    const { layer, runs } = withGit(() => commit);
    return Effect.gen(function* () {
      const project = yield* ProjectRepository;
      const page = yield* project.log(logQuery("mobile/src/app.tsx"));
      expect(runs.filter((run) => subcommandOf(run.args) === "log")).toEqual(
        []
      );
      expect(page.commits).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});

describe("GitProjectRepository.discard", () => {
  it.effect("reverts each root's paths in that root's own terms", () => {
    const { layer, runs } = withGit(() => "");
    return Effect.gen(function* () {
      const project = yield* ProjectRepository;
      yield* project.discard(["backend/src/server.ts", "frontend/src/app.tsx"]);
      const reverts = runs.filter(
        (run) => subcommandOf(run.args) === "checkout"
      );
      expect(reverts.map((run) => [run.cwd, run.args.at(-1)])).toEqual([
        ["/work/backend", "src/server.ts"],
        ["/work/frontend", "src/app.tsx"],
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.effect("touches nothing for a path no root claims", () => {
    const { layer, runs } = withGit(() => "");
    return Effect.gen(function* () {
      const project = yield* ProjectRepository;
      yield* project.discard(["mobile/src/app.tsx"]);
      expect(runs).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});

describe("GitProjectRepository.discardHunk", () => {
  it.effect("asks only the root that owns the file", () => {
    const { layer, runs } = withGit(() => "");
    return Effect.gen(function* () {
      const project = yield* ProjectRepository;
      yield* project.discardHunk("frontend/src/app.tsx", 0);
      const diffs = runs.filter((run) => subcommandOf(run.args) === "diff");
      expect(diffs.map((run) => [run.cwd, run.args.at(-1)])).toEqual([
        ["/work/frontend", "src/app.tsx"],
      ]);
    }).pipe(Effect.provide(layer));
  });
});
