import { describe, expect, it } from "vitest";
import type { Chat, ChatTurn } from "@reviewer/core/chats";
import { chatSeenMark } from "./chat-seen.functions";

const turn = (state: ChatTurn["state"]): ChatTurn => ({
  id: "turn-1",
  state,
  startedAt: "2026-08-05T10:00:00Z",
  endedAt: state === "running" ? null : "2026-08-05T10:01:00Z",
  errorMessage: null,
  totalCostUsd: null,
});

const chat = (patch: Partial<Chat>): Chat =>
  ({
    id: "c-1",
    updatedAt: "2026-08-05T10:00:00Z",
    latestTurn: null,
    ...patch,
  }) as Chat;

describe("chatSeenMark", () => {
  it("has nothing to mark without a chat", () => {
    expect(chatSeenMark(null)).toBe(null);
  });

  it("marks a resting session once per resting point", () => {
    expect(chatSeenMark(chat({}))).toBe(chatSeenMark(chat({})));
  });

  it("marks again once the conversation has moved on", () => {
    expect(chatSeenMark(chat({ updatedAt: "2026-08-05T11:00:00Z" }))).not.toBe(
      chatSeenMark(chat({}))
    );
  });

  it("marks a running turn once, whatever streams into it", () => {
    const streaming = chat({ latestTurn: turn("running") });
    expect(chatSeenMark(streaming)).toBe(
      chatSeenMark(chat({ latestTurn: turn("running"), updatedAt: "later" }))
    );
  });

  it("marks again where the turn comes to rest", () => {
    expect(chatSeenMark(chat({ latestTurn: turn("error") }))).not.toBe(
      chatSeenMark(chat({ latestTurn: turn("running") }))
    );
  });
});
