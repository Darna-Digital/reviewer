import { describe, expect, it } from "vitest";
import type { ReviewComment } from "@byconvo/core/comments";
import {
  isOptimisticId,
  optimisticComment,
  optimisticId,
  withComment,
  withConfirmed,
  withEditedBody,
  withoutComment,
} from "./optimistic-comments.functions";

const comment = (id: string, body = "looks good"): ReviewComment => ({
  id,
  filePath: "src/a.ts",
  side: "additions",
  lineNumber: 12,
  body,
  author: "you",
  createdAt: "2026-07-25T12:00:00.000Z",
  target: "worktree",
  source: "local",
});

describe("optimisticId", () => {
  it("is recognisable, and cannot be mistaken for a server id", () => {
    expect(isOptimisticId(optimisticId(1))).toBe(true);
    expect(isOptimisticId("c-1")).toBe(false);
  });
});

describe("optimisticComment", () => {
  it("is a local comment — a GitHub one is never faked", () => {
    const drafted = optimisticComment({
      id: optimisticId(1),
      filePath: "src/a.ts",
      side: "additions",
      lineNumber: 12,
      body: "looks good",
      target: "worktree",
      author: "you",
      createdAt: "2026-07-25T12:00:00.000Z",
    });
    expect(drafted.source).toBe("local");
  });
});

describe("withComment", () => {
  it("appends", () => {
    const list = [comment("c-1")];
    expect(withComment(list, comment("c-2")).map((c) => c.id)).toEqual([
      "c-1",
      "c-2",
    ]);
  });
});

describe("withConfirmed", () => {
  it("swaps the placeholder in place, so the thread does not reorder", () => {
    const list = [comment("c-1"), comment("pending-1"), comment("c-2")];
    const saved = comment("c-3");
    expect(withConfirmed(list, "pending-1", saved).map((c) => c.id)).toEqual([
      "c-1",
      "c-3",
      "c-2",
    ]);
  });

  it("keeps the saved comment when a refetch already dropped the placeholder", () => {
    const list = [comment("c-1")];
    const saved = comment("c-3");
    expect(withConfirmed(list, "pending-1", saved).map((c) => c.id)).toEqual([
      "c-1",
      "c-3",
    ]);
  });
});

describe("withoutComment", () => {
  it("removes just the one named", () => {
    const list = [comment("c-1"), comment("c-2")];
    expect(withoutComment(list, "c-1").map((c) => c.id)).toEqual(["c-2"]);
  });
});

describe("withEditedBody", () => {
  it("replaces one body and leaves the rest untouched by identity", () => {
    const untouched = comment("c-2");
    const list = [comment("c-1"), untouched];
    const next = withEditedBody(list, "c-1", "actually, rename it");

    expect(next[0]?.body).toBe("actually, rename it");
    expect(next[1]).toBe(untouched);
  });
});
