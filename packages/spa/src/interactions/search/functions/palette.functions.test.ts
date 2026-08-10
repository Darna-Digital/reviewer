import { describe, expect, it } from "vitest";
import type {
  BranchInfo,
  Command,
  RemoteBranchInfo,
} from "../interfaces/search.interfaces";
import {
  branchChoices,
  commandsIn,
  crumbsFor,
  filterBranches,
  filterCommands,
  filterFiles,
  fuzzyScore,
  splitPath,
  submenusIn,
} from "./palette.functions";

const Icon = () => null;
const command = (over: Partial<Command> = {}): Command => ({
  id: "git-push",
  label: "Push",
  group: "Git",
  icon: Icon,
  keywords: "remote upload",
  run: () => {},
  ...over,
});

const COMMANDS: ReadonlyArray<Command> = [
  command({ submenu: "git" }),
  command({
    id: "git-pull",
    label: "Pull",
    keywords: "remote update",
    submenu: "git",
  }),
  command({
    id: "go-settings",
    label: "Open Settings",
    group: "Navigation",
    keywords: "theme appearance",
  }),
];

const branch = (over: Partial<BranchInfo> = {}): BranchInfo => ({
  name: "master",
  sha: "a1",
  isCurrent: false,
  upstream: "origin/master",
  ahead: 0,
  behind: 0,
  committedAt: "2026-08-10",
  subject: "latest",
  ...over,
});

const remoteBranch = (
  over: Partial<RemoteBranchInfo> = {}
): RemoteBranchInfo => ({
  name: "origin/release",
  remote: "origin",
  shortName: "release",
  sha: "c3",
  committedAt: "2026-08-10",
  subject: "cut",
  ...over,
});

const PATHS = [
  "packages/spa/src/lib/queries.ts",
  "packages/spa/src/components/layout/app-shell.tsx",
  "packages/core/src/features/repo/schema/repo.schema.ts",
];

describe("crumbsFor", () => {
  it("roots every trail in the command list", () => {
    expect(crumbsFor("commands")).toEqual([
      { mode: "commands", label: "Commands" },
    ]);
    expect(crumbsFor("files")).toEqual([
      { mode: "commands", label: "Commands" },
      { mode: "files", label: "Files" },
    ]);
    expect(crumbsFor("text").at(-1)).toEqual({ mode: "text", label: "Text" });
  });

  it("walks the whole way up from a list nested inside another", () => {
    expect(crumbsFor("branches")).toEqual([
      { mode: "commands", label: "Commands" },
      { mode: "git", label: "Git" },
      { mode: "branches", label: "Branches" },
    ]);
  });
});

describe("submenusIn / commandsIn", () => {
  it("offers a list only the rows that live in it", () => {
    expect(submenusIn("commands", "").map((s) => s.mode)).toEqual([
      "files",
      "text",
      "git",
    ]);
    expect(submenusIn("git", "").map((s) => s.mode)).toEqual(["branches"]);
    expect(commandsIn("git", COMMANDS, "").map((c) => c.id)).toEqual([
      "git-push",
      "git-pull",
    ]);
    expect(commandsIn("commands", COMMANDS, "").map((c) => c.id)).toEqual([
      "go-settings",
    ]);
  });

  it("reaches into every list once something is typed at the root", () => {
    expect(commandsIn("commands", COMMANDS, "push").map((c) => c.id)).toEqual(
      COMMANDS.map((c) => c.id)
    );
    expect(submenusIn("commands", "branch").map((s) => s.mode)).toContain(
      "branches"
    );
  });

  it("keeps a nested list to itself even while searching", () => {
    expect(commandsIn("git", COMMANDS, "settings").map((c) => c.id)).toEqual([
      "git-push",
      "git-pull",
    ]);
  });
});

