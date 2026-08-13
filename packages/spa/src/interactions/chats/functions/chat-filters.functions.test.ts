import { describe, expect, it } from "vitest";
import type { ChatSummary } from "@byconvo/core/chats";
import {
  ALL_PROJECTS,
  filterChats,
  projectFilterLabel,
  projectsOf,
  showsProject,
} from "./chat-filters.functions";

const chat = (
  id: string,
  projectPath: string,
  projectName: string,
  updatedAt: string,
  repoName = "api"
): ChatSummary => ({
  id,
  origin: {
    projectPath,
    projectName,
    repoPath: `${projectPath}/${repoName}`,
    repoName,
  },
  title: id,
  provider: "claude",
  model: "opus",
  branch: "main",
  createdAt: updatedAt,
  updatedAt,
  messageCount: 1,
  lastMessage: null,
  turnState: null,
});

const NOW = "2026-08-13T12:00:00.000Z";
const LAST_YEAR = "2025-08-13T12:00:00.000Z";

const chats = [
  chat("c-api", "/home/dev", "dev", NOW, "api"),
  // Same project, a second git root — a multi-repo project is still one project.
  chat("c-web", "/home/dev", "dev", NOW, "web"),
  chat("c-side", "/home/side", "side", LAST_YEAR),
];

describe("projectsOf", () => {
  it("counts a multi-root project's sessions under the one project", () => {
    expect(projectsOf(chats)).toEqual([
      { path: "/home/dev", name: "dev", count: 2 },
      { path: "/home/side", name: "side", count: 1 },
    ]);
  });

  it("keeps two projects that share a folder name apart", () => {
    const shared = [
      chat("c-1", "/work/api", "api", NOW),
      chat("c-2", "/side/api", "api", NOW),
    ];
    expect(projectsOf(shared).map((p) => p.path)).toEqual([
      "/side/api",
      "/work/api",
    ]);
  });

  it("has nothing to offer for an empty list", () => {
    expect(projectsOf([])).toEqual([]);
  });
});

describe("filterChats", () => {
  it("passes everything through by default", () => {
    expect(
      filterChats(chats, { project: ALL_PROJECTS, date: "all" })
    ).toHaveLength(3);
  });

  it("narrows to one project, across all of its roots", () => {
    const filtered = filterChats(chats, {
      project: "/home/dev",
      date: "all",
    });
    expect(filtered.map((c) => c.id)).toEqual(["c-api", "c-web"]);
  });

  it("combines the project and the time window", () => {
    expect(filterChats(chats, { project: "/home/side", date: "30d" })).toEqual(
      []
    );
    expect(
      filterChats(chats, { project: "/home/side", date: "all" }).map(
        (c) => c.id
      )
    ).toEqual(["c-side"]);
  });
});

describe("showsProject", () => {
  it("labels rows only when more than one project is on screen", () => {
    expect(showsProject(chats, { project: ALL_PROJECTS, date: "all" })).toBe(
      true
    );
    expect(showsProject(chats, { project: "/home/dev", date: "all" })).toBe(
      false
    );
    expect(
      showsProject(chats.slice(0, 2), { project: ALL_PROJECTS, date: "all" })
    ).toBe(false);
  });
});

describe("projectFilterLabel", () => {
  it("names the chosen project, or says all of them", () => {
    expect(projectFilterLabel(chats, ALL_PROJECTS)).toBe("All projects");
    expect(projectFilterLabel(chats, "/home/side")).toBe("side");
  });

  it("falls back to the path for a project with nothing left in it", () => {
    expect(projectFilterLabel(chats, "/home/gone")).toBe("/home/gone");
  });
});
