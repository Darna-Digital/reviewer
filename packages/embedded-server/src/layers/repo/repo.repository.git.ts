/**
 * Git-backed repo repository — the real implementation. Ports the parsing and
 * command logic from the old `core/Git.ts`, but issues commands through the
 * shared `GitExec` service instead of spawning inline.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { GitError } from "@reviewer/core/ports/git-exec";
import { GitExec, type GitFailure } from "../git/git-exec.ts";
import { gitUserName } from "../git/git-identity.ts";
import { ALL_REFS } from "@reviewer/core/repo";
import type {
  BranchInfo,
  CommitDetail,
  CommitFileChange,
  CommitInfo,
  ConflictedFile,
  ConflictKind,
  ContentMatch,
  ContentMatches,
  GitFileStatus,
  GitStatusEntry,
  MergeState,
  RemoteBranchInfo,
  RepoStatus,
  RepoRepo,
  SearchQuery,
} from "@reviewer/core/repo";

/** Map a porcelain v2 unmerged `XY` field to a conflict kind. */
const conflictKindFromXY = (xy: string): ConflictKind => {
  switch (xy) {
    case "DD":
      return "both-deleted";
    case "AU":
      return "added-by-us";
    case "UD":
      return "deleted-by-them";
    case "UA":
      return "added-by-them";
    case "DU":
      return "deleted-by-us";
    case "AA":
      return "both-added";
    default:
      return "both-modified";
  }
};

/** One `--porcelain` line as a status entry. */
export const parseStatusLine = (line: string): GitStatusEntry | null => {
  if (line.length < 4) return null;
  const xy = line.slice(0, 2);
  let path = line.slice(3);
  const arrow = path.indexOf(" -> ");
  if (arrow >= 0) path = path.slice(arrow + 4);
  if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);

  const status: GitFileStatus | null =
    xy === "??"
      ? "untracked"
      : xy === "!!"
        ? "ignored"
        : xy.includes("R")
          ? "renamed"
          : xy.includes("A")
            ? "added"
            : xy.includes("D")
              ? "deleted"
              : xy.includes("M") || xy.includes("T") || xy.includes("U")
                ? "modified"
                : null;
  return status === null ? null : { path, status };
};

/**
 * Split a single file's unified diff into its file header (the `diff --git`,
 * `index`, `---`, `+++` lines) and its hunk blocks (each `@@ … @@` group and its
 * body). Body lines are prefixed with a space/`+`/`-`/`\`, so only a real hunk
 * header ever starts a new block. Used to reconstruct a one-hunk patch that
 * `git apply --reverse` can undo in isolation.
 *
 * `git diff` output ends with a trailing newline, so splitting on "\n" leaves an
 * empty final element that would otherwise attach to the last hunk as a blank
 * line — enough to make `git apply` reject the reconstructed patch. Each hunk is
 * therefore right-trimmed of empty lines (real body lines are never empty; they
 * always carry a prefix), and callers add exactly one trailing newline back.
 */
export const splitDiffIntoHunks = (
  patch: string
): { header: string; hunks: ReadonlyArray<string> } => {
  const lines = patch.split("\n");
  const firstHunk = lines.findIndex((line) => line.startsWith("@@"));
  if (firstHunk < 0) return { header: patch, hunks: [] };
  const header = lines.slice(0, firstHunk).join("\n");
  const hunks: Array<string> = [];
  let current: Array<string> = [];
  const flush = () => {
    while (current.length > 0 && current[current.length - 1] === "") {
      current.pop();
    }
    if (current.length > 0) hunks.push(current.join("\n"));
  };
  for (const line of lines.slice(firstHunk)) {
    if (line.startsWith("@@")) {
      flush();
      current = [line];
    } else {
      current.push(line);
    }
  }
  flush();
  return { header, hunks };
};

/** Long enough to read a match in context; minified files would otherwise ship megabytes. */
const MAX_MATCH_LINE_LENGTH = 400;

export const EMPTY_CONTENT_MATCHES: ContentMatches = {
  matches: [],
  truncated: false,
};

/** The `git grep` invocation behind a content search. */
export const searchArgs = (query: SearchQuery): ReadonlyArray<string> => [
  "grep",
  "--no-color",
  "--line-number",
  "--column",
  "--null",
  // Binary files have nothing readable to show; untracked-but-not-ignored ones
  // are as much "the working tree" as tracked ones.
  "-I",
  "--untracked",
  ...(query.caseSensitive ? [] : ["-i"]),
  ...(query.wholeWord ? ["-w"] : []),
  query.regex ? "-E" : "-F",
  "-e",
  query.query,
];

/**
 * Parse `git grep --null --line-number --column` output. `--null` separates
 * every field with a NUL, so a path containing a colon (or a match on a line of
 * colons) can never be mistaken for a field boundary. Stops at `limit`,
 * reporting whether git had more to give.
 */