describe("branchChoices", () => {
  it("puts the branch you are on first, and says so", () => {
    const [first] = branchChoices(
      [branch({ name: "task/BMB-207" }), branch({ isCurrent: true })],
      []
    );

    expect(first).toMatchObject({ name: "master", hint: "current" });
  });

  it("notes how far a branch has drifted from its upstream", () => {
    const [only] = branchChoices([branch({ ahead: 2, behind: 1 })], []);

    expect(only.hint).toBe("↑2 ↓1");
  });

  it("checks a remote branch out by its tracking name", () => {
    const [only] = branchChoices([], [remoteBranch()]);

    expect(only).toMatchObject({
      name: "origin/release",
      ref: "release",
      group: "Remote",
      hint: "origin",
    });
  });

  it("drops a remote branch that is already checked out locally", () => {
    const choices = branchChoices(
      [branch({ name: "release" })],
      [remoteBranch(), remoteBranch({ name: "origin/next", shortName: "next" })]
    );

    expect(choices.map((c) => c.name)).toEqual(["release", "origin/next"]);
  });

  it("leaves the branches it was given alone", () => {
    const local = [
      branch({ name: "task/BMB-207" }),
      branch({ isCurrent: true }),
    ];

    branchChoices(local, []);

    expect(local[0].name).toBe("task/BMB-207");
  });
});

describe("filterBranches", () => {
  const CHOICES = branchChoices(
    [branch({ isCurrent: true }), branch({ name: "task/BMB-207" })],
    [remoteBranch()]
  );

  it("lists everything until something is typed", () => {
    expect(filterBranches(CHOICES, "")).toHaveLength(3);
  });

  it("matches on any part of the name", () => {
    expect(filterBranches(CHOICES, "207").map((b) => b.name)).toEqual([
      "task/BMB-207",
    ]);
  });

  it("caps how many branches come back", () => {
    const many = branchChoices(
      Array.from({ length: 100 }, (_, i) => branch({ name: `task/${i}` })),
      []
    );

    expect(filterBranches(many, "task", 40)).toHaveLength(40);
  });
});

describe("fuzzyScore", () => {
  it("matches characters in order, anywhere in the text", () => {
    expect(fuzzyScore("app-shell.tsx", "apsh")).not.toBeNull();
    expect(fuzzyScore("app-shell.tsx", "shap")).toBeNull();
  });

  it("ignores case", () => {
    expect(fuzzyScore("App-Shell", "apsh")).not.toBeNull();
  });

  it("matches everything on an empty query", () => {
    expect(fuzzyScore("anything", "")).toBe(0);
  });

  it("scores a tighter match better than a spread-out one", () => {
    expect(fuzzyScore("qs.ts", "qs")).toBeLessThan(
      fuzzyScore("queries.ts", "qs")!
    );
  });

  it("scores an earlier match better than a later one", () => {
    expect(fuzzyScore("app.ts", "app")).toBeLessThan(
      fuzzyScore("src/app.ts", "app")!
    );
  });
});

describe("filterCommands", () => {
  it("finds a command by its hidden keywords", () => {
    const found = filterCommands(COMMANDS, "appearance");

    expect(found.map((c) => c.id)).toEqual(["go-settings"]);
  });

  it("ranks a command matched by its group above a loose subsequence hit", () => {
    const found = filterCommands(COMMANDS, "git").map((c) => c.id);

    expect(found.slice(0, 2)).toEqual(["git-push", "git-pull"]);
  });

  it("keeps every command when nothing is typed", () => {
    expect(filterCommands(COMMANDS, "")).toHaveLength(COMMANDS.length);
  });

  it("drops what does not match", () => {
    expect(filterCommands(COMMANDS, "zzzz")).toEqual([]);
  });
});

describe("filterFiles", () => {
  it("matches on any part of the path", () => {
    expect(filterFiles(PATHS, "queries")).toEqual([
      "packages/spa/src/lib/queries.ts",
    ]);
  });

  it("returns nothing until something is typed", () => {
    expect(filterFiles(PATHS, "")).toEqual([]);
    expect(filterFiles(PATHS, "   ")).toEqual([]);
  });

  it("caps how many paths come back", () => {
    const many = Array.from({ length: 100 }, (_, i) => `src/file-${i}.ts`);

    expect(filterFiles(many, "src", 40)).toHaveLength(40);
  });

  it("puts the closest match first", () => {
    const [best] = filterFiles(PATHS, "repo.schema");

    expect(best).toBe("packages/core/src/features/repo/schema/repo.schema.ts");
  });
});

describe("splitPath", () => {
  it("separates the directory from the file name", () => {
    expect(splitPath("packages/spa/src/lib/queries.ts")).toEqual({
      directory: "packages/spa/src/lib/",
      name: "queries.ts",
    });
  });

  it("leaves a bare file name whole", () => {
    expect(splitPath("README.md")).toEqual({
      directory: "",
      name: "README.md",
    });
  });
});
