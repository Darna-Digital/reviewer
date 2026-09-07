import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatProjectTally } from "@reviewer/core/chats";
import {
  ALL_PROJECTS,
  chatListFilters,
  resolveProjectFilter,
} from "./chat-filters.functions";

const projects: ReadonlyArray<ChatProjectTally> = [
  { path: "/home/dev", name: "dev", count: 2 },
  { path: "/home/side", name: "side", count: 1 },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("chatListFilters", () => {
  it("asks for everything when neither filter is set", () => {
    expect(chatListFilters(ALL_PROJECTS, "all")).toEqual({
      search: "",
      project: null,
      since: null,
    });
  });

  it("carries the chosen project's path", () => {
    expect(chatListFilters("/home/side", "all").project).toBe("/home/side");
  });

  it("turns a time window into the cutoff the server compares against", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00.000Z"));
    expect(chatListFilters(ALL_PROJECTS, "7d").since).toBe(
      "2026-08-06T12:00:00.000Z"
    );
  });

  // The query is keyed on what it asks for, so a cutoff that moved every
  // millisecond would make every visit to the list a fresh cache entry.
  it("holds the cutoff still between ticks of the clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00.000Z"));
    const first = chatListFilters(ALL_PROJECTS, "30d").since;
    vi.setSystemTime(new Date("2026-08-13T12:00:12.345Z"));
    expect(chatListFilters(ALL_PROJECTS, "30d").since).toBe(first);
  });
});

describe("resolveProjectFilter", () => {
  it("keeps a filter naming a project that still has sessions", () => {
    expect(resolveProjectFilter(projects, "/home/side")).toBe("/home/side");
  });

  it("steps aside when the project it names has none left", () => {
    expect(resolveProjectFilter(projects, "/home/gone")).toBe(ALL_PROJECTS);
  });

  // Mid-load every project is absent, which is not the same as gone: dropping
  // the filter then would silently widen the list the moment it arrives.
  it("holds the filter while the projects are still unknown", () => {
    expect(resolveProjectFilter([], "/home/side")).toBe("/home/side");
  });
});
