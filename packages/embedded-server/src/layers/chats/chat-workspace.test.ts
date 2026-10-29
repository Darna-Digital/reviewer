import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Chat } from "@reviewer/core/chats";
import { closeDatabase, openDatabase } from "../db/database.ts";
import {
  createWorkspace,
  deleteWorkspace,
  updateWorkspace,
} from "../workspace/saved-workspaces.ts";
import { chatTurnProgram, withWorkspace } from "./providers.ts";
import { findChat, insertChat } from "./store.ts";

const API = "/work/api";
const WEB = "/work/web";
const DOCS = "/work/docs";

beforeEach(() => openDatabase(":memory:"));
afterEach(closeDatabase);

const started = (workspaceId: string | null) =>
  insertChat({
    id: `c-${Math.random()}`,
    repoPath: WEB,
    title: "t",
    provider: "claude",
    model: "",
    effort: "",
    access: "fullAccess",
    branch: "main",
    createdAt: "2026-01-01T00:00:00.000Z",
    workspaceId,
  });

describe("a chat started in a workspace", () => {
  it("is the workspace's, with its repositories as they stand now", () => {
    const { id } = createWorkspace("Shop", [WEB, API]);
    const chat = started(id);
    expect(chat.workspace).toEqual({ id, name: "Shop", roots: [WEB, API] });
    updateWorkspace(id, { roots: [WEB, API, DOCS] });
    expect(findChat(chat.id)?.workspace?.roots).toEqual([WEB, API, DOCS]);
  });

  it("keeps its own root alone once the workspace is gone", () => {
    const { id } = createWorkspace("Shop", [WEB, API]);
    const chat = started(id);
    deleteWorkspace(id);
    expect(findChat(chat.id)?.workspace).toBeUndefined();
  });

  it("of a lone repository has no workspace", () => {
    expect(started(null).workspace).toBeUndefined();
  });
});

describe("a workspace chat's turn", () => {
  const chat = (provider: Chat["provider"]): Chat => ({
    ...started(null),
    provider,
  });

  it("gives the agents that take them the other repositories", () => {
    for (const provider of ["claude", "codex", "cursor"] as const) {
      const program = chatTurnProgram(
        chat(provider),
        "hi",
        { id: null, resume: false },
        [API]
      );
      // The program runs through a login shell, which quotes each argument.
      const command = program.args.join(" ");
      expect(command).toMatch(/'?--add-dir'? '?\/work\/api'?/);
    }
  });

  it("tells a fresh session which repositories it works across", () => {
    const told = withWorkspace(
      "fix it",
      { id: "w", name: "Shop", roots: [WEB, API] },
      WEB
    );
    expect(told).toContain("“Shop”");
    expect(told).toContain(`- web: ${WEB} (your working directory)`);
    expect(told).toContain(`- api: ${API}`);
    expect(told.endsWith("fix it")).toBe(true);
  });

  it("tells a chat of one repository nothing", () => {
    expect(withWorkspace("fix it", undefined, WEB)).toBe("fix it");
  });
});
