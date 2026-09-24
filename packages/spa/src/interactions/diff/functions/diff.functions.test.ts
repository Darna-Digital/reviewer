import { describe, expect, it } from "vitest";
import type { FileDiffMetadata } from "@pierre/diffs";
import type { ReviewComment } from "@reviewer/core/comments";
import {
  unenrichedPull,
  type PullRequestInfo,
} from "@reviewer/core/ports/git-provider";
import type { GitStatusEntry } from "@reviewer/core/repo";
import { createDiffFunctions } from "./diff.functions";
import { createDiffDependenciesMock } from "./diff.functions.mock";

const fns = () => createDiffFunctions(createDiffDependenciesMock());

const pull = (number: number): PullRequestInfo => ({
  ...unenrichedPull,
  number,
  title: "t",
  author: "a",
  baseRef: "main",
  headRef: "f",
  headSha: "s",
  url: "u",
  updatedAt: "",
});

describe("deriveTarget", () => {
  it("commit mode → worktree", () => {
    expect(
      fns().deriveTarget({ mode: "commit", selectedPull: null, browse: null })
    ).toEqual({
      kind: "worktree",
    });
  });

  it("review mode needs a selected pull", () => {
    expect(
      fns().deriveTarget({ mode: "review", selectedPull: null, browse: null })
    ).toBeNull();
    expect(
      fns().deriveTarget({
        mode: "review",
        selectedPull: pull(7),
        browse: null,
      })
    ).toEqual({ kind: "pull", pull: pull(7) });
  });

  it("browse commit / range map through", () => {
    expect(
      fns().deriveTarget({
        mode: "browse",
        selectedPull: null,
        browse: { kind: "commit", sha: "abc", shortSha: "abc1234" },
      })
    ).toEqual({ kind: "commit", sha: "abc", shortSha: "abc1234" });
    expect(
      fns().deriveTarget({
        mode: "browse",
        selectedPull: null,
        browse: { kind: "range", base: "main", head: "feat" },
      })
    ).toEqual({ kind: "range", base: "main", head: "feat" });
  });
});

describe("parseFiles", () => {
  it("returns [] for empty/whitespace and never throws", () => {
    expect(fns().parseFiles(null)).toEqual([]);
    expect(fns().parseFiles("   ")).toEqual([]);
  });
  it("delegates to the injected parser", () => {
    const files = fns().parseFiles("+++ b/src/a.ts\n+++ b/src/b.ts");
    expect(files.map((f) => f.name)).toEqual(["src/a.ts", "src/b.ts"]);
  });
  it("drops the app's own files", () => {
    const files = fns().parseFiles(
      "+++ b/src/a.ts\n+++ b/.reviewer/comments.json"
    );
    expect(files.map((f) => f.name)).toEqual(["src/a.ts"]);
  });
});

