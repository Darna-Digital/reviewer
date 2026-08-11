import { describe, expect, it, vi } from "vitest";
import { createWorkspaceFunctions, repoCommands } from "./workspace.functions";
import {
  createWorkspaceDependenciesMock,
  multiRepoWorkspace,
} from "./workspace.functions.mock";

describe("followRepo", () => {
  it("costs nothing when the root is already current", async () => {
    const deps = createWorkspaceDependenciesMock();
    const fns = createWorkspaceFunctions(deps);

    expect(await fns.followRepo("/work/backend", "/work/backend")).toBe(true);
    expect(deps.sideEffects.setRepo).not.toHaveBeenCalled();
  });

  it("switches to the root before it is acted on", async () => {
    const deps = createWorkspaceDependenciesMock();
    const fns = createWorkspaceFunctions(deps);

    expect(await fns.followRepo("/work/frontend", "/work/backend")).toBe(true);
    expect(deps.sideEffects.setRepo).toHaveBeenCalledWith("/work/frontend");
  });

  it("reports a root that could not be followed", async () => {
    const deps = createWorkspaceDependenciesMock({
      setRepo: vi.fn(async () => {
        throw { reason: "gone" };
      }),
    });
    expect(
      await createWorkspaceFunctions(deps).followRepo("/work/gone", "/work/a")
    ).toBe(false);
  });
});

describe("repoCommands", () => {
  it("offers every root except the one already being followed", () => {
    const commands = repoCommands(multiRepoWorkspace);
    expect(commands.map((command) => command.label)).toEqual([
      "Switch to frontend",
    ]);
    expect(commands[0]?.path).toBe("/work/frontend");
  });

  it("offers nothing for a project holding a single root", () => {
    expect(
      repoCommands({
        ...multiRepoWorkspace,
        repos: multiRepoWorkspace.repos.slice(0, 1),
      })
    ).toEqual([]);
  });

  it("offers nothing before the workspace has loaded", () => {
    expect(repoCommands(undefined)).toEqual([]);
  });
});

describe("openProject", () => {
  it("opens the folder and reloads everything around it", async () => {
    const deps = createWorkspaceDependenciesMock();
    const fns = createWorkspaceFunctions(deps);

    const info = await fns.openProject("/work");

    expect(deps.sideEffects.setProject).toHaveBeenCalledWith("/work");
    expect(deps.sideEffects.cacheWorkspace).toHaveBeenCalledWith(
      multiRepoWorkspace
    );
    expect(deps.sideEffects.invalidateAll).toHaveBeenCalled();
    expect(info?.current).toBe("/work/backend");
  });

  it("reports the server's reason and changes nothing when refused", async () => {
    const deps = createWorkspaceDependenciesMock({
      setProject: vi.fn(async () => {
        throw { _tag: "InvalidRepo", reason: "not a directory" };
      }),
    });
    const fns = createWorkspaceFunctions(deps);

    expect(await fns.openProject("/nope")).toBeNull();
    expect(deps.sideEffects.notifyError).toHaveBeenCalledWith(
      "not a directory"
    );
    expect(deps.sideEffects.cacheWorkspace).not.toHaveBeenCalled();
    expect(deps.sideEffects.invalidateAll).not.toHaveBeenCalled();
  });

  it("falls back to a plain message when the failure carries none", async () => {
    const deps = createWorkspaceDependenciesMock({
      setProject: vi.fn(async () => {
        throw {};
      }),
    });
    await createWorkspaceFunctions(deps).openProject("/nope");
    expect(deps.sideEffects.notifyError).toHaveBeenCalledWith(
      "could not open project"
    );
  });
});

describe("openRepo", () => {
  it("moves the git views to another root of the open project", async () => {
    const deps = createWorkspaceDependenciesMock();
    const fns = createWorkspaceFunctions(deps);

    const info = await fns.openRepo("/work/frontend");

    expect(deps.sideEffects.setRepo).toHaveBeenCalledWith("/work/frontend");
    expect(info?.current).toBe("/work/frontend");
    // The project itself stays open — only what is repo-scoped is reloaded.
    expect(info?.project).toBe("/work");
    expect(deps.sideEffects.invalidateAll).toHaveBeenCalled();
  });

  it("reloads the repository identity before everything else", async () => {
    const order: Array<string> = [];
    const deps = createWorkspaceDependenciesMock({
      refreshRepo: vi.fn(async () => void order.push("refreshRepo")),
      settle: vi.fn(async () => void order.push("settle")),
      invalidateAll: vi.fn(async () => void order.push("invalidateAll")),
    });

    await createWorkspaceFunctions(deps).openRepo("/work/frontend");

    // The other views name branches and paths that belong to the root being
    // left; reloading them first would ask the arriving root about those.
    expect(order).toEqual(["refreshRepo", "settle", "invalidateAll"]);
  });

  it("reports a root the project no longer holds", async () => {
    const deps = createWorkspaceDependenciesMock({
      setRepo: vi.fn(async () => {
        throw { reason: "not a repository in the open project" };
      }),
    });
    const fns = createWorkspaceFunctions(deps);

    expect(await fns.openRepo("/work/gone")).toBeNull();
    expect(deps.sideEffects.notifyError).toHaveBeenCalledWith(
      "not a repository in the open project"
    );
  });
});
