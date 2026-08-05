import { describe, expect, it } from "vitest";
import { buildCodeCommands } from "./commands.functions";
import { mockCodeCommandDependencies } from "./commands.functions.mock";

const run = (id: string, deps: Parameters<typeof buildCodeCommands>[0]) => {
  const command = buildCodeCommands(deps).find((c) => c.id === id);
  if (command === undefined) throw new Error(`no command ${id}`);
  command.run();
};

describe("buildCodeCommands", () => {
  it("offers the code pages and the git actions", () => {
    const { deps } = mockCodeCommandDependencies();

    const groups = new Set(buildCodeCommands(deps).map((c) => c.group));

    expect([...groups]).toEqual(["Navigation", "Git"]);
  });

  it("navigates to the page a command names", () => {
    const { deps, calls } = mockCodeCommandDependencies();

    run("go-browse", deps);
    run("go-settings", deps);

    expect(calls.goTo).toEqual(["/modes/code/browse", "/settings"]);
  });

  it("only offers pull requests when the repo has a GitHub remote", () => {
    const withHub = mockCodeCommandDependencies({ hasGitHub: true });
    const withoutHub = mockCodeCommandDependencies({ hasGitHub: false });

    expect(buildCodeCommands(withHub.deps).map((c) => c.id)).toContain(
      "go-review"
    );
    expect(buildCodeCommands(withoutHub.deps).map((c) => c.id)).not.toContain(
      "go-review"
    );
  });

  it("runs the git action behind each git command", () => {
    const { deps, calls } = mockCodeCommandDependencies();

    for (const id of ["git-refresh", "git-fetch", "git-pull", "git-push"]) {
      run(id, deps);
    }

    expect(calls.ran).toEqual(["refresh", "fetch", "pull", "push"]);
  });

  it("branches from the current branch, trimming the name it was given", () => {
    const { deps, calls } = mockCodeCommandDependencies({}, "  feature/x  ");

    run("git-branch", deps);

    expect(calls.createBranch).toEqual([
      { name: "feature/x", startPoint: "main" },
    ]);
  });

  it("creates nothing when the branch name is blank or cancelled", () => {
    const cancelled = mockCodeCommandDependencies({}, null);
    const blank = mockCodeCommandDependencies({}, "   ");

    run("git-branch", cancelled.deps);
    run("git-branch", blank.deps);

    expect(cancelled.calls.createBranch).toEqual([]);
    expect(blank.calls.createBranch).toEqual([]);
  });
});
