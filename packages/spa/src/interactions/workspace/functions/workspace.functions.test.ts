import { describe, expect, it, vi } from "vitest";
import { createWorkspaceFunctions } from "./workspace.functions";
import {
  createWorkspaceDependenciesMock,
  openWorkspace,
} from "./workspace.functions.mock";

describe("openProject", () => {
  it("opens the repository and reloads everything around it", async () => {
    const deps = createWorkspaceDependenciesMock();
    const fns = createWorkspaceFunctions(deps);

    const info = await fns.openProject("/work/backend");

    expect(deps.sideEffects.setProject).toHaveBeenCalledWith("/work/backend");
    expect(deps.sideEffects.cacheWorkspace).toHaveBeenCalledWith(openWorkspace);
    expect(deps.sideEffects.invalidateAll).toHaveBeenCalled();
    expect(info?.project).toBe("/work/backend");
  });

  it("reloads the repository identity before everything else", async () => {
    const order: Array<string> = [];
    const deps = createWorkspaceDependenciesMock({
      refreshRepo: vi.fn(async () => void order.push("refreshRepo")),
      settle: vi.fn(async () => void order.push("settle")),
      invalidateAll: vi.fn(async () => void order.push("invalidateAll")),
    });

    await createWorkspaceFunctions(deps).openProject("/work/backend");

    // The other views name branches and paths that belong to the repository
    // being left; reloading them first would ask the arriving one about those.
    expect(order).toEqual(["refreshRepo", "settle", "invalidateAll"]);
  });

  it("reports the server's reason and changes nothing when refused", async () => {
    const deps = createWorkspaceDependenciesMock({
      setProject: vi.fn(async () => {
        throw { _tag: "InvalidRepo", reason: "not a git repository" };
      }),
    });
    const fns = createWorkspaceFunctions(deps);

    expect(await fns.openProject("/nope")).toBeNull();
    expect(deps.sideEffects.notifyError).toHaveBeenCalledWith(
      "not a git repository"
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
