import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChatMessage, ChatTurn } from "@byconvo/core/chats";
import { closeDatabase, openDatabase } from "../db/database.ts";
import { rememberProject } from "../db/scope.ts";
import {
  appendActivity,
  appendPendingMessage,
  appendTurnStart,
  completeTurn,
  findChat,
  insertChat,
  listChatProjects,
  listChatSummaries,
  removeChat,
  saveStreamingText,
  settleStaleTurns,
  startPendingTurn,
} from "./store.ts";

/** The whole list, unfiltered — what `listChatSummaries` meant before paging. */
const WHOLE_LIST = {
  limit: 100,
  cursor: null,
  search: null,
  projectPath: null,
  since: null,
} as const;
const allChats = () => listChatSummaries(WHOLE_LIST).items;
/** Small enough that the seeds below take several pages to walk. */
const page3 = (cursor: string | null) =>
  listChatSummaries({ ...WHOLE_LIST, limit: 3, cursor });

const API = "/home/dev/api";
const WEB = "/home/dev/web";
const PROJECT = "/home/dev";
const SOLO = "/home/solo";

beforeEach(() => {
  openDatabase(":memory:");
  // The multi-root case is the interesting one: one project, two git roots.
  rememberProject(PROJECT, [
    { name: "api", path: API },
    { name: "web", path: WEB },
  ]);
  rememberProject(SOLO, [{ name: "solo", path: SOLO }]);
});
afterEach(closeDatabase);

const seed = (
  id: string,
  repoPath: string,
  updatedAt: string,
  title = "a chat"
) => {
  const chat = insertChat({
    id,
    repoPath,
    title,
    provider: "claude",
    model: "opus",
    effort: "medium",
    access: "supervised",
    branch: "main",
    createdAt: updatedAt,
  });
  return chat;
};

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m-1",
  role: "user",
  text: "hello",
  turnId: "turn-1",
  streaming: false,
  createdAt: "2026-07-25T12:00:00.000Z",
  ...overrides,
});

const runningTurn: ChatTurn = {
  id: "turn-1",
  state: "running",
  startedAt: "2026-07-25T12:00:00.000Z",
  endedAt: null,
  errorMessage: null,
  totalCostUsd: null,
};

