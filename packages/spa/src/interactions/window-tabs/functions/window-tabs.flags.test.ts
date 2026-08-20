import { describe, expect, it, vi } from "vitest";
import type { WindowTab } from "../interfaces/window-tabs.interfaces";
import {
  COLLABORATION_TAB_ID,
  initialWindowTabs,
  PROJECT_TAB_ID,
  SESSIONS_TAB_ID,
  stripTabs,
  trackLocation,
  withPinnedTabs,
} from "./window-tabs.functions";

vi.mock("@byconvo/feature-flags", () => ({
  isFeatureEnabled: (flag: string) =>
    flag !== "collaboration-button" && flag !== "sessions-button",
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
    href: "/modes/code/commit",
    title: "Local changes",
    kind: "project",
  },
  {
    id: COLLABORATION_TAB_ID,
    href: "/modes/collaboration",
    title: "Collaboration",
    kind: "collaboration",
  },
  {
    id: SESSIONS_TAB_ID,
    href: "/modes/agent-session",
    title: "Sessions",
    kind: "sessions",
  },
  session,
];

describe("a switched-off collaboration button", () => {
  it("keeps its tab out of the strip a window opens with", () => {
    expect(initialWindowTabs().tabs.map((t) => t.id)).toEqual([
      PROJECT_TAB_ID,
      SESSIONS_TAB_ID,
    ]);
  });

  it("drops its tab from a strip saved while it was on", () => {
    expect(withPinnedTabs(saved).map((t) => t.id)).toEqual([
      PROJECT_TAB_ID,
      SESSIONS_TAB_ID,
      "a",
    ]);
  });

  it("hands Code back its own location when a saved strip left it there", () => {
    const [code] = withPinnedTabs([
      {
        id: PROJECT_TAB_ID,
        href: "/modes/collaboration/projects/p1",
        title: "Collaboration",
        kind: "project",
      },
    ]);
    expect(code).toMatchObject({
      href: "/modes/code/commit",
      title: "Local changes",
    });
  });

  it("leaves the strip alone when its route is reached by URL", () => {
    const before = initialWindowTabs();
    expect(
      trackLocation(
        before,
        "/modes/collaboration/projects/p1",
        "/modes/collaboration/projects/p1"
      )
    ).toBe(before);
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
