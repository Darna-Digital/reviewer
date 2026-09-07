import { describe, expect, it } from "vitest";
import type {
  CloudRun,
  CloudRunEvent,
  CloudRunSnapshot,
} from "../schema/cloud.schema.ts";
import {
  applyCloudRunEvent,
  cloudRunStatusLabel,
  isCloudRunActive,
} from "./cloud-run-events.ts";

const AT = "2026-01-01T00:00:00.000Z";

const run: CloudRun = {
  id: "run-1",
  repoId: "repo-1",
  repoFullName: "acme/api",
  title: "Fix the build",
  provider: "claude",
  model: "",
  effort: "high",
  access: "fullAccess",
  baseBranch: "main",
  branch: "reviewer/fix-the-build-run1",
  sessionId: null,
  status: "queued",
  openPullRequest: true,
  pullRequestUrl: null,
  headSha: null,
  createdAt: AT,
  updatedAt: AT,
};

const empty: CloudRunSnapshot = {
  run,
  turns: [],
  messages: [],
  activities: [],
  lastSeq: 0,
};

const event = (
  seq: number,
  payload: CloudRunEvent["payload"],
  turnId = "turn-1"
): CloudRunEvent => ({ seq, runId: "run-1", turnId, at: AT, payload });

const fold = (events: ReadonlyArray<CloudRunEvent>) =>
  events.reduce(applyCloudRunEvent, empty);

describe("applyCloudRunEvent", () => {
  it("queues a turn as a user message and a queued turn", () => {
    const next = fold([event(1, { kind: "turn-queued", prompt: "fix it" })]);
    expect(next.turns.map((t) => [t.id, t.state])).toEqual([
      ["turn-1", "queued"],
    ]);
    expect(next.messages).toEqual([
      expect.objectContaining({ role: "user", text: "fix it" }),
    ]);
    expect(next.run.status).toBe("queued");
    expect(next.lastSeq).toBe(1);
  });

  it("builds the reply from deltas and settles it on completion", () => {
    const next = fold([
      event(1, { kind: "turn-queued", prompt: "fix it" }),
      event(2, { kind: "turn-started" }),
      event(3, { kind: "delta", text: "On " }),
      event(4, { kind: "delta", text: "it." }),
      event(5, {
        kind: "turn-completed",
        state: "completed",
        text: "On it. Done.",
        errorMessage: null,
        totalCostUsd: 0.2,
      }),
    ]);
    const reply = next.messages.find((m) => m.role === "assistant");
    expect(reply?.text).toBe("On it. Done.");
    expect(reply?.streaming).toBe(false);
    expect(next.run.status).toBe("idle");
    expect(next.turns[0]?.totalCostUsd).toBe(0.2);
  });

  it("is idempotent on seq, so a replayed event changes nothing", () => {
    const once = fold([
      event(1, { kind: "turn-queued", prompt: "fix it" }),
      event(2, { kind: "turn-started" }),
      event(3, { kind: "delta", text: "hey" }),
    ]);
    const twice = applyCloudRunEvent(
      once,
      event(3, { kind: "delta", text: "hey" })
    );
    expect(twice).toBe(once);
  });

  it("keeps provisioning lines as info activities of the turn", () => {
    const next = fold([
      event(1, { kind: "turn-queued", prompt: "fix it" }),
      event(2, { kind: "log", text: "Cloning acme/api" }),
    ]);
    expect(next.activities).toEqual([
      expect.objectContaining({
        id: "log-2",
        kind: "log",
        tone: "info",
        summary: "Cloning acme/api",
        turnId: "turn-1",
      }),
    ]);
  });

  it("adds an activity once by id", () => {
    const activity = {
      id: "a-1",
      turnId: "turn-1",
      kind: "tool.started",
      tone: "tool" as const,
      summary: "Bash — pnpm test",
      detail: null,
      createdAt: AT,
    };
    const next = fold([
      event(1, { kind: "activity", activity }),
      event(2, { kind: "activity", activity }),
    ]);
    expect(next.activities).toHaveLength(1);
  });

  it("marks a failed turn on the run and the turn", () => {
    const next = fold([
      event(1, { kind: "turn-queued", prompt: "fix it" }),
      event(2, { kind: "turn-started" }),
      event(3, {
        kind: "turn-completed",
        state: "failed",
        text: "",
        errorMessage: "boom",
        totalCostUsd: null,
      }),
    ]);
    expect(next.run.status).toBe("failed");
    expect(next.turns[0]?.errorMessage).toBe("boom");
  });

  it("records where a publish landed", () => {
    const next = fold([
      event(1, {
        kind: "published",
        branch: "reviewer/fix",
        headSha: "abc",
        pullRequestUrl: "https://github.com/acme/api/pull/7",
      }),
    ]);
    expect(next.run.branch).toBe("reviewer/fix");
    expect(next.run.headSha).toBe("abc");
    expect(next.run.pullRequestUrl).toBe("https://github.com/acme/api/pull/7");
  });

  it("keeps the pull request url when a later publish has none", () => {
    const next = fold([
      event(1, {
        kind: "published",
        branch: "b",
        headSha: "1",
        pullRequestUrl: "https://example/pr",
      }),
      event(2, {
        kind: "published",
        branch: "b",
        headSha: "2",
        pullRequestUrl: null,
      }),
    ]);
    expect(next.run.pullRequestUrl).toBe("https://example/pr");
  });
});

describe("isCloudRunActive", () => {
  it("is true while something is or will be working", () => {
    expect(isCloudRunActive("queued")).toBe(true);
    expect(isCloudRunActive("provisioning")).toBe(true);
    expect(isCloudRunActive("running")).toBe(true);
    expect(isCloudRunActive("idle")).toBe(false);
    expect(isCloudRunActive("failed")).toBe(false);
    expect(isCloudRunActive("cancelled")).toBe(false);
  });
});

describe("cloudRunStatusLabel", () => {
  it("names every status", () => {
    expect(cloudRunStatusLabel("provisioning")).toBe("Provisioning");
    expect(cloudRunStatusLabel("idle")).toBe("Idle");
  });
});
