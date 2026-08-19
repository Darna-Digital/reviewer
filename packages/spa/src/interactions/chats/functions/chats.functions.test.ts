import { describe, expect, it } from "vitest";
import { createChatsFunctions } from "./chats.functions";
import { mockChatsDependencies } from "./chats.functions.mock";

const settings = {
  provider: "claude",
  model: "claude-opus-4-8",
  effort: "high",
  access: "fullAccess",
} as const;

describe("createChatsFunctions", () => {
  it("start creates the chat then sends the trimmed first prompt", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    const result = await fns.start(settings, { branch: "main" }, "  hey  ");
    expect(result).not.toBeNull();
    expect(calls.create).toEqual([{ ...settings, branch: "main" }]);
    expect(calls.send).toEqual([{ id: "c-1", text: "hey", images: [] }]);
  });

  it("start with only an image (blank prompt) still creates and sends", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    const image = { name: "a.png", data: "abc", thumbnail: "data:image/png,x" };
    const result = await fns.start(settings, { branch: "main" }, "   ", [
      image,
    ]);
    expect(result).not.toBeNull();
    expect(calls.create).toEqual([{ ...settings, branch: "main" }]);
    expect(calls.send).toEqual([{ id: "c-1", text: "", images: [image] }]);
  });

  it("start with a blank prompt creates nothing", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    const result = await fns.start(settings, { branch: "main" }, "   ");
    expect(result).toBeNull();
    expect(calls.create).toHaveLength(0);
    expect(calls.send).toHaveLength(0);
  });

  it("startWithTitle creates a titled chat then sends the prompt", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    const result = await fns.startWithTitle(
      settings,
      { branch: "feature" },
      "  Fix review comments  ",
      "  address these comments  "
    );
    expect(result).not.toBeNull();
    expect(calls.create).toEqual([
      { ...settings, branch: "feature", title: "Fix review comments" },
    ]);
    expect(calls.send).toEqual([
      { id: "c-1", text: "address these comments", images: [] },
    ]);
  });

  it("startWithTitle drops blank titles and blank prompts", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    const blank = await fns.startWithTitle(
      settings,
      { branch: "main" },
      "Fix it",
      "   "
    );
    const untitled = await fns.startWithTitle(
      settings,
      { branch: "main" },
      "   ",
      "go"
    );
    expect(blank).toBeNull();
    expect(untitled).not.toBeNull();
    expect(calls.create).toEqual([{ ...settings, branch: "main" }]);
    expect(calls.send).toEqual([{ id: "c-1", text: "go", images: [] }]);
  });

  it("start in a worktree names the checkout the agent runs in", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    await fns.start(
      settings,
      { branch: "task/dark-mode", repoPath: "/repo/.byconvo-worktrees/task" },
      "add dark mode"
    );
    expect(calls.create).toEqual([
      {
        ...settings,
        branch: "task/dark-mode",
        repoPath: "/repo/.byconvo-worktrees/task",
      },
    ]);
  });

  it("send trims and skips blank prompts", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    await fns.send("c-9", "  fix the bug  ");
    expect(await fns.send("c-9", " \n ")).toBeNull();
    expect(calls.send).toEqual([
      { id: "c-9", text: "fix the bug", images: [] },
    ]);
  });

  it("rename trims the title and drops a blank rename", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    await fns.rename("c-1", "  Ship it  ");
    await fns.rename("c-1", "   ");
    expect(calls.update).toEqual([
      { id: "c-1", input: { title: "Ship it" } },
      { id: "c-1", input: {} },
    ]);
  });

  it("updateSettings passes the patch through", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    await fns.updateSettings("c-1", { access: "supervised", effort: "low" });
    expect(calls.update).toEqual([
      { id: "c-1", input: { access: "supervised", effort: "low" } },
    ]);
  });

  it("stop and remove delegate by id", async () => {
    const { deps, calls } = mockChatsDependencies();
    const fns = createChatsFunctions(deps);
    await fns.stop("c-1");
    await fns.remove("c-2");
    expect(calls.stop).toEqual(["c-1"]);
    expect(calls.remove).toEqual(["c-2"]);
  });
});