describe("tree derivations", () => {
  /** Parsed diff entries, as only their names and change type matter here. */
  const file = (...names: ReadonlyArray<string>) =>
    names.map(
      (name) => ({ name, type: "modified" }) as unknown as FileDiffMetadata
    );

  const status: GitStatusEntry[] = [
    { path: "src/a.ts", status: "modified" },
    { path: ".reviewer/comments.json", status: "modified" },
  ];

  it("commit mode lists only changed, non-internal paths", () => {
    const paths = fns().treePaths({
      mode: "commit",
      allPaths: ["src/a.ts", "src/b.ts", ".reviewer/comments.json"],
      gitStatus: status,
      parsedFiles: [],
    });
    expect(paths).toEqual(["src/a.ts"]);
  });

  it("commit mode also lists commented-but-unchanged paths", () => {
    const paths = fns().treePaths({
      mode: "commit",
      allPaths: ["src/a.ts", "src/b.ts", "src/c.ts"],
      gitStatus: [{ path: "src/a.ts", status: "modified" }],
      parsedFiles: [],
      commentedPaths: ["src/c.ts"],
    });
    expect(paths).toEqual(["src/a.ts", "src/c.ts"]);
  });

  it("read against a branch, lists the comparison's files too", () => {
    const paths = fns().treePaths({
      mode: "commit",
      allPaths: ["src/a.ts", "src/committed.ts", "src/untouched.ts"],
      // Only `src/a.ts` is uncommitted; `src/committed.ts` was changed by a
      // commit earlier on the branch and has been quiet since.
      gitStatus: [{ path: "src/a.ts", status: "modified" }],
      parsedFiles: file("src/a.ts", "src/committed.ts"),
      comparing: true,
    });
    expect(paths).toEqual(["src/a.ts", "src/committed.ts"]);
  });

  it("keeps a file the branch deleted, which is in no file list", () => {
    const paths = fns().treePaths({
      mode: "commit",
      allPaths: ["src/a.ts"],
      gitStatus: [],
      parsedFiles: file("src/a.ts", "src/gone.ts"),
      comparing: true,
    });
    expect(paths).toEqual(["src/a.ts", "src/gone.ts"]);
  });

  it("ignores the comparison's files when nothing is being compared", () => {
    const paths = fns().treePaths({
      mode: "commit",
      allPaths: ["src/a.ts", "src/committed.ts"],
      gitStatus: [{ path: "src/a.ts", status: "modified" }],
      parsedFiles: file("src/a.ts", "src/committed.ts"),
    });
    expect(paths).toEqual(["src/a.ts"]);
  });

  it("badges a compared file from the diff, and keeps untracked ones", () => {
    const badges = fns().treeGitStatus({
      mode: "commit",
      allPaths: [],
      gitStatus: [
        { path: "src/a.ts", status: "modified" },
        { path: "src/new.ts", status: "untracked" },
        { path: ".reviewer/comments.json", status: "modified" },
      ],
      parsedFiles: file("src/a.ts", "src/committed.ts", "src/new.ts"),
      comparing: true,
    });
    expect(badges).toEqual([
      { path: "src/a.ts", status: "modified" },
      { path: "src/committed.ts", status: "modified" },
      // The diff carries the untracked file as a new one; its own badge stands.
      { path: "src/new.ts", status: "untracked" },
    ]);
  });

  it("browse mode lists every non-internal path", () => {
    const paths = fns().treePaths({
      mode: "browse",
      allPaths: ["src/a.ts", ".reviewer/x"],
      gitStatus: [],
      parsedFiles: [],
    });
    expect(paths).toEqual(["src/a.ts"]);
  });

  it("changedFiles strips the internal dir", () => {
    expect(
      fns()
        .changedFiles(status)
        .map((e) => e.path)
    ).toEqual(["src/a.ts"]);
  });
});

describe("visibleComments", () => {
  const local: ReviewComment[] = [
    {
      id: "1",
      filePath: "a",
      side: "additions",
      lineNumber: 1,
      body: "",
      author: "",
      createdAt: "",
      target: "worktree",
      source: "local",
    },
    {
      id: "2",
      filePath: "a",
      side: "additions",
      lineNumber: 2,
      body: "",
      author: "",
      createdAt: "",
      target: "commit-x",
      source: "local",
    },
  ];

  it("filters local comments by target key", () => {
    const out = fns().visibleComments({
      targetKind: "worktree",
      targetKey: "worktree",
      localComments: local,
      pullComments: [],
      viewingFile: null,
    });
    expect(out.map((c) => c.id)).toEqual(["1"]);
  });

  it("uses pull comments for a pull target", () => {
    const pr: ReviewComment[] = [
      { ...local[0], id: "pr1", source: "github", target: "pr-3" },
    ];
    const out = fns().visibleComments({
      targetKind: "pull",
      targetKey: "pr-3",
      localComments: local,
      pullComments: pr,
      viewingFile: null,
    });
    expect(out.map((c) => c.id)).toEqual(["pr1"]);
  });

  it("counts worktree comments while a file is open in the viewer", () => {
    // Browsing a commit, with a file open: the viewer writes worktree
    // comments, so they have to be visible or the bar never appears.
    const out = fns().visibleComments({
      targetKind: "commit",
      targetKey: "commit-x",
      localComments: local,
      pullComments: [],
      viewingFile: "a",
    });
    expect(out.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("does not repeat a comment that is already on target", () => {
    const out = fns().visibleComments({
      targetKind: "worktree",
      targetKey: "worktree",
      localComments: local,
      pullComments: [],
      viewingFile: "a",
    });
    expect(out.map((c) => c.id)).toEqual(["1"]);
  });

  it("still shows only the pull's own comments with a file open", () => {
    const pr: ReviewComment[] = [
      { ...local[0], id: "pr1", source: "github", target: "pr-3" },
    ];
    const out = fns().visibleComments({
      targetKind: "pull",
      targetKey: "pr-3",
      localComments: local,
      pullComments: pr,
      viewingFile: "a",
    });
    expect(out.map((c) => c.id)).toEqual(["pr1"]);
  });
});
