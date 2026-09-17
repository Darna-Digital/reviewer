import { describe, expect, it, vi } from "vitest";
import type { WindowTab } from "../interfaces/window-tabs.interfaces";
import {
  initialWindowTabs,
  PROJECT_TAB_ID,
  SESSIONS_TAB_ID,
  stripTabs,
  withPinnedTabs,
} from "./window-tabs.functions";

vi.mock("@reviewer/feature-flags", () => ({
  isFeatureEnabled: (flag: string) => flag !== "sessions-button",
}));

const session: WindowTab = {
  id: "a",
  href: "/modes/agent-session/abc",
  title: "a",
  kind: "session",
};

const saved: ReadonlyArray<WindowTab> = [
  {
    id: PROJECT_TAB_ID,
    href: "/modes/code/review",
    title: "Review",
    kind: "project",
  },
  {
    id: SESSIONS_TAB_ID,
    href: "/modes/agent-session",
    title: "Sessions",
    kind: "sessions",
  },
  session,
];

describe("a strip saved before collaboration was taken out", () => {
  it("hands Code back its own location when the saved one has gone", () => {
    const [code] = withPinnedTabs([
      {
        id: PROJECT_TAB_ID,
        href: "/modes/collaboration/projects/p1",
        title: "Collaboration",
        kind: "project",
      },
    ]);
    expect(code).toMatchObject({
      href: "/modes/code/review",
      title: "Review",
    });
  });
});

describe("a switched-off sessions button", () => {
  it("holds its tab in the strip, where the launchpad still lists it", () => {
    expect(initialWindowTabs().tabs.map((t) => t.id)).toContain(
      SESSIONS_TAB_ID
    );
  });

  it("leaves its tab out of the bar, and out of ⌘<digit> with it", () => {
    expect(stripTabs(initialWindowTabs()).map((t) => t.id)).toEqual([
      PROJECT_TAB_ID,
    ]);
  });

  it("shows its tab for as long as the window is on it", () => {
    const tabs = withPinnedTabs(saved);
    expect(
      stripTabs({ tabs, activeId: SESSIONS_TAB_ID }).map((t) => t.id)
    ).toEqual([PROJECT_TAB_ID, SESSIONS_TAB_ID, "a"]);
    expect(stripTabs({ tabs, activeId: "a" }).map((t) => t.id)).toEqual([
      PROJECT_TAB_ID,
      "a",
    ]);
  });
});
