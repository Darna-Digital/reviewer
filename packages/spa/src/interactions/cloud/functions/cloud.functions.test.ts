import { describe, expect, it } from "vitest";
import { createCloudFunctions, toNewCloudRun } from "./cloud.functions";
import {
  cloudRepo,
  connected,
  disconnected,
  mockCloudDependencies,
  pending,
} from "./cloud.functions.mock";

const settings = {
  provider: "claude",
  model: "claude-opus-4-8",
  effort: "high",
  access: "fullAccess",
} as const;

describe("awaitApproval", () => {
  it("polls at the cloud's interval until the person approves", async () => {
    const { deps, calls } = mockCloudDependencies({
      polls: [pending(), pending(), connected()],
    });
    const fns = createCloudFunctions(deps);
    const result = await fns.awaitApproval(pending());
    expect(result).toEqual({ kind: "connected", connection: connected() });
    expect(calls.poll).toBe(3);
    expect(calls.delays).toEqual([5_000, 5_000, 5_000]);
  });

  it("slows down after a poll that did not reach the cloud", async () => {
    const { deps, calls } = mockCloudDependencies({
      polls: [new Error("offline"), connected()],
    });
    const fns = createCloudFunctions(deps);
    const result = await fns.awaitApproval(pending());
    expect(result.kind).toBe("connected");
    expect(calls.delays).toEqual([5_000, 10_000]);
  });

  it("reads a dropped flow before the code lapsed as denied", async () => {
    const { deps } = mockCloudDependencies({ polls: [disconnected()] });
    const fns = createCloudFunctions(deps);
    expect(await fns.awaitApproval(pending())).toEqual({ kind: "denied" });
  });

  it("reads a dropped flow after the code lapsed as expired", async () => {
    const { deps } = mockCloudDependencies({
      polls: [disconnected()],
      startAt: Date.parse("2026-01-01T00:09:57.000Z"),
    });
    const fns = createCloudFunctions(deps);
    expect(await fns.awaitApproval(pending())).toEqual({ kind: "expired" });
  });

  it("gives up on its own once the code's lifetime is past", async () => {
    const { deps, calls } = mockCloudDependencies({
      polls: [pending()],
      startAt: Date.parse("2026-01-01T00:09:58.000Z"),
    });
    const fns = createCloudFunctions(deps);
    expect(await fns.awaitApproval(pending())).toEqual({ kind: "expired" });
    expect(calls.poll).toBe(0);
  });

  it("stops when the caller aborts", async () => {
    const { deps, calls } = mockCloudDependencies({ polls: [pending()] });
    const fns = createCloudFunctions(deps);
    const controller = new AbortController();
    controller.abort();
    expect(await fns.awaitApproval(pending(), controller.signal)).toEqual({
      kind: "cancelled",
    });
    expect(calls.poll).toBe(0);
  });
});

describe("startCloudRun", () => {
  it("maps the composer's settings and place onto a cloud run", async () => {
    const { deps, calls } = mockCloudDependencies();
    const fns = createCloudFunctions(deps);
    const started = await fns.startCloudRun(
      settings,
      { repo: cloudRepo(), baseBranch: "main" },
      "  fix the build  "
    );
    expect(started?.run.id).toBe("run-1");
    expect(calls.createRun).toEqual([
      {
        repoId: "repo-1",
        prompt: "fix the build",
        provider: "claude",
        model: "claude-opus-4-8",
        effort: "high",
        access: "fullAccess",
        baseBranch: "main",
      },
    ]);
  });

  it("leaves an empty model and base branch to the cloud's defaults", () => {
    expect(
      toNewCloudRun(
        { ...settings, model: "" },
        { repo: cloudRepo(), baseBranch: null },
        "go"
      )
    ).toEqual({
      repoId: "repo-1",
      prompt: "go",
      provider: "claude",
      effort: "high",
      access: "fullAccess",
    });
  });

  it("does nothing with a blank prompt", async () => {
    const { deps, calls } = mockCloudDependencies();
    const fns = createCloudFunctions(deps);
    const started = await fns.startCloudRun(
      settings,
      { repo: cloudRepo(), baseBranch: null },
      "   "
    );
    expect(started).toBeNull();
    expect(calls.createRun).toHaveLength(0);
  });
});

describe("send", () => {
  it("trims the follow-up and skips a blank one", async () => {
    const { deps, calls } = mockCloudDependencies();
    const fns = createCloudFunctions(deps);
    expect(await fns.send("run-1", "  and the tests ")).not.toBeNull();
    expect(await fns.send("run-1", "   ")).toBeNull();
    expect(calls.send).toEqual([{ id: "run-1", prompt: "and the tests" }]);
  });
});

describe("connect and disconnect", () => {
  it("pass straight through", async () => {
    const { deps, calls } = mockCloudDependencies();
    const fns = createCloudFunctions(deps);
    expect((await fns.connect("https://cloud.test")).status).toBe("pending");
    expect((await fns.disconnect()).status).toBe("disconnected");
    expect(calls.connect).toEqual(["https://cloud.test"]);
    expect(calls.disconnect).toBe(1);
  });
});
