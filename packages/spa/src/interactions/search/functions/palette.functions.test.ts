import { describe, expect, it } from "vitest";
import type { Command } from "../interfaces/search.interfaces";
import {
  crumbsFor,
  filterCommands,
  filterFiles,
  fuzzyScore,
  splitPath,
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
  command(),
  command({ id: "git-pull", label: "Pull", keywords: "remote update" }),
  command({
    id: "go-settings",
    label: "Open Settings",
    group: "Navigation",
    keywords: "theme appearance",
  }),
];

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
