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
  readUiPrefs: () => ({ lastSession: {} }),
  rememberSession: () => {},
}));
vi.mock("@/lib/queries", () => ({
  useRepo: () => ({ data: undefined }),
  useRecentChats: () => ({ data: undefined }),
}));
vi.mock("@/components/layout/window-bar", () => ({ WindowBar: () => null }));
vi.mock("@/interactions/search/components/search-host", () => ({
  SearchHost: () => <div data-testid="search-host" />,
}));

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
  it("hosts the search for every page, whichever shell renders it", () => {
    expect(mountedOn("/modes/code/commit")).toBe(true);
    cleanup();
    expect(mountedOn("/modes/agent-session/abc")).toBe(true);
    cleanup();
    expect(mountedOn("/settings")).toBe(true);
  });

  it("still renders the page it wraps", () => {
    mountedOn("/modes/code/commit");

    expect(screen.getByRole("main")).toBeDefined();
  });
});
