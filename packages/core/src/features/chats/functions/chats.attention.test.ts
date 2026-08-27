import { describe, expect, it } from "vitest";
import {
  isChatUnread,
  unattendedTurnState,
  unreadChatCount,
  type ChatAttentionState,
} from "./chats.attention.ts";

const state = (patch: Partial<ChatAttentionState>): ChatAttentionState => ({
  updatedAt: "2026-08-05T10:00:00Z",
  seenAt: "2026-08-05T09:00:00Z",
  turnState: null,
  ...patch,
});

describe("isChatUnread", () => {
  it("counts a session touched after the reader last opened it", () => {
    expect(isChatUnread(state({}))).toBe(true);
  });

  it("leaves a session opened since its last move read", () => {
    expect(isChatUnread(state({ seenAt: "2026-08-05T11:00:00Z" }))).toBe(false);
  });

  it("treats a session never opened as unread", () => {
    expect(isChatUnread(state({ seenAt: null }))).toBe(true);
  });

  it("ignores a session with an unparseable timestamp", () => {
    expect(isChatUnread(state({ updatedAt: "not a date", seenAt: null }))).toBe(
      false
    );
  });
});

describe("unreadChatCount", () => {
  it("counts only the sessions that moved since they were opened", () => {
    expect(
      unreadChatCount([
        state({}),
        state({ seenAt: "2026-08-05T11:00:00Z" }),
        state({ seenAt: null }),
      ])
    ).toBe(2);
  });
});

describe("unattendedTurnState", () => {
  it("says nothing for a session that has never run a turn", () => {
    expect(unattendedTurnState(state({ turnState: null }))).toBe(null);
  });

  it("says nothing for a turn that simply finished", () => {
    expect(unattendedTurnState(state({ turnState: "completed" }))).toBe(null);
  });

  it("always shows a running turn, read or not", () => {
    expect(
      unattendedTurnState(
        state({ turnState: "running", seenAt: "2026-08-05T11:00:00Z" })
      )
    ).toBe("running");
  });

  it("shows an outcome nobody has looked at yet", () => {
    expect(unattendedTurnState(state({ turnState: "error" }))).toBe("error");
    expect(unattendedTurnState(state({ turnState: "interrupted" }))).toBe(
      "interrupted"
    );
  });

  it("drops an outcome once the session has been opened since", () => {
    expect(
      unattendedTurnState(
        state({ turnState: "error", seenAt: "2026-08-05T11:00:00Z" })
      )
    ).toBe(null);
    expect(
      unattendedTurnState(
        state({ turnState: "interrupted", seenAt: "2026-08-05T11:00:00Z" })
      )
    ).toBe(null);
  });
});