export const parseContentMatches = (
  out: string,
  limit: number
): ContentMatches => {
  const matches: Array<ContentMatch> = [];
  for (const record of out.split("\n")) {
    if (record.length === 0) continue;
    const [path, line, column, ...text] = record.split("\0");
    if (path === undefined || line === undefined || column === undefined) {
      continue;
    }
    const lineNumber = Number(line);
    const columnNumber = Number(column);
    if (!Number.isInteger(lineNumber) || !Number.isInteger(columnNumber)) {
      continue;
    }
    if (matches.length === limit) return { matches, truncated: true };
    matches.push({
      path,
      line: lineNumber,
      column: columnNumber,
      text: text.join("\0").replace(/\r$/, "").slice(0, MAX_MATCH_LINE_LENGTH),
    });
  }
  return { matches, truncated: false };
};

/** Fold a filesystem error into a GitError so it stays on the git failure channel. */
const fsToGitError =
  (args: ReadonlyArray<string>) =>
  (error: unknown): GitError =>
    new GitError({
      args,
      exitCode: -1,
      stderr: error instanceof Error ? error.message : String(error),
    });

const parseGitHubRemote = (
  url: string
): { owner: string; repo: string } | null => {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  const owner = match?.[1];
  const repo = match?.[2];
  return owner !== undefined && repo !== undefined ? { owner, repo } : null;
};

const parseTrack = (track: string): { ahead: number; behind: number } => ({
  ahead: Number(track.match(/ahead (\d+)/)?.[1] ?? 0),
  behind: Number(track.match(/behind (\d+)/)?.[1] ?? 0),
});

const parseRefs = (refs: string | undefined): Array<string> =>
  refs === undefined || refs === ""
    ? []
    : refs
        .split(", ")
        .map((r) => r.replace(/^HEAD -> /, ""))
        .filter((r) => r.length > 0);

const parseParents = (parents: string | undefined): Array<string> =>
  parents === undefined || parents === ""
    ? []
    : parents.split(" ").filter((p) => p.length > 0);

const parseNameStatus = (line: string): CommitFileChange | null => {
  const parts = line.split("\t");
  const code = parts[0]?.[0];
  if (code === "R" || code === "C") {
    const oldPath = parts[1] ?? null;
    const path = parts[2] ?? parts[1] ?? "";
    return { path, oldPath, status: code === "R" ? "renamed" : "added" };
  }
  const path = parts[1] ?? "";
  if (path === "") return null;
  const status: GitFileStatus | null =
    code === "A"
      ? "added"
      : code === "D"
        ? "deleted"
        : code === "M" || code === "T"
          ? "modified"
          : null;
  return status === null ? null : { path, oldPath: null, status };
};

const FIELD_SEP = "\t";
const branchFormat = [
  "%(refname:short)",
  "%(objectname:short)",
  "%(upstream:short)",
  "%(upstream:track)",
  "%(committerdate:iso8601-strict)",
  "%(subject)",
].join(FIELD_SEP);

const remoteBranchFormat = [
  "%(refname:short)",
  "%(objectname:short)",
  "%(committerdate:iso8601-strict)",
  "%(subject)",
].join(FIELD_SEP);

const logFormat = ["%H", "%h", "%an", "%aI", "%s", "%D", "%P"].join(FIELD_SEP);

const US = "\x1f";
const detailFormat = [
  "%H",
  "%h",
  "%an",
  "%ae",
  "%aI",
  "%s",
  "%D",
  "%P",
  "%b",
].join(US);

const emptyStatus: RepoStatus = {
  branch: "",
  upstream: null,
  ahead: 0,
  behind: 0,
  headSha: "",
  changed: 0,
  staged: 0,
  unstaged: 0,
  untracked: 0,
  conflicted: 0,
};

