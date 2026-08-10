import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Chat, ChatTurn } from "@byconvo/core/chats";
import {
  readChats,
  saveStreamingText,
  settleStaleTurns,
  writeChats,
} from "./store.ts";

let repoDir: string;
beforeEach(() => {
  repoDir = mkdtempSync(`${tmpdir()}/byconvo-chats-`);
});
afterEach(() => rmSync(repoDir, { recursive: true, force: true }));

const runningTurn: ChatTurn = {
  id: "turn-1",
  state: "running",
  startedAt: "2026-07-25T12:00:00.000Z",
  endedAt: null,
  errorMessage: null,
  totalCostUsd: null,
};

const chat = (overrides: Partial<Chat> = {}): Chat => ({
  id: "c-1",
  title: "a chat",
  provider: "claude",
  model: "opus",
  effort: "medium",
  access: "supervised",
  branch: "main",
  sessionId: null,
  createdAt: "2026-07-25T12:00:00.000Z",
  updatedAt: "2026-07-25T12:00:00.000Z",
  messages: [
    {
      id: "m-1",
      role: "assistant",
      text: "half a th",
      turnId: "turn-1",
      streaming: true,
      createdAt: "2026-07-25T12:00:00.000Z",
    },
  ],
  activities: [],
  latestTurn: runningTurn,
  ...overrides,
});

describe("writeChats", () => {
  it("leaves no temp file behind, so the store only ever holds chats.json", () => {
    writeChats(repoDir, [chat()]);
    expect(readdirSync(`${repoDir}/.byconvo`)).toEqual(["chats.json"]);
  });
});

describe("saveStreamingText", () => {
  it("checkpoints partial text without ending the stream", () => {
    writeChats(repoDir, [chat()]);
    saveStreamingText(repoDir, "c-1", "m-1", "half a thought, then more");
    const [saved] = readChats(repoDir);
    expect(saved?.messages[0]).toMatchObject({
      text: "half a thought, then more",
      streaming: true,
    });
  });
});

describe("settleStaleTurns", () => {
  it("settles a running turn no process backs, keeping the text flushed so far", () => {
    writeChats(repoDir, [chat()]);
    const repaired = settleStaleTurns(repoDir, () => false, "server stopped");
    expect(repaired).toEqual(["c-1"]);
    const [saved] = readChats(repoDir);
    expect(saved?.latestTurn).toMatchObject({
      state: "interrupted",
      errorMessage: "server stopped",
    });
    expect(saved?.latestTurn?.endedAt).not.toBeNull();
    // The reply the user already watched arrive survives the repair.
    expect(saved?.messages[0]).toMatchObject({
      text: "half a th",
      streaming: false,
    });
  });

  it("leaves a turn alone while its process is still live", () => {
    writeChats(repoDir, [chat()]);
    expect(settleStaleTurns(repoDir, () => true, "server stopped")).toEqual([]);
    expect(readChats(repoDir)[0]?.latestTurn?.state).toBe("running");
  });

  it("settles every orphaned placeholder, not just the last one", () => {
    // A crash, then a new turn started before anything repaired the first —
    // the older placeholder would otherwise stream forever with no turn to
    // settle it.
    writeChats(repoDir, [
      chat({
        messages: [
          {
            id: "m-old",
            role: "assistant",
            text: "orphaned",
            turnId: "turn-0",
            streaming: true,
            createdAt: "2026-07-25T11:00:00.000Z",
          },
          {
            id: "m-1",
            role: "assistant",
            text: "current",
            turnId: "turn-1",
            streaming: true,
            createdAt: "2026-07-25T12:00:00.000Z",
          },
        ],
      }),
    ]);
    settleStaleTurns(repoDir, () => false, "server stopped");
    expect(readChats(repoDir)[0]?.messages.every((m) => !m.streaming)).toBe(
      true
    );
  });

  it("repairs chats across the whole file in one pass", () => {
    writeChats(repoDir, [
      chat({ id: "c-1" }),
      chat({ id: "c-2" }),
      chat({ id: "c-3", latestTurn: { ...runningTurn, state: "completed" } }),
    ]);
    expect(settleStaleTurns(repoDir, () => false, "server stopped")).toEqual([
      "c-1",
      "c-2",
    ]);
    expect(readChats(repoDir).map((c) => c.latestTurn?.state)).toEqual([
      "interrupted",
      "interrupted",
      "completed",
    ]);
  });

  it("is a no-op when nothing is stale, leaving the file untouched", () => {
    writeChats(repoDir, [
      chat({ latestTurn: { ...runningTurn, state: "completed" } }),
    ]);
    expect(settleStaleTurns(repoDir, () => false, "server stopped")).toEqual(
      []
    );
  });
});
