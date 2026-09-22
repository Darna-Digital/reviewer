import { describe, expect, it, vi } from "vitest";
import type { DevCommand } from "@reviewer/core/local-dev";
import type { LocalDevDependencies } from "../interfaces/local-dev.interfaces";
import { createLocalDevFunctions, repoFolders } from "./local-dev.functions";

const command = (over: Partial<DevCommand> = {}): DevCommand => ({
  id: "d1",
  name: "web",
  command: "pnpm dev",
  cwd: "",
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
    expect(
      await fns.create({ name: "web", command: "   ", cwd: "" })
    ).toBeNull();
    expect(deps.sideEffects.create).not.toHaveBeenCalled();
  });

  it("trims input and defaults a blank name to the command", async () => {
    const deps = makeDeps();
    const fns = createLocalDevFunctions(deps);
    await fns.create({ name: "   ", command: "  pnpm dev  ", cwd: "" });
    expect(deps.sideEffects.create).toHaveBeenCalledWith({
      name: "pnpm dev",
      command: "pnpm dev",
      cwd: "",
    });
  });

  it("keeps a provided name and normalises the folder", async () => {
    const deps = makeDeps();
    const fns = createLocalDevFunctions(deps);
    await fns.create({
      name: "  Web server  ",
      command: "pnpm dev",
      cwd: "./packages/web/",
    });
    expect(deps.sideEffects.create).toHaveBeenCalledWith({
      name: "Web server",
      command: "pnpm dev",
      cwd: "packages/web",
    });
  });

  it("update skips a blank command and trims otherwise", async () => {
    const deps = makeDeps();
    const fns = createLocalDevFunctions(deps);
    expect(
      await fns.update("d1", { name: "web", command: "  ", cwd: "" })
    ).toBeNull();
    await fns.update("d1", {
      name: "api",
      command: " pnpm start ",
      cwd: "apps/api",
    });
    expect(deps.sideEffects.update).toHaveBeenCalledWith("d1", {
      name: "api",
      command: "pnpm start",
      cwd: "apps/api",
    });
  });
});

describe("repoFolders", () => {
  it("lists the root then every folder the files sit in, once, sorted", () => {
    expect(
      repoFolders([
        "package.json",
        "packages/web/src/index.ts",
        "packages/web/package.json",
        "apps/api/main.ts",
      ])
    ).toEqual([
      "",
      "apps",
      "apps/api",
      "packages",
      "packages/web",
      "packages/web/src",
    ]);
  });
});
