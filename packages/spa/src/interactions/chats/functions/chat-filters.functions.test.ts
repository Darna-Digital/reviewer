import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChatPlaces } from "@reviewer/core/chats";
import {
  ALL_PLACES,
  chatListFilters,
  resolvePlaceFilter,
  samePlace,
} from "./chat-filters.functions";

const places: ChatPlaces = {
  workspaces: [{ id: "ws-platform", name: "platform", count: 3 }],
  repos: [
    { path: "/home/dev", name: "dev", count: 2 },
    { path: "/home/side", name: "side", count: 1 },
  ],
};

afterEach(() => {
  vi.useRealTimers();
});

describe("chatListFilters", () => {
  it("asks for everything when neither filter is set", () => {
    expect(chatListFilters(ALL_PLACES, "all")).toEqual({
      search: "",
      workspace: null,
      repo: null,
      since: null,
    });
  });

  it("carries the chosen workspace's id", () => {
    const filters = chatListFilters(
      { kind: "workspace", id: "ws-platform" },
      "all"
    );
    expect(filters.workspace).toBe("ws-platform");
    expect(filters.repo).toBeNull();
  });

  it("carries the chosen repository's path", () => {
    const filters = chatListFilters(
      { kind: "repo", path: "/home/side" },
      "all"
    );
    expect(filters.repo).toBe("/home/side");
    expect(filters.workspace).toBeNull();
  });

  it("turns a time window into the cutoff the server compares against", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00.000Z"));
    expect(chatListFilters(ALL_PLACES, "7d").since).toBe(
      "2026-08-06T12:00:00.000Z"
    );
  });

  // The query is keyed on what it asks for, so a cutoff that moved every
  // millisecond would make every visit to the list a fresh cache entry.
  it("holds the cutoff still between ticks of the clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00.000Z"));
    const first = chatListFilters(ALL_PLACES, "30d").since;
    vi.setSystemTime(new Date("2026-08-13T12:00:12.345Z"));
    expect(chatListFilters(ALL_PLACES, "30d").since).toBe(first);
  });
});

describe("samePlace", () => {
  it("tells a workspace from a repository of the same name", () => {
    expect(
      samePlace({ kind: "workspace", id: "/x" }, { kind: "repo", path: "/x" })
    ).toBe(false);
    expect(
      samePlace({ kind: "repo", path: "/x" }, { kind: "repo", path: "/x" })
    ).toBe(true);
  });
});

describe("resolvePlaceFilter", () => {
  it("keeps a filter naming a workspace that still has sessions", () => {
    const place = { kind: "workspace", id: "ws-platform" } as const;
    expect(resolvePlaceFilter(places, place)).toBe(place);
  });

  it("keeps a filter naming a repository that still has sessions", () => {
    const place = { kind: "repo", path: "/home/side" } as const;
    expect(resolvePlaceFilter(places, place)).toBe(place);
  });

  it("steps aside when the place it names has none left", () => {
    expect(
      resolvePlaceFilter(places, { kind: "workspace", id: "ws-gone" })
    ).toBe(ALL_PLACES);
    expect(
      resolvePlaceFilter(places, { kind: "repo", path: "/home/gone" })
    ).toBe(ALL_PLACES);
  });

  // Mid-load every place is absent, which is not the same as gone: dropping
  // the filter then would silently widen the list the moment it arrives.
  it("holds the filter while the places are still unknown", () => {
    const place = { kind: "repo", path: "/home/side" } as const;
    expect(resolvePlaceFilter({ workspaces: [], repos: [] }, place)).toBe(
      place
    );
  });
});
