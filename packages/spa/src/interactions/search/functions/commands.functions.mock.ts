import type { CodeCommandDependencies, CodeRoute } from "./commands.functions";

export function mockCodeCommandDependencies(
  data: Partial<CodeCommandDependencies["data"]> = {},
  branchName: string | null = "feature/search"
) {
  const calls = {
    goTo: [] as Array<CodeRoute>,
    ran: [] as Array<string>,
    createBranch: [] as Array<{ name: string; startPoint: string | null }>,
  };

  const deps: CodeCommandDependencies = {
    data: { hasGitHub: true, currentBranch: "main", ...data },
    sideEffects: {
      goTo: (route) => calls.goTo.push(route),
      refresh: () => calls.ran.push("refresh"),
      fetch: () => calls.ran.push("fetch"),
      pull: () => calls.ran.push("pull"),
      push: () => calls.ran.push("push"),
      createBranch: (name, startPoint) =>
        calls.createBranch.push({ name, startPoint }),
      askForBranchName: () => Promise.resolve(branchName),
    },
  };

  return { deps, calls };
}
