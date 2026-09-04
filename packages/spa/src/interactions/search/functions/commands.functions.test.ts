import { describe, expect, it } from "vitest";
import { buildCodeCommands } from "./commands.functions";
import { mockCodeCommandDependencies } from "./commands.functions.mock";

// Commands that ask something first answer on a later microtask, so running
// one always yields before the assertions read what it did.
const run = async (
  id: string,
  deps: Parameters<typeof buildCodeCommands>[0]
) => {
  const command = buildCodeCommands(deps).find((c) => c.id === id);
  if (command === undefined) throw new Error(`no command ${id}`);
  command.run();
  await Promise.resolve();
  await Promise.resolve();
};

describe("buildCodeCommands", () => {
  it("offers the code pages and the git actions", () => {
    const { deps } = mockCodeCommandDependencies();

    const groups = new Set(buildCodeCommands(deps).map((c) => c.group));

    expect([...groups]).toEqual(["Navigation", "Git"]);
  });

  it("navigates to the page a command names", async () => {
    const { deps, calls } = mockCodeCommandDependencies();

    await run("go-browse", deps);
    await run("go-settings", deps);

    expect(calls.goTo).toEqual(["/modes/code/browse", "/settings"]);
  });

  it("offers the reviews list with or without a GitHub remote — worktrees are on it too", () => {
    const withHub = mockCodeCommandDependencies({ hasGitHub: true });
    const withoutHub = mockCodeCommandDependencies({ hasGitHub: false });

    for (const { deps } of [withHub, withoutHub]) {
      expect(buildCodeCommands(deps).map((c) => c.id)).toContain("go-reviews");
    }
  });

  it("runs the git action behind each git command", async () => {
    const { deps, calls } = mockCodeCommandDependencies();

    for (const id of ["git-refresh", "git-fetch", "git-pull", "git-push"]) {
      await run(id, deps);
    }

    expect(calls.ran).toEqual(["refresh", "fetch", "pull", "push"]);
  });

  it("branches from the current branch, trimming the name it was given", async () => {
    const { deps, calls } = mockCodeCommandDependencies({}, "  feature/x  ");

    await run("git-branch", deps);

    expect(calls.createBranch).toEqual([
      { name: "feature/x", startPoint: "main" },
    ]);
  });

  it("creates nothing when the branch name is blank or cancelled", async () => {
    const cancelled = mockCodeCommandDependencies({}, null);
    const blank = mockCodeCommandDependencies({}, "   ");

    await run("git-branch", cancelled.deps);
    await run("git-branch", blank.deps);

    expect(cancelled.calls.createBranch).toEqual([]);
    expect(blank.calls.createBranch).toEqual([]);
  });
});
