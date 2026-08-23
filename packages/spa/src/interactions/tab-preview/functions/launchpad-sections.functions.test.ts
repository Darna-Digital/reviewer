import { IconMessage } from "@tabler/icons-react";
import { describe, expect, it } from "vitest";
import {
  filterLaunchpadGroups,
  type LaunchpadGroup,
  type LaunchpadSection,
} from "./launchpad-sections.functions";

const section = (title: string): LaunchpadSection => ({
  id: title,
  href: `/${title}`,
  title,
  icon: IconMessage,
  mode: "code",
});

const GROUPS: ReadonlyArray<LaunchpadGroup> = [
  {
    title: "Project",
    sections: [section("Local changes"), section("Browse")],
    minting: false,
  },
  {
    title: "Sessions",
    sections: [section("All sessions"), section("Fix the resize handle")],
    minting: true,
  },
];

const titles = (groups: ReadonlyArray<LaunchpadGroup>): string[] =>
  groups.flatMap((group) => group.sections.map((s) => s.title));

describe("filterLaunchpadGroups", () => {
  it("hands back the grid it was given when nothing has been typed", () => {
    expect(filterLaunchpadGroups(GROUPS, "")).toBe(GROUPS);
    expect(filterLaunchpadGroups(GROUPS, "   ")).toBe(GROUPS);
  });

  it("keeps the cards whose titles carry what was typed", () => {
    expect(titles(filterLaunchpadGroups(GROUPS, "res"))).toEqual([
      "Fix the resize handle",
    ]);
  });

  it("does not mind the case it was typed in", () => {
    expect(titles(filterLaunchpadGroups(GROUPS, "BROWSE"))).toEqual(["Browse"]);
  });

  it("takes the words in any order", () => {
    expect(titles(filterLaunchpadGroups(GROUPS, "changes local"))).toEqual([
      "Local changes",
    ]);
  });

  it("drops a group left with nothing rather than heading a gap", () => {
    expect(filterLaunchpadGroups(GROUPS, "browse").map((g) => g.title)).toEqual(
      ["Project"]
    );
  });

  it("narrows the mint tile by its own name", () => {
    const sessions = filterLaunchpadGroups(GROUPS, "sessions");

    expect(sessions.some((group) => group.minting)).toBe(false);
    expect(
      filterLaunchpadGroups(GROUPS, "new session").some(
        (group) => group.minting
      )
    ).toBe(true);
  });

  it("keeps a group that has only the mint tile left", () => {
    expect(filterLaunchpadGroups(GROUPS, "new session")).toHaveLength(1);
  });

  it("comes back empty when nothing matches", () => {
    expect(filterLaunchpadGroups(GROUPS, "nothing here")).toEqual([]);
  });
});
