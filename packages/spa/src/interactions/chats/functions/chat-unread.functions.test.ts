import { describe, expect, it } from "vitest";
import type { ChatSummary } from "@byconvo/core/chats";
import { isChatUnread, unreadChatCount } from "./chat-unread.functions";

const chat = (id: string, updatedAt: string): ChatSummary => ({
  id,
  title: id,
  provider: "claude",
  model: "claude-opus-4-8",
  branch: "main",
  createdAt: updatedAt,
  updatedAt,
  messageCount: 1,
  lastMessage: null,
  turnState: null,
});

describe("isChatUnread", () => {
  it("counts a thread touched after the mark", () => {
    expect(
      isChatUnread(chat("a", "2026-08-05T10:00:00Z"), "2026-08-05T09:00:00Z")
    ).toBe(true);
  });

  it("leaves a thread last touched before the mark read", () => {
    expect(
      isChatUnread(chat("a", "2026-08-05T08:00:00Z"), "2026-08-05T09:00:00Z")
    ).toBe(false);
  });

  it("treats a never-opened inbox as all unread", () => {
    expect(isChatUnread(chat("a", "2026-08-05T08:00:00Z"), "")).toBe(true);
  });

  it("ignores a thread with an unparseable timestamp", () => {
    expect(isChatUnread(chat("a", "not a date"), "")).toBe(false);
  });
});

describe("unreadChatCount", () => {
  it("counts only the threads past the mark", () => {
    const chats = [
      chat("a", "2026-08-05T10:00:00Z"),
      chat("b", "2026-08-05T08:00:00Z"),
      chat("c", "2026-08-05T11:00:00Z"),
    ];
    expect(unreadChatCount(chats, "2026-08-05T09:00:00Z")).toBe(2);
  });
});
