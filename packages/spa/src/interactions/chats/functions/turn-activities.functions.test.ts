import { describe, expect, it } from "vitest";
import type { ChatActivity } from "@reviewer/core/chats";
import { groupActivitiesByTurn } from "./turn-activities.functions";

let seq = 0;
const activity = (turnId: string): ChatActivity => {
  seq += 1;
  return {
    id: `a-${seq}`,
    turnId,
    kind: "tool.started",
    tone: "tool",
    summary: "Bash — pnpm test",
    detail: null,
    createdAt: "2026-07-25T12:00:00.000Z",
  };
};

const EMPTY = new Map<string, ReadonlyArray<ChatActivity>>();

describe("groupActivitiesByTurn", () => {
  it("groups entries under the turn they belong to, in order", () => {
    const [a, b, c] = [activity("t1"), activity("t2"), activity("t1")];
    const grouped = groupActivitiesByTurn([a, b, c], EMPTY);

    expect(grouped.get("t1")).toEqual([a, c]);
    expect(grouped.get("t2")).toEqual([b]);
  });

  it("keeps the previous array for a turn that has not changed", () => {
    const [a, b] = [activity("t1"), activity("t2")];
    const first = groupActivitiesByTurn([a, b], EMPTY);

    // The reducer appends by rebuilding the list, so the input array is new
    // even though neither turn's own entries moved.
    const second = groupActivitiesByTurn([a, b], first);

    expect(second.get("t1")).toBe(first.get("t1"));
    expect(second.get("t2")).toBe(first.get("t2"));
  });

  it("gives only the turn that gained an entry a new array", () => {
    const [a, b] = [activity("t1"), activity("t2")];
    const first = groupActivitiesByTurn([a, b], EMPTY);
    const c = activity("t2");
    const second = groupActivitiesByTurn([a, b, c], first);

    expect(second.get("t1")).toBe(first.get("t1"));
    expect(second.get("t2")).not.toBe(first.get("t2"));
    expect(second.get("t2")).toEqual([b, c]);
  });

  it("drops a turn that no longer has any entries", () => {
    const [a, b] = [activity("t1"), activity("t2")];
    const first = groupActivitiesByTurn([a, b], EMPTY);
    const second = groupActivitiesByTurn([a], first);

    expect(second.has("t2")).toBe(false);
    expect(second.get("t1")).toBe(first.get("t1"));
  });
});
