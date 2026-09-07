// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as RouterModule from "@tanstack/react-router";

let pathname = "/modes/code/commit";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof RouterModule>()),
  useNavigate: () => vi.fn(),
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname } }),
}));
vi.mock("@/lib/ui-prefs", () => ({
  useUiPrefs: () => ({}),
  // The composer's remembered session, read by the chat-mode store on load.
  readUiPrefs: () => ({ lastSession: { mode: "build" } }),
  rememberSession: () => {},
}));
vi.mock("@/lib/queries", () => ({
  useRepo: () => ({ data: undefined }),
  // The launchpad asks which conversations have an agent working in them.
  useRecentChats: () => ({ data: undefined }),
}));
vi.mock("@/components/layout/window-bar", () => ({ WindowBar: () => null }));
// The mill boots a second copy of the app in a frame; what it photographs has
// nothing to do with which surface the frame is on.
vi.mock("@/interactions/tab-preview/components/tab-snapshot-mill", () => ({
  TabSnapshotMill: () => null,
}));
vi.mock("@/interactions/search/components/search-host", () => ({
  SearchHost: () => <div data-testid="search-host" />,
}));

// The launchpad's cards measure themselves, and jsdom lays nothing out.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

const { WindowFrame } = await import("./window-frame");

const mountedOn = (page: string) => {
  pathname = page;
  render(
    <WindowFrame>
      <main>page</main>
    </WindowFrame>
  );
  return screen.queryByTestId("search-host") !== null;
};

afterEach(cleanup);

describe("WindowFrame", () => {
  it("hosts the search for every code page, whichever shell renders it", () => {
    expect(mountedOn("/modes/code/commit")).toBe(true);
    cleanup();
    expect(mountedOn("/modes/agent-session/abc")).toBe(true);
  });

  it("leaves the collaboration prototype to its own search", () => {
    expect(mountedOn("/modes/experimentation/collaboration")).toBe(false);
    cleanup();
    expect(mountedOn("/modes/experimentation/collaboration/inbox")).toBe(false);
  });

  it("hosts the search on the surfaces outside the modes too", () => {
    expect(mountedOn("/settings")).toBe(true);
  });

  it("still renders the page it wraps", () => {
    mountedOn("/modes/code/commit");

    expect(screen.getByRole("main")).toBeDefined();
  });
});
