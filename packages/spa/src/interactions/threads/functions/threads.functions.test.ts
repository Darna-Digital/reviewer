import { describe, expect, it } from "vitest";
import { createThreadsFunctions } from "./threads.functions";
import { mockThreadsDependencies } from "./threads.functions.mock";

describe("threads functions", () => {
  it("create passes the agent, trims the title, and drops it when blank", async () => {
    const { deps, calls } = mockThreadsDependencies();
    const fns = createThreadsFunctions(deps);
    await fns.create("terminal", "  ", "main");
    await fns.create("claude", "  Build  ", "feat");
    expect(calls.create).toEqual([
      { title: undefined, agent: "terminal", branch: "main" },
      { title: "Build", agent: "claude", branch: "feat" },
    ]);
  });

  it("run skips blank commands and trims the rest", async () => {
    const { deps, calls } = mockThreadsDependencies();
    const fns = createThreadsFunctions(deps);
    expect(await fns.run("t-1", "   ")).toBeNull();
    await fns.run("t-1", "  ls -la ");
    expect(calls.run).toEqual([{ id: "t-1", command: "ls -la" }]);
  });

  it("setBranch keeps the current title and edits only the branch", async () => {
    const { deps, calls } = mockThreadsDependencies();
    const fns = createThreadsFunctions(deps);
    await fns.setBranch("t-1", "Build", "feat");
    expect(calls.rename).toEqual([
      { id: "t-1", input: { title: "Build", branch: "feat" } },
    ]);
  });
});