export const makeGitRepoRepository = Effect.gen(function* () {
  const git = yield* GitExec;
  const fs = yield* FileSystem.FileSystem;
  const { lines, run, runTolerant, runVerbose } = git;

  /**
   * `git config --get` exits 1 for a key that is not set, which is an answer
   * rather than a failure, so the tolerant runner reads it and the empty
   * output becomes null.
   */
  const configValue = (key: string) =>
    runTolerant("config", "--get", key).pipe(
      Effect.map((out) => out.trim()),
      Effect.map((value) => (value.length > 0 ? value : null))
    );

  const identity: RepoRepo["identity"] = Effect.suspend(() =>
    Effect.all(
      { name: configValue("user.name"), email: configValue("user.email") },
      { concurrency: "unbounded" }
    )
  );

  const info: RepoRepo["info"] = Effect.gen(function* () {
    const [root, currentBranch, remoteUrl, user] = yield* Effect.all(
      [
        run("rev-parse", "--show-toplevel").pipe(
          Effect.map((out) => out.trim())
        ),
        run("rev-parse", "--abbrev-ref", "HEAD").pipe(
          Effect.map((out) => out.trim())
        ),
        run("remote", "get-url", "origin").pipe(
          Effect.map((out) => out.trim()),
          Effect.catchTag("GitError", () => Effect.succeed(null))
        ),
        gitUserName.pipe(Effect.provideService(GitExec, git)),
      ],
      { concurrency: "unbounded" }
    );
    const name = root.split("/").at(-1) ?? root;
    return {
      root,
      name,
      currentBranch,
      remoteUrl,
      github: remoteUrl === null ? null : parseGitHubRemote(remoteUrl),
      user,
    };
  });

  // Five independent reads of the same tree, so they go out together: run one
  // after another they add up to the slowest thing the file list waits on, and
  // the file list is what every page in the app opens with.
  const files: RepoRepo["files"] = Effect.gen(function* () {
    const [root, tracked, untracked, envFiles, statusLines] = yield* Effect.all(
      [
        run("rev-parse", "--show-toplevel").pipe(
          Effect.map((out) => out.trim())
        ),
        lines("ls-files"),
        lines("ls-files", "--others", "--exclude-standard"),
        lines(
          "ls-files",
          "--others",
          "--",
          ":(glob)**/.env*",
          ":(exclude,glob)**/node_modules/**"
        ),
        // `--untracked-files=all` is load-bearing: by default git collapses a
        // wholly-untracked directory into one `?? dir/` entry, so every new
        // file inside it would be counted as changed but never resolve to a
        // path in the tree — the files silently vanish from the diff view.
        lines("status", "--porcelain", "--untracked-files=all"),
      ],
      { concurrency: "unbounded" }
    );
    const gitStatus = statusLines
      .map(parseStatusLine)
      .filter((entry): entry is GitStatusEntry => entry !== null);
    const paths = [...new Set([...tracked, ...untracked, ...envFiles])];
    return { root, paths, gitStatus };
  });

  const status: RepoRepo["status"] = run(
    "status",
    "--porcelain=2",
    "--branch",
    "--untracked-files=all"
  ).pipe(
    Effect.map((out): RepoStatus => {
      let {
        ahead,
        behind,
        branch,
        changed,
        conflicted,
        headSha,
        staged,
        unstaged,
        untracked,
        upstream,
      } = emptyStatus;
      for (const line of out.split("\n")) {
        if (line.startsWith("# branch.head ")) {
          branch = line.slice(14).trim();
        } else if (line.startsWith("# branch.oid ")) {
          const oid = line.slice(13).trim();
          headSha = oid.startsWith("(") ? "" : oid.slice(0, 7);
        } else if (line.startsWith("# branch.upstream ")) {
          const up = line.slice(18).trim();
          upstream = up.length > 0 ? up : null;
        } else if (line.startsWith("# branch.ab ")) {
          const match = line.slice(12).match(/\+(\d+)\s+-(\d+)/);
          ahead = Number(match?.[1] ?? 0);
          behind = Number(match?.[2] ?? 0);
        } else if (line.startsWith("1 ") || line.startsWith("2 ")) {
          const xy = line.slice(2, 4);
          if (xy[0] !== ".") staged++;
          if (xy[1] !== ".") unstaged++;
          changed++;
        } else if (line.startsWith("u ")) {
          conflicted++;
          changed++;
        } else if (line.startsWith("? ")) {
          untracked++;
          changed++;
        }
      }
      return {
        ahead,
        behind,
        branch,
        changed,
        conflicted,
        headSha,
        staged,
        unstaged,
        untracked,
        upstream,
      };
    }),
    Effect.catchTag("GitError", () => Effect.succeed(emptyStatus))
  );

  const branches: RepoRepo["branches"] = Effect.gen(function* () {
    const current = (yield* run("rev-parse", "--abbrev-ref", "HEAD")).trim();
    const refLines = yield* lines(
      "for-each-ref",
      "refs/heads",
      "--sort=-committerdate",
      `--format=${branchFormat}`
    );
    return refLines.flatMap((line): Array<BranchInfo> => {
      const [name, sha, upstream, track, committedAt, subject] =
        line.split(FIELD_SEP);
      if (name === undefined || sha === undefined) return [];
      return [
        {
          name,
          sha,
          isCurrent: name === current,
          upstream: upstream === undefined || upstream === "" ? null : upstream,
          ...parseTrack(track ?? ""),
          committedAt: committedAt ?? "",
          subject: subject ?? "",
        },
      ];
    });
  });

  const remoteBranches: RepoRepo["remoteBranches"] = Effect.gen(function* () {
    const refLines = yield* lines(
      "for-each-ref",
      "refs/remotes",
      "--sort=-committerdate",
      `--format=${remoteBranchFormat}`
    );
    return refLines.flatMap((line): Array<RemoteBranchInfo> => {
      const [name, sha, committedAt, subject] = line.split(FIELD_SEP);
      if (name === undefined || sha === undefined) return [];
      if (name.endsWith("/HEAD")) return [];
      const slash = name.indexOf("/");
      return [
        {
          name,
          remote: slash >= 0 ? name.slice(0, slash) : name,
          shortName: slash >= 0 ? name.slice(slash + 1) : name,
          sha,
          committedAt: committedAt ?? "",
          subject: subject ?? "",
        },
      ];
    });
  });

  const log: RepoRepo["log"] = (query) =>
    Effect.suspend(() => {
      const args = [
        "log",
        `--max-count=${query.limit}`,
        `--format=${logFormat}`,
      ];
      if (query.skip > 0) args.push(`--skip=${query.skip}`);
      if (query.author !== null) args.push(`--author=${query.author}`);
      if (query.grep !== null) {
        args.push(`--grep=${query.grep}`);
        args.push(query.regex ? "--extended-regexp" : "--fixed-strings");
        if (!query.caseSensitive) args.push("--regexp-ignore-case");
      }
      if (query.after !== null) args.push(`--after=${query.after}`);
      if (query.before !== null) args.push(`--before=${query.before}`);
      const path =
        query.path !== null && query.path.length > 0 ? query.path : null;
      // `--follow` walks a single file through its renames, but it only works
      // against one starting ref — git rejects it alongside `--all`.
      const follow = path !== null && query.follow && query.ref !== ALL_REFS;
      if (follow) args.push("--follow");
      args.push(query.ref === ALL_REFS ? "--all" : query.ref, "--");
      if (path !== null) args.push(path);
      return lines(...args);
    }).pipe(
      Effect.map((logLines) =>
        logLines.flatMap((line): Array<CommitInfo> => {
          const [sha, shortSha, author, authoredAt, subject, refs, parents] =
            line.split(FIELD_SEP);
          if (sha === undefined || shortSha === undefined) return [];
          return [
            {
              sha,
              shortSha,
              author: author ?? "",
              authoredAt: authoredAt ?? "",
              subject: subject ?? "",
              refs: parseRefs(refs),
              parents: parseParents(parents),
            },
          ];
        })
      )
    );

  // `git grep` exits 1 when nothing matched, so a tolerant run is what keeps an
  // empty result off the error channel.
  const search: RepoRepo["search"] = (query) =>
    Effect.suspend(() =>
      query.query.length === 0
        ? Effect.succeed(EMPTY_CONTENT_MATCHES)
        : runTolerant(...searchArgs(query)).pipe(
            Effect.map((out) => parseContentMatches(out, query.limit))
          )
    );

  const commitDetail: RepoRepo["commitDetail"] = (sha) =>
    Effect.gen(function* () {
      const raw = yield* run("show", "-s", `--format=${detailFormat}`, sha);
      const [
        full,
        short,
        author,
        email,
        authoredAt,
        subject,
        refs,
        parents,
        ...rest
      ] = raw.split(US);
      const fileLines = yield* lines(
        "diff-tree",
        "-r",
        "-M",
        "--no-commit-id",
        "--name-status",
        sha
      );
      return {
        sha: (full ?? sha).trim(),
        shortSha: (short ?? "").trim(),
        author: author ?? "",
        authorEmail: email ?? "",
        authoredAt: authoredAt ?? "",
        subject: subject ?? "",
        body: rest.join(US).trim(),
        refs: parseRefs(refs),
        parents: parseParents(parents),
        files: fileLines
          .map(parseNameStatus)
          .filter((e): e is CommitFileChange => e !== null),
      };
    });

  /**
   * The untracked files, each as the new-file patch `git diff` would print
   * once it was staged. `git diff` reads the working tree against the index
   * or a commit, and a file git has never been told about is in neither, so
   * the uncommitted changes came back without their new files: the tree
   * listed them, but picking one fell out of the diff into the file viewer,
   * and reading the change meant clicking each of them on its own. Diffed
   * one at a time against `/dev/null` — git prints the same header it prints
   * for an added file, so the pane reads them as one diff — and tolerantly,
   * since `--no-index` exits 1 to say the two sides differ.
   */
  const newFilePatch = (path: string) =>
    runTolerant("diff", "--no-index", "--", "/dev/null", path);

  const untrackedPaths = Effect.suspend(() =>
    Effect.map(
      run("ls-files", "--others", "--exclude-standard", "-z"),
      (listing) => listing.split("\0").filter((path) => path.length > 0)
    )
  );

  /**
   * Which of `paths` the tree at `ref` has. An untracked path the base also
   * has is one whose deletion was staged and whose file was then written
   * again (`D ` and `??` at once): `git diff` reports it deleted, and as a
   * new file it would be the same path a second time — which the viewer,
   * keying its items by path, refuses outright.
   */
  const pathsAt = (ref: string, paths: ReadonlyArray<string>) =>
    paths.length === 0
      ? Effect.succeed(new Set<string>())
      : run("ls-tree", "-z", "--name-only", ref, "--", ...paths).pipe(
          Effect.map(
            (listing) =>
              new Set(listing.split("\0").filter((path) => path.length > 0))
          ),
          Effect.catchTag("GitError", () => Effect.succeed(new Set<string>()))
        );

  /**
   * A recreated file as the change it is: the base's version against the one
   * on disk. `--no-index` needs two files, so the base side goes through a
   * scoped temp file, and the header is written for the real path — git
   * would name the temp file.
   */
  const recreatedFilePatch = (ref: string, path: string) =>
    Effect.scoped(
      Effect.gen(function* () {
        const toGitError = fsToGitError(["diff", "--no-index", "--", path]);
        const base = yield* run("show", `${ref}:${path}`);
        const tmp = yield* fs
          .makeTempFileScoped({ prefix: "reviewer-base-" })
          .pipe(Effect.mapError(toGitError));
        yield* fs.writeFileString(tmp, base).pipe(Effect.mapError(toGitError));
        const { hunks } = splitDiffIntoHunks(
          yield* runTolerant("diff", "--no-index", "--", tmp, path)
        );
        if (hunks.length === 0) return "";
        return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n${hunks.join("\n")}\n`;
      })
    );

  const excluding = (paths: ReadonlySet<string>): ReadonlyArray<string> =>
    paths.size === 0
      ? []
      : ["--", ...[...paths].map((path) => `:(exclude,literal)${path}`)];

  /**
   * A working-tree diff against `ref` with its untracked files appended as
   * new files — or, for one `ref` already has, as the change from it.
   */
  const withUntracked = (
    ref: string,
    diff: (pathspec: ReadonlyArray<string>) => Effect.Effect<string, GitFailure>
  ) =>
    Effect.gen(function* () {
      const untracked = yield* untrackedPaths;
      const recreated = yield* pathsAt(ref, untracked);
      const [tracked, patches] = yield* Effect.all(
        [
          diff(excluding(recreated)),
          Effect.all(
            untracked.map((path) =>
              recreated.has(path)
                ? recreatedFilePatch(ref, path)
                : newFilePatch(path)
            ),
            { concurrency: 8 }
          ),
        ],
        { concurrency: "unbounded" }
      );
      return `${tracked}${patches.join("")}`;
    });

  const worktreeDiff: RepoRepo["worktreeDiff"] = withUntracked(
    "HEAD",
    (pathspec) =>
      run("diff", "HEAD", ...pathspec).pipe(
        Effect.catchTag("GitError", () => Effect.succeed(""))
      )
  );

  const mergeBaseWith = (target: string) =>
    Effect.map(run("merge-base", target, "HEAD"), (out) => out.trim());

  const rangeDiff: RepoRepo["rangeDiff"] = (base, head) =>
    run("diff", `${base}...${head}`);

  /**
   * Everything the branch has done, read against what it is aimed at. Diffing
   * the merge base rather than the target itself keeps the target's own later
   * commits out of it — the three-dot answer — and diffing it against the
   * working tree rather than HEAD keeps work that is written but not yet
   * committed in, which is what a task still being worked on consists of.
   */
  const targetDiff: RepoRepo["targetDiff"] = (target) =>
    Effect.flatMap(mergeBaseWith(target), (base) =>
      withUntracked(base, (pathspec) => run("diff", base, ...pathspec))
    );

  const commitDiff: RepoRepo["commitDiff"] = (sha) =>
    run("show", "--format=", "--patch", sha);

  // One side of a diff as a full file. Missing blobs (added/deleted files,
  // unfetched refs, a root commit's parent) resolve to null instead of failing
  // — the client treats a null side as "can't expand this file".
  const showFile = (ref: string, path: string) =>
    run("show", `${ref}:${path}`).pipe(
      Effect.map((contents): string | null => contents),
      Effect.catchTag("GitError", () => Effect.succeed(null))
    );

  const diffFileContents: RepoRepo["diffFileContents"] = (
    target,
    path,
    prevPath
  ) =>
    Effect.gen(function* () {
      const oldPath = prevPath ?? path;
      switch (target.kind) {
        case "worktree": {
          // Old side is HEAD (what `git diff HEAD` diffs against); new side is
          // the file as it sits on disk.
          const oldContents = yield* showFile("HEAD", oldPath);
          const root = (yield* run("rev-parse", "--show-toplevel")).trim();
          const newContents = yield* fs
            .readFileString(`${root}/${path}`)
            .pipe(Effect.catch(() => Effect.succeed<string | null>(null)));
          return { oldContents, newContents };
        }
        case "commit": {
          const oldContents = yield* showFile(`${target.sha}^`, oldPath);
          const newContents = yield* showFile(target.sha, path);
          return { oldContents, newContents };
        }
        case "branch": {
          // Same two sides the branch diff has: the merge base, and the file as
          // it sits on disk right now.
          const base = yield* mergeBaseWith(target.target);
          const oldContents = yield* showFile(base, oldPath);
          const root = (yield* run("rev-parse", "--show-toplevel")).trim();
          const newContents = yield* fs
            .readFileString(`${root}/${path}`)
            .pipe(Effect.catch(() => Effect.succeed<string | null>(null)));
          return { oldContents, newContents };
        }
        case "range": {
          // `rangeDiff` uses the three-dot form, whose old side is the merge
          // base — resolve the same commit so line numbers line up.
          const mergeBase = (yield* run(
            "merge-base",
            target.base,
            target.head
          )).trim();
          const oldContents = yield* showFile(mergeBase, oldPath);
          const newContents = yield* showFile(target.head, path);
          return { oldContents, newContents };
        }
      }
    });

  const checkout: RepoRepo["checkout"] = (branch) =>
    run("checkout", branch).pipe(Effect.asVoid);

  /**
   * A pull request, checked out locally.
   *
   * Fetched by `refs/pull/<n>/head` rather than by branch name: every open pull
   * request has that ref on `origin`, including the ones opened from forks
   * whose branch `origin` has never heard of.
   *
   * An existing local branch of that name is only ever fast-forwarded, never
   * reset: the branch may be one you have been working on, and "check out this
   * pull request" is not permission to throw that away. When it cannot
   * fast-forward, git says so and the checkout fails — which is the right
   * answer, because the two have genuinely diverged.
   */
  const checkoutPull: RepoRepo["checkoutPull"] = (pullNumber, branch) =>
    Effect.gen(function* () {
      yield* run("fetch", "origin", `refs/pull/${pullNumber}/head`);
      const head = (yield* run("rev-parse", "FETCH_HEAD")).trim();
      const existing = (yield* runTolerant(
        "rev-parse",
        "--verify",
        "--quiet",
        `refs/heads/${branch}`
      )).trim();
      if (existing.length === 0) {
        yield* run("checkout", "-b", branch, head);
      } else {
        yield* run("checkout", branch);
        yield* run("merge", "--ff-only", head);
      }
      return branch;
    });

  const createBranch: RepoRepo["createBranch"] = (name, startPoint) =>
    (startPoint === null
      ? run("checkout", "-b", name)
      : run("checkout", "-b", name, startPoint)
    ).pipe(Effect.asVoid);

  const headShortSha = Effect.map(run("rev-parse", "--short", "HEAD"), (out) =>
    out.trim()
  );

  const isUnmatchedPathspec = (error: GitError): boolean =>
    error.stderr.includes("did not match any files");

  // Staging is per-path because a path whose deletion is already staged is
  // present in neither the worktree nor the index, so `git add` rejects its
  // pathspec — and one rejected pathspec aborts the whole batch, staging
  // nothing. That single rejection is safe to ignore: only untracked paths
  // actually need the add, and the pathspec form of `git commit` records the
  // rest from disk. Every other `add` failure (a held index.lock, an
  // unreadable file) must propagate — swallowing it leaves untracked paths
  // unstaged and turns the failure into a misleading "pathspec did not match
  // any file(s) known to git" from the commit that follows.
  const stageOne = (path: string): Effect.Effect<void, GitFailure> =>
    run("add", "-A", "--", path).pipe(
      Effect.asVoid,
      Effect.catchTag("GitError", (error) =>
        isUnmatchedPathspec(error) ? Effect.void : Effect.fail(error)
      )
    );

  const commit: RepoRepo["commit"] = (message, paths) =>
    Effect.gen(function* () {
      if (paths.length === 0) {
        yield* run("add", "-A");
        yield* run("commit", "-m", message);
        return yield* headShortSha;
      }
      yield* Effect.forEach(paths, stageOne, { discard: true });
      yield* run("commit", "-m", message, "--", ...paths);
      return yield* headShortSha;
    });

  // Discard a single path's worktree changes. If the path exists at HEAD we
  // restore both index and worktree to the committed version (reverting
  // modifications, un-deleting deletions, and unstaging). Otherwise it is a new
  // file: unstage it if it was added, then delete it from disk. Per-path Git
  // errors are swallowed so one bad pathspec can't abort the rest of the batch.
  const discardOne = (path: string): Effect.Effect<void, GitFailure> =>
    Effect.gen(function* () {
      const inHead = yield* run("cat-file", "-e", `HEAD:${path}`).pipe(
        Effect.as(true),
        Effect.catchTag("GitError", () => Effect.succeed(false))
      );
      if (inHead) {
        yield* run("checkout", "HEAD", "--", path);
        return;
      }
      // A new file: unstage it if it was added, then remove it from disk.
      yield* run("reset", "-q", "HEAD", "--", path).pipe(
        Effect.catchTag("GitError", () => Effect.void)
      );
      yield* run("clean", "-fdq", "--", path).pipe(
        Effect.catchTag("GitError", () => Effect.void)
      );
    });

  const discard: RepoRepo["discard"] = (paths) =>
    Effect.forEach(paths, discardOne, { discard: true });

  // Revert a single hunk: regenerate the file's HEAD diff, isolate the target
  // hunk (verbatim, so its `@@` line counts stay correct), and reverse-apply just
  // that one to the working tree. `git apply` reads the patch from a file
  // (GitExec has no stdin), so it goes through a scoped temp file.
  const discardHunk: RepoRepo["discardHunk"] = (path, hunkIndex) =>
    Effect.gen(function* () {
      const patch = yield* run("diff", "HEAD", "--", path);
      // An untracked file has no HEAD diff: its one hunk is the whole file, so
      // discarding it is discarding the file — see `newFilePatch`.
      if (patch.length === 0 && hunkIndex === 0) {
        yield* discardOne(path);
        return;
      }
      const { header, hunks } = splitDiffIntoHunks(patch);
      const hunk = hunks[hunkIndex];
      if (header.length === 0 || hunk === undefined) return;
      const single = `${header}\n${hunk}\n`;
      yield* Effect.scoped(
        Effect.gen(function* () {
          const tmp = yield* fs
            .makeTempFileScoped({ prefix: "reviewer-hunk-" })
            .pipe(Effect.mapError(fsToGitError(["apply", "--reverse"])));
          yield* fs
            .writeFileString(tmp, single)
            .pipe(Effect.mapError(fsToGitError(["apply", "--reverse"])));
          yield* run("apply", "--reverse", tmp);
        })
      );
    });

  const push: RepoRepo["push"] = Effect.gen(function* () {
    const upstream = yield* run(
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{upstream}"
    ).pipe(Effect.catchTag("GitError", () => Effect.succeed(null)));
    return upstream === null
      ? yield* runVerbose("push", "-u", "origin", "HEAD")
      : yield* runVerbose("push");
  });

  const pull: RepoRepo["pull"] = runVerbose("pull", "--no-rebase");
  const fetch: RepoRepo["fetch"] = runVerbose("fetch", "--all", "--prune");

  // A conflict is an expected outcome, not an error: if the command left an
  // operation mid-flight, succeed with its message so the UI can show the
  // conflict banner; otherwise (bad ref, etc.) re-fail as before.
  const softOp = (op: Effect.Effect<string, GitFailure>) =>
    op.pipe(
      Effect.catchTag("GitError", (error) =>
        mergeState.pipe(
          Effect.flatMap((state) =>
            state.operation === "none"
              ? Effect.fail(error)
              : Effect.succeed(error.stderr.trim() || error.message)
          )
        )
      )
    );

  const merge: RepoRepo["merge"] = (branch) =>
    softOp(runVerbose("merge", branch));
  const rebase: RepoRepo["rebase"] = (onto) =>
    softOp(runVerbose("rebase", onto));

  // --- conflicts -------------------------------------------------------------
  const gitDir = Effect.map(run("rev-parse", "--absolute-git-dir"), (out) =>
    out.trim()
  );
  const exists = (path: string) =>
    fs.exists(path).pipe(Effect.catch(() => Effect.succeed(false)));
  const readTrim = (path: string) =>
    fs.readFileString(path).pipe(
      Effect.map((s) => s.trim()),
      Effect.catch(() => Effect.succeed<string | null>(null))
    );
  /** A friendly name for a ref/commit, falling back to its short sha. */
  const nameRev = (ref: string) =>
    run("name-rev", "--name-only", "--no-undefined", ref).pipe(
      Effect.map((out) => out.trim()),
      Effect.flatMap((name) =>
        name.length > 0
          ? Effect.succeed(name)
          : Effect.map(run("rev-parse", "--short", ref), (s) => s.trim())
      ),
      Effect.catchTag("GitError", () =>
        Effect.map(run("rev-parse", "--short", ref), (s) => s.trim()).pipe(
          Effect.catchTag("GitError", () => Effect.succeed(ref))
        )
      )
    );

  const conflictedFiles: Effect.Effect<
    ReadonlyArray<ConflictedFile>,
    GitFailure
  > = run("status", "--porcelain=2", "--untracked-files=no").pipe(
    Effect.map((out) =>
      out
        .split("\n")
        .filter((line) => line.startsWith("u "))
        .flatMap((line): Array<ConflictedFile> => {
          // u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
          // 9 space-separated fields precede the (possibly space-containing) path.
          const fields = line.slice(2).split(" ");
          const xy = fields[0] ?? "";
          const path = fields.slice(9).join(" ");
          return path.length === 0
            ? []
            : [{ path, kind: conflictKindFromXY(xy) }];
        })
    )
  );

  const mergeState: RepoRepo["mergeState"] = Effect.gen(function* () {
    const dir = yield* gitDir;
    const conflicted = yield* conflictedFiles;
    const none: MergeState = {
      operation: "none",
      incoming: null,
      onto: null,
      conflicted,
    };

    if (yield* exists(`${dir}/MERGE_HEAD`)) {
      const msg = yield* readTrim(`${dir}/MERGE_MSG`);
      const quoted = msg?.match(/'([^']+)'/)?.[1];
      const incoming = quoted ?? (yield* nameRev("MERGE_HEAD"));
      const onto = yield* run("rev-parse", "--abbrev-ref", "HEAD").pipe(
        Effect.map((s) => s.trim()),
        Effect.catchTag("GitError", () => Effect.succeed(""))
      );
      return { ...none, operation: "merge", incoming, onto: onto || null };
    }

    const rebaseMerge = yield* exists(`${dir}/rebase-merge`);
    const rebaseApply = yield* exists(`${dir}/rebase-apply`);
    if (rebaseMerge || rebaseApply) {
      const base = `${dir}/${rebaseMerge ? "rebase-merge" : "rebase-apply"}`;
      const headName = yield* readTrim(`${base}/head-name`);
      const ontoSha = yield* readTrim(`${base}/onto`);
      const incoming = headName?.replace(/^refs\/heads\//, "") ?? null;
      const onto: string | null =
        ontoSha === null || ontoSha.length === 0
          ? null
          : yield* nameRev(ontoSha);
      return { ...none, operation: "rebase", incoming, onto };
    }

    if (yield* exists(`${dir}/CHERRY_PICK_HEAD`)) {
      const incoming = yield* nameRev("CHERRY_PICK_HEAD");
      return { ...none, operation: "cherry-pick", incoming };
    }

    if (yield* exists(`${dir}/REVERT_HEAD`)) {
      const incoming = yield* nameRev("REVERT_HEAD");
      return { ...none, operation: "revert", incoming };
    }

    return none;
  });

  const showStage = (stage: 1 | 2 | 3, path: string) =>
    run("show", `:${stage}:${path}`).pipe(
      Effect.catchTag("GitError", () => Effect.succeed(""))
    );

  const conflictBlobs: RepoRepo["conflictBlobs"] = (path) =>
    Effect.gen(function* () {
      const [base, ours, theirs] = yield* Effect.all(
        [showStage(1, path), showStage(2, path), showStage(3, path)],
        { concurrency: "unbounded" }
      );
      return { path, base: base.length === 0 ? null : base, ours, theirs };
    });

  const resolveConflict: RepoRepo["resolveConflict"] = (path, resolution) =>
    Effect.gen(function* () {
      if (resolution !== "content") {
        // The chosen side may not exist (e.g. a deletion) — ignore that and let
        // `git add -A` record whatever the checkout produced on disk.
        yield* run(
          "checkout",
          resolution === "ours" ? "--ours" : "--theirs",
          "--",
          path
        ).pipe(Effect.catchTag("GitError", () => Effect.void));
      }
      // `-A` so a path the user deleted to resolve the conflict stages as a
      // deletion rather than failing with "did not match any files".
      yield* run("add", "-A", "--", path).pipe(Effect.asVoid);
    });

  const abortMerge: RepoRepo["abortMerge"] = mergeState.pipe(
    Effect.flatMap((state) => {
      switch (state.operation) {
        case "rebase":
          return runVerbose("rebase", "--abort");
        case "cherry-pick":
          return runVerbose("cherry-pick", "--abort");
        case "revert":
          return runVerbose("revert", "--abort");
        case "merge":
          return runVerbose("merge", "--abort");
        case "none":
          return Effect.succeed("Nothing to abort");
      }
    })
  );

  const continueMerge: RepoRepo["continueMerge"] = mergeState.pipe(
    Effect.flatMap((state) => {
      // `-c core.editor=true` keeps the prepared message and never blocks on an
      // interactive editor.
      switch (state.operation) {
        case "rebase":
          return runVerbose("-c", "core.editor=true", "rebase", "--continue");
        case "merge":
        case "cherry-pick":
        case "revert":
          return runVerbose("-c", "core.editor=true", "commit", "--no-edit");
        case "none":
          return Effect.succeed("Nothing to continue");
      }
    })
  );

  const renameBranch: RepoRepo["renameBranch"] = (from, to) =>
    run("branch", "-m", from, to).pipe(Effect.asVoid);

  const deleteBranch: RepoRepo["deleteBranch"] = (name, force) =>
    run("branch", force ? "-D" : "-d", name).pipe(Effect.asVoid);

  return {
    info,
    identity,
    files,
    status,
    branches,
    remoteBranches,
    log,
    search,
    commitDetail,
    worktreeDiff,
    targetDiff,
    rangeDiff,
    commitDiff,
    diffFileContents,
    checkout,
    checkoutPull,
    createBranch,
    commit,
    discard,
    discardHunk,
    push,
    pull,
    fetch,
    merge,
    rebase,
    mergeState,
    conflictBlobs,
    resolveConflict,
    abortMerge,
    continueMerge,
    renameBranch,
    deleteBranch,
  } satisfies RepoRepo;
});
