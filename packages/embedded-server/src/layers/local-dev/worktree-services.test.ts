import { describe, expect, it } from "vitest";
import { commandsToFollow } from "./worktree-services.ts";
import type { DevCommand } from "@byconvo/core/local-dev";

const command = (id: string, name: string, repoPath: string): DevCommand => ({
  id,
  name,
  command: "pnpm dev",
  repo: repoPath.split("/").at(-1) ?? repoPath,
  repoPath,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const commands = [
  command("a", "web", "/work/app"),
  command("b", "api", "/work/app"),
  command("c", "web", "/work/.app-worktrees/fix-login"),
  command("d", "api", "/work/.app-worktrees/fix-login"),
];

describe("commandsToFollow", () => {
  it("starts the arrived-at worktree's stand-ins for what was running", () => {
    const followed = commandsToFollow(
      commands,
      new Set(["web"]),
      "/work/.app-worktrees/fix-login"
    );
    expect(followed.map((entry) => entry.id)).toEqual(["c"]);
  });

  it("leaves a worktree idle when nothing was running", () => {
    expect(
      commandsToFollow(commands, new Set(), "/work/.app-worktrees/fix-login")
    ).toEqual([]);
  });

  it("does not reach for a command the arrived-at worktree does not define", () => {
    expect(
      commandsToFollow(
        commands,
        new Set(["storybook"]),
        "/work/.app-worktrees/fix-login"
      )
    ).toEqual([]);
  });
});
