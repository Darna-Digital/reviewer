import { describe, expect, it } from "vitest";
import { ALL_PLACES, NO_FILTERS } from "./chat-filters.functions";
import { mockStoredChatFiltersDependencies } from "./stored-chat-filters.functions.mock";
import { createStoredChatFilters } from "./stored-chat-filters.functions";

describe("createStoredChatFilters", () => {
  it("reads back what it wrote", () => {
    const { deps, written } = mockStoredChatFiltersDependencies();
    const stored = createStoredChatFilters(deps);

    stored.save({ place: { kind: "workspace", id: "ws-1" }, date: "7d" });

    expect(written).toEqual([
      '{"place":{"kind":"workspace","id":"ws-1"},"date":"7d"}',
    ]);
    expect(stored.load()).toEqual({
      place: { kind: "workspace", id: "ws-1" },
      date: "7d",
    });
  });

  it("starts unfiltered when nothing was stored", () => {
    const { deps } = mockStoredChatFiltersDependencies();
    expect(createStoredChatFilters(deps).load()).toEqual(NO_FILTERS);
  });

  it("drops a time window that is no longer on offer", () => {
    const { deps } = mockStoredChatFiltersDependencies(
      '{"place":{"kind":"repo","path":"/home/dev"},"date":"90d"}'
    );
    expect(createStoredChatFilters(deps).load()).toEqual({
      place: { kind: "repo", path: "/home/dev" },
      date: "all",
    });
  });

  it("carries a project stored before workspaces over as its repository", () => {
    const { deps } = mockStoredChatFiltersDependencies(
      '{"project":"/home/dev","date":"7d"}'
    );
    expect(createStoredChatFilters(deps).load()).toEqual({
      place: { kind: "repo", path: "/home/dev" },
      date: "7d",
    });
  });

  it("survives storage holding something that is not filters", () => {
    for (const raw of [
      "not json",
      "null",
      '{"project":7}',
      '{"place":{"kind":"workspace"}}',
      '{"place":"all"}',
    ]) {
      const { deps } = mockStoredChatFiltersDependencies(raw);
      expect(createStoredChatFilters(deps).load().place).toEqual(ALL_PLACES);
    }
  });
});