describe("chat store", () => {
  it("labels a chat with the project its repository belongs to", () => {
    const chat = seed("c-1", API, "2026-07-25T12:00:00.000Z");
    expect(chat.origin).toEqual({
      projectPath: PROJECT,
      projectName: "dev",
      repoPath: API,
      repoName: "api",
    });
  });

  it("lists every project's chats together, newest first", () => {
    seed("c-api", API, "2026-07-25T12:00:00.000Z");
    seed("c-web", WEB, "2026-07-25T13:00:00.000Z");
    seed("c-solo", SOLO, "2026-07-25T11:00:00.000Z");

    const listed = allChats();
    expect(listed.map((chat) => chat.id)).toEqual(["c-web", "c-api", "c-solo"]);
    // Two roots of one project group under it; the standalone repo is its own.
    expect(listed.map((chat) => chat.origin.projectPath)).toEqual([
      PROJECT,
      PROJECT,
      SOLO,
    ]);
    expect(listed.map((chat) => chat.origin.repoName)).toEqual([
      "web",
      "api",
      "solo",
    ]);
  });

  it("walks the whole list a page at a time, never repeating or skipping", () => {
    for (let i = 0; i < 7; i += 1) {
      seed(`c-${i}`, API, `2026-07-25T12:00:0${i}.000Z`);
    }

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = page3(cursor);
      seen.push(...page.items.map((chat) => chat.id));
      cursor = page.nextCursor;
    } while (cursor !== null);

    expect(seen).toEqual(["c-6", "c-5", "c-4", "c-3", "c-2", "c-1", "c-0"]);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("ends the list without a cursor, even on a page that came out full", () => {
    seed("c-1", API, "2026-07-25T12:00:01.000Z");
    seed("c-2", API, "2026-07-25T12:00:02.000Z");
    seed("c-3", API, "2026-07-25T12:00:03.000Z");

    const page = page3(null);
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  // Sessions share a timestamp whenever two turns settle in the same
  // millisecond; ordering on it alone would let a page start mid-tie and lose
  // whichever row the previous page had already passed.
  it("pages through sessions that share an update time", () => {
    const sameTime = "2026-07-25T12:00:00.000Z";
    seed("c-a", API, sameTime);
    seed("c-b", API, sameTime);
    seed("c-c", API, sameTime);
    seed("c-d", API, sameTime);

    const first = page3(null);
    const second = page3(first.nextCursor);
    expect([...first.items, ...second.items].map((chat) => chat.id)).toEqual([
      "c-d",
      "c-c",
      "c-b",
      "c-a",
    ]);
  });

  it("narrows to one project, across every root it holds", () => {
    seed("c-api", API, "2026-07-25T12:00:00.000Z");
    seed("c-web", WEB, "2026-07-25T13:00:00.000Z");
    seed("c-solo", SOLO, "2026-07-25T14:00:00.000Z");

    const { items } = listChatSummaries({
      ...WHOLE_LIST,
      projectPath: PROJECT,
    });
    expect(items.map((chat) => chat.id)).toEqual(["c-web", "c-api"]);
  });

  it("keeps only what was touched since the cutoff", () => {
    seed("c-old", API, "2026-07-01T12:00:00.000Z");
    seed("c-new", API, "2026-07-25T12:00:00.000Z");

    const { items } = listChatSummaries({
      ...WHOLE_LIST,
      since: "2026-07-20T00:00:00.000Z",
    });
    expect(items.map((chat) => chat.id)).toEqual(["c-new"]);
  });

  it("searches titles, project names and the message itself", () => {
    seed("c-titled", API, "2026-07-25T12:00:00.000Z", "rename the widget");
    seed("c-spoken", SOLO, "2026-07-25T11:00:00.000Z");
    appendTurnStart("c-spoken", {
      turn: runningTurn,
      userMessage: message({ id: "m-1", text: "ask about the widget" }),
      assistantMessage: message({
        id: "m-2",
        role: "assistant",
        text: "",
        streaming: true,
      }),
    });
    saveStreamingText("c-spoken", "m-2", "the widget is fine");

    const byTitle = listChatSummaries({ ...WHOLE_LIST, search: "WIDGET" });
    expect(byTitle.items.map((chat) => chat.id)).toEqual([
      "c-titled",
      "c-spoken",
    ]);

    const byProject = listChatSummaries({ ...WHOLE_LIST, search: "solo" });
    expect(byProject.items.map((chat) => chat.id)).toEqual(["c-spoken"]);
  });

  // The preview the row shows is clipped; the search is not, so a session is
  // findable by something said late in a long reply.
  it("searches past the end of the clipped preview", () => {
    seed("c-1", API, "2026-07-25T12:00:00.000Z");
    appendTurnStart("c-1", {
      turn: runningTurn,
      userMessage: message({ id: "m-1", text: "go" }),
      assistantMessage: message({
        id: "m-2",
        role: "assistant",
        text: "",
        streaming: true,
      }),
    });
    saveStreamingText("c-1", "m-2", `${"x".repeat(400)} needle`);

    expect(allChats()[0]?.lastMessage).not.toContain("needle");
    const found = listChatSummaries({ ...WHOLE_LIST, search: "needle" });
    expect(found.items.map((chat) => chat.id)).toEqual(["c-1"]);
  });

  it("tallies every project holding a session, however far the list is scrolled", () => {
    seed("c-api", API, "2026-07-25T12:00:00.000Z");
    seed("c-web", WEB, "2026-07-25T13:00:00.000Z");
    seed("c-solo", SOLO, "2026-07-25T14:00:00.000Z");
    seed("c-orphan", "/home/gone/elsewhere", "2026-07-25T15:00:00.000Z");

    expect(listChatProjects()).toEqual([
      { path: PROJECT, name: "dev", count: 2 },
      { path: "/home/gone/elsewhere", name: "elsewhere", count: 1 },
      { path: SOLO, name: "solo", count: 1 },
    ]);
  });

  it("stands a chat from an unregistered repository up as its own project", () => {
    seed("c-orphan", "/home/gone/elsewhere", "2026-07-25T12:00:00.000Z");
    const [chat] = allChats();
    expect(chat.origin.projectPath).toBe("/home/gone/elsewhere");
    expect(chat.origin.projectName).toBe("elsewhere");
  });

  it("summarises message counts and the last line without loading transcripts", () => {
    seed("c-1", API, "2026-07-25T12:00:00.000Z");
    appendTurnStart("c-1", {
      turn: runningTurn,
      userMessage: message({ id: "m-1", text: "first" }),
      assistantMessage: message({
        id: "m-2",
        role: "assistant",
        text: "",
        streaming: true,
      }),
    });
    saveStreamingText("c-1", "m-2", "an answer");

    const [summary] = allChats();
    expect(summary.messageCount).toBe(2);
    expect(summary.lastMessage).toBe("an answer");
    expect(summary.turnState).toBe("running");
  });

  it("titles a new chat from its first prompt and keeps message order", () => {
    insertChat({
      id: "c-1",
      repoPath: API,
      title: "New thread",
      provider: "claude",
      model: "opus",
      effort: "medium",
      access: "supervised",
      branch: "main",
      createdAt: "2026-07-25T12:00:00.000Z",
    });
    appendTurnStart("c-1", {
      turn: runningTurn,
      userMessage: message({ id: "m-1", text: "why is the sky blue" }),
      assistantMessage: message({
        id: "m-2",
        role: "assistant",
        text: "",
        streaming: true,
      }),
    });
    const chat = findChat("c-1");
    expect(chat?.title).toBe("why is the sky blue");
    expect(chat?.messages.map((m) => m.id)).toEqual(["m-1", "m-2"]);
  });

  it("keeps a checkpoint of the streaming reply", () => {
    seed("c-1", API, "2026-07-25T12:00:00.000Z");
    appendTurnStart("c-1", {
      turn: runningTurn,
      userMessage: message({ id: "m-1" }),
      assistantMessage: message({
        id: "m-2",
        role: "assistant",
        text: "half a th",
        streaming: true,
      }),
    });
    saveStreamingText("c-1", "m-2", "half a thought");
    expect(findChat("c-1")?.messages[1].text).toBe("half a thought");
  });

  it("carries a queued message into the turn that consumes it", () => {
    seed("c-1", API, "2026-07-25T12:00:00.000Z");
    appendPendingMessage(
      "c-1",
      message({ id: "m-1", text: "and also this", pending: true })
    );
    expect(findChat("c-1")?.messages[0].pending).toBe(true);

    startPendingTurn("c-1", {
      turn: { ...runningTurn, id: "turn-2" },
      assistantMessage: message({
        id: "m-2",
        role: "assistant",
        text: "",
        turnId: "turn-2",
        streaming: true,
      }),
      consumeIds: ["m-1"],
    });
    const chat = findChat("c-1");
    expect(chat?.messages[0].pending).toBeUndefined();
    expect(chat?.messages[0].turnId).toBe("turn-2");
    expect(chat?.latestTurn?.id).toBe("turn-2");
  });

  it("records activities in order", () => {
    seed("c-1", API, "2026-07-25T12:00:00.000Z");
    for (const summary of ["read a file", "ran a command"]) {
      appendActivity("c-1", {
        id: `a-${summary}`,
        turnId: "turn-1",
        kind: "tool.completed",
        tone: "tool",
        summary,
        detail: null,
        createdAt: "2026-07-25T12:00:00.000Z",
      });
    }
    expect(findChat("c-1")?.activities.map((a) => a.summary)).toEqual([
      "read a file",
      "ran a command",
    ]);
  });

  it("settles a turn with its final text and cost", () => {
    seed("c-1", API, "2026-07-25T12:00:00.000Z");
    appendTurnStart("c-1", {
      turn: runningTurn,
      userMessage: message({ id: "m-1" }),
      assistantMessage: message({
        id: "m-2",
        role: "assistant",
        text: "",
        streaming: true,
      }),
    });
    completeTurn("c-1", {
      turnId: "turn-1",
      assistantMessageId: "m-2",
      text: "done",
      state: "completed",
      errorMessage: null,
      totalCostUsd: 0.02,
      endedAt: "2026-07-25T12:05:00.000Z",
    });
    const chat = findChat("c-1");
    expect(chat?.messages[1]).toMatchObject({ text: "done", streaming: false });
    expect(chat?.latestTurn).toMatchObject({
      state: "completed",
      totalCostUsd: 0.02,
    });
  });

  it("settles stale turns across every project, sparing live ones", () => {
    for (const [id, repoPath] of [
      ["c-api", API],
      ["c-solo", SOLO],
      ["c-live", WEB],
    ] as const) {
      seed(id, repoPath, "2026-07-25T12:00:00.000Z");
      appendTurnStart(id, {
        turn: runningTurn,
        userMessage: message({ id: `${id}-m1` }),
        assistantMessage: message({
          id: `${id}-m2`,
          role: "assistant",
          text: "partial",
          streaming: true,
        }),
      });
    }

    const settled = settleStaleTurns(
      (chatId) => chatId === "c-live",
      "the server stopped while this turn was running"
    );
    expect([...settled].sort()).toEqual(["c-api", "c-solo"]);
    expect(findChat("c-api")?.latestTurn?.state).toBe("interrupted");
    // Whatever streamed before the crash is kept, not discarded.
    expect(findChat("c-api")?.messages[1].text).toBe("partial");
    expect(findChat("c-api")?.messages[1].streaming).toBe(false);
    expect(findChat("c-live")?.latestTurn?.state).toBe("running");
  });

  it("drops a deleted chat's messages and activities with it", () => {
    seed("c-1", API, "2026-07-25T12:00:00.000Z");
    appendTurnStart("c-1", {
      turn: runningTurn,
      userMessage: message({ id: "m-1" }),
      assistantMessage: message({ id: "m-2", role: "assistant" }),
    });
    removeChat("c-1");
    expect(findChat("c-1")).toBeUndefined();
    expect(allChats()).toEqual([]);
  });

  it("drops a write for a chat deleted mid-turn instead of resurrecting it", () => {
    seed("c-1", API, "2026-07-25T12:00:00.000Z");
    removeChat("c-1");
    expect(appendPendingMessage("c-1", message({ id: "m-1" }))).toBeUndefined();
    expect(findChat("c-1")).toBeUndefined();
  });
});
