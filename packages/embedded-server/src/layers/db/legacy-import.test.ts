import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findChat, listChatSummaries } from "../chats/store.ts";
import { comments } from "../comments/comments.repository.sqlite.ts";
import { devCommands } from "../local-dev/local-dev.repository.sqlite.ts";
import { plans } from "../plans/plans.repository.sqlite.ts";
import { readBoard } from "../tasks/store.ts";
import { threads } from "../threads/store.ts";
import { closeDatabase, openDatabase } from "./database.ts";
import { importLegacyJson } from "./legacy-import.ts";
import { rememberProject } from "./scope.ts";

let project: string;
let api: string;
let web: string;

const write = (root: string, name: string, value: unknown) => {
  mkdirSync(`${root}/.byconvo`, { recursive: true });
  writeFileSync(
    `${root}/.byconvo/${name}`,
    `${JSON.stringify(value, null, 2)}\n`
  );
};

const legacyChat = (id: string, title: string) => ({
  id,
  title,
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
      id: `${id}-m1`,
      role: "user",
      text: "first",
      turnId: "turn-1",
      streaming: false,
      createdAt: "2026-07-25T12:00:00.000Z",
    },
    {
      id: `${id}-m2`,
      role: "assistant",
      text: "second",
      turnId: "turn-1",
      streaming: false,
      createdAt: "2026-07-25T12:00:01.000Z",
    },
  ],
  activities: [],
  latestTurn: null,
});

beforeEach(() => {
  openDatabase(":memory:");
  project = mkdtempSync(`${tmpdir()}/byconvo-import-`);
  api = `${project}/api`;
  web = `${project}/web`;
  for (const root of [api, web]) mkdirSync(root, { recursive: true });
  rememberProject(project, [
    { name: "api", path: api },
    { name: "web", path: web },
  ]);
});
afterEach(() => {
  closeDatabase();
  rmSync(project, { recursive: true, force: true });
});

describe("legacy .byconvo import", () => {
  it("takes every root of a multi-repo project across, once", () => {
    write(api, "chats.json", [legacyChat("c-api", "api chat")]);
    write(web, "chats.json", [legacyChat("c-web", "web chat")]);

    expect(importLegacyJson(api)).toContain("chats");
    expect(importLegacyJson(web)).toContain("chats");

    const listed = listChatSummaries();
    expect(listed.map((c) => c.title).sort()).toEqual(["api chat", "web chat"]);
    // Both roots belong to one project, so both chats group under it.
    expect(new Set(listed.map((c) => c.origin.projectPath))).toEqual(
      new Set([project])
    );

    // A second open imports nothing — the record says it is already done.
    expect(importLegacyJson(api)).toEqual([]);
    expect(listChatSummaries()).toHaveLength(2);
  });

  it("keeps a conversation's message order", () => {
    write(api, "chats.json", [legacyChat("c-1", "a chat")]);
    importLegacyJson(api);
    expect(findChat("c-1")?.messages.map((m) => m.text)).toEqual([
      "first",
      "second",
    ]);
  });

  it("carries comments, threads, plans, dev commands and the board across", () => {
    write(api, "comments.json", [
      {
        id: "c-1",
        filePath: "src/a.ts",
        side: "additions",
        lineNumber: 12,
        body: "looks good",
        author: "alice",
        createdAt: "2026-07-25T12:00:00.000Z",
        target: "worktree",
        source: "local",
      },
    ]);
    write(api, "threads.json", [
      {
        id: "t-1",
        title: "a session",
        agent: "terminal",
        branch: "main",
        taskKey: "T-1",
        initialPrompt: "",
        agentSessionId: null,
        createdAt: "2026-07-25T12:00:00.000Z",
        updatedAt: "2026-07-25T12:00:00.000Z",
        entries: [],
      },
    ]);
    write(api, "dev-commands.json", [
      {
        id: "d-1",
        name: "dev",
        command: "pnpm dev",
        createdAt: "2026-07-25T12:00:00.000Z",
        updatedAt: "2026-07-25T12:00:00.000Z",
      },
    ]);
    write(api, "tasks.json", {
      counter: 3,
      prefix: "API",
      columns: [{ id: "todo", name: "Todo", order: 0 }],
      cards: [
        {
          id: "card-1",
          key: "API-1",
          title: "ship it",
          description: "",
          column: "todo",
          order: 1,
          comments: [],
          createdAt: "2026-07-25T12:00:00.000Z",
          updatedAt: "2026-07-25T12:00:00.000Z",
        },
      ],
    });

    importLegacyJson(api);

    expect(comments.list(api).map((c) => c.body)).toEqual(["looks good"]);
    expect(threads.list(api).map((t) => t.id)).toEqual(["t-1"]);
    expect(devCommands.list(api).map((d) => d.name)).toEqual(["dev"]);
    const board = readBoard(api);
    expect(board.prefix).toBe("API");
    expect(board.counter).toBe(3);
    expect(board.cards.map((c) => c.key)).toEqual(["API-1"]);
    // No plans directory at all is not a failure, just nothing to import.
    expect(plans.list(api)).toEqual([]);
  });

  it("defaults thread fields that older files were written without", () => {
    write(api, "threads.json", [
      {
        id: "t-old",
        title: "old session",
        agent: "terminal",
        taskKey: null,
        createdAt: "2026-07-25T12:00:00.000Z",
        updatedAt: "2026-07-25T12:00:00.000Z",
        entries: [],
      },
    ]);
    importLegacyJson(api);
    expect(threads.list(api)[0]).toMatchObject({
      id: "t-old",
      branch: "",
      initialPrompt: "",
      agentSessionId: null,
    });
  });

  it("leaves a repository with no .byconvo folder empty and settled", () => {
    expect(importLegacyJson(web)).toEqual([
      "chats",
      "comments",
      "visual-comments",
      "threads",
      "tasks",
      "plans",
      "dev-commands",
    ]);
    expect(listChatSummaries()).toEqual([]);
    expect(importLegacyJson(web)).toEqual([]);
  });

  it("leaves the JSON files in place as a backup", () => {
    write(api, "chats.json", [legacyChat("c-1", "a chat")]);
    importLegacyJson(api);
    expect(() =>
      rmSync(`${api}/.byconvo/chats.json`, { force: false })
    ).not.toThrow();
  });
});
