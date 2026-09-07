import { describe, expect, it, vi } from "vitest";
import type { DevCommand } from "@reviewer/core/local-dev";
import type { LocalDevDependencies } from "../interfaces/local-dev.interfaces";
import { createLocalDevFunctions } from "./local-dev.functions";

const WEB = "/project/web";

const command = (over: Partial<DevCommand> = {}): DevCommand => ({
  id: "d1",
  name: "web",
  command: "pnpm dev",
  repo: "web",
  repoPath: WEB,
  createdAt: "",
  updatedAt: "",
  ...over,
});

const makeDeps = (): LocalDevDependencies => ({
  data: {},
  sideEffects: {
    create: vi.fn(async (input) => command(input)),
    update: vi.fn(async (id, input) => command({ id, ...input })),
    remove: vi.fn(async () => {}),
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    startAll: vi.fn(async () => {}),
    stopAll: vi.fn(async () => {}),
  },
});

describe("local-dev functions", () => {
  it("skips creation when the command is blank", async () => {
    const deps = makeDeps();
    const fns = createLocalDevFunctions(deps);
    expect(await fns.create("web", "   ", WEB)).toBeNull();
    expect(deps.sideEffects.create).not.toHaveBeenCalled();
  });

  it("skips creation when no repository is given", async () => {
    const deps = makeDeps();
    const fns = createLocalDevFunctions(deps);
    expect(await fns.create("web", "pnpm dev", "")).toBeNull();
    expect(deps.sideEffects.create).not.toHaveBeenCalled();
  });

  it("trims input and defaults a blank name to the command", async () => {
    const deps = makeDeps();
    const fns = createLocalDevFunctions(deps);
    await fns.create("   ", "  pnpm dev  ", WEB);
    expect(deps.sideEffects.create).toHaveBeenCalledWith({
      name: "pnpm dev",
      command: "pnpm dev",
      repoPath: WEB,
    });
  });

  it("keeps a provided name", async () => {
    const deps = makeDeps();
    const fns = createLocalDevFunctions(deps);
    await fns.create("  Web server  ", "pnpm dev", WEB);
    expect(deps.sideEffects.create).toHaveBeenCalledWith({
      name: "Web server",
      command: "pnpm dev",
      repoPath: WEB,
    });
  });

  it("update skips a blank command and trims otherwise", async () => {
    const deps = makeDeps();
    const fns = createLocalDevFunctions(deps);
    expect(await fns.update("d1", "web", "  ", WEB)).toBeNull();
    await fns.update("d1", "api", " pnpm start ", WEB);
    expect(deps.sideEffects.update).toHaveBeenCalledWith("d1", {
      name: "api",
      command: "pnpm start",
      repoPath: WEB,
    });
  });

  it("passes the repository through to a scoped run all / stop all", async () => {
    const deps = makeDeps();
    const fns = createLocalDevFunctions(deps);
    await fns.startAll(WEB);
    await fns.stopAll();
    expect(deps.sideEffects.startAll).toHaveBeenCalledWith(WEB);
    expect(deps.sideEffects.stopAll).toHaveBeenCalledWith(undefined);
  });
});
