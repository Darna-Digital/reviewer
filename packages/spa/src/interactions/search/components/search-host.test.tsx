// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IconFile } from "@tabler/icons-react";
import { useMemo } from "react";
import type * as RouterModule from "@tanstack/react-router";
import type * as SearchAdapter from "../adapters/search.hook.adapter";
import type { Command } from "../interfaces/search.interfaces";

const FILES = [
  "packages/spa/src/lib/queries.ts",
  "packages/spa/src/components/layout/app-shell.tsx",
];

const navigate = vi.fn();
const git = vi.hoisted(() => ({
  refresh: vi.fn(),
  fetch: vi.fn(),
  pull: vi.fn(),
  push: vi.fn(),
  createBranch: vi.fn(),
  checkout: vi.fn(),
}));

const BRANCHES = [
  {
    name: "master",
    sha: "a1",
    isCurrent: true,
    upstream: "origin/master",
    ahead: 0,
    behind: 0,
    committedAt: "2026-08-10",
    subject: "latest",
  },
  {
    name: "task/BMB-207",
    sha: "b2",
    isCurrent: false,
    upstream: null,
    ahead: 2,
    behind: 0,
    committedAt: "2026-08-09",
    subject: "wip",
  },
];
/** The page the host is mounted on; drives where a result opens. */
let pathname = "/modes/agent-session";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof RouterModule>()),
  useNavigate: () => navigate,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown;
  }) => select({ location: { pathname } }),
}));
vi.mock("@/lib/queries", () => ({
  useFiles: () => ({ data: { paths: FILES, gitStatus: [] } }),
  useRepo: () => ({ data: { currentBranch: "main", github: null } }),
  useBranches: () => ({ data: BRANCHES }),
  useRemoteBranches: () => ({ data: [] }),
}));
vi.mock("@/interactions/git-actions/adapters/git-actions.hook.adapter", () => ({
  useGitActions: () => git,
}));
vi.mock("../adapters/search.hook.adapter", async (importOriginal) => ({
  ...(await importOriginal<typeof SearchAdapter>()),
  useGrepSearch: () => ({
    data: { matches: [], truncated: false },
    isFetching: false,
    error: null,
  }),
}));
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
}));
Element.prototype.scrollIntoView = () => {};

const { SearchHost } = await import("./search-host");
const {
  openSearch,
  resetSearchStore,
  toggleCommandSearch,
  useRegisterCommands,
} = await import("../adapters/search.store");

const openCommands = () => act(() => toggleCommandSearch());
const openFiles = () => act(() => openSearch("files"));
const openText = () => act(() => openSearch("text"));

const pageCommand = vi.fn();

/** A page that offers a command of its own while it is on screen. */
function Page() {
  const commands = useMemo<ReadonlyArray<Command>>(
    () => [
      {
        id: "page-thing",
        label: "Do the Page Thing",
        group: "Page",
        icon: IconFile,
        run: pageCommand,
      },
    ],
    []
  );
  useRegisterCommands("page", commands);
  return <textarea aria-label="Message" />;
}

const setup = ({ withPage = true } = {}) => {
  const user = userEvent.setup();
  render(
    <>
      <SearchHost />
      {withPage && <Page />}
    </>
  );
  return user;
};

const dialog = () => screen.queryByRole("textbox", { name: /^Search/ });

beforeEach(() => {
  vi.clearAllMocks();
  pathname = "/modes/agent-session";
});

afterEach(() => {
  cleanup();
  resetSearchStore();
});

describe("SearchHost", () => {
  it("stays out of the way until asked for", () => {
    setup();

    expect(dialog()).toBeNull();
  });

  it("opens the command list from a page that shows no files", () => {
    setup();

    openCommands();

    expect(screen.getByText("Go to review")).toBeDefined();
    expect(screen.getByText("Git actions…")).toBeDefined();
  });

  it("opens even while the page's own text box has focus", async () => {
    const user = setup();

    await user.click(screen.getByLabelText("Message"));
    openCommands();

    expect(screen.getByText("Go to review")).toBeDefined();
  });

  it("offers the commands the page registered alongside its own", async () => {
    const user = setup();

    openCommands();
    await user.click(screen.getByText("Do the Page Thing"));

    expect(pageCommand).toHaveBeenCalledOnce();
  });

  it("forgets a page's commands once it leaves", () => {
    setup({ withPage: false });

    openCommands();

    expect(screen.queryByText("Do the Page Thing")).toBeNull();
  });

  it("runs a git command straight from another page", async () => {
    const user = setup();

    openCommands();
    await user.click(screen.getByText("Git actions…"));
    await user.click(screen.getByText("Fetch"));

    expect(git.fetch).toHaveBeenCalledOnce();
  });

  it("checks out a branch found by name", async () => {
    const user = setup();

    openCommands();
    await user.click(screen.getByText("Git actions…"));
    await user.click(screen.getByText("Switch branch…"));
    await user.type(dialog()!, "207{Enter}");

    expect(git.checkout).toHaveBeenCalledWith("task/BMB-207");
  });

  it("drops the list you had walked into when the commands are asked for again", async () => {
    const user = setup();

    openCommands();
    await user.click(screen.getByText("Git actions…"));
    openCommands();

    expect(screen.getByText("Go to review")).toBeDefined();
    expect(screen.queryByText("Fetch")).toBeNull();
  });

  it("goes straight to the file search", () => {
    setup();

    openFiles();

    expect(screen.getByText(/Type to find a file/)).toBeDefined();
  });

  it("goes straight to the text search", () => {
    setup();

    openText();

    expect(screen.getByText("Type to search.")).toBeDefined();
  });

  it.each([
    "/modes/agent-session",
    "/modes/code/review/pull/12",
    "/modes/code/browse/commit/abc123",
    "/modes/code/browse",
  ])("opens a file in a new browse tab from %s", async (page) => {
    pathname = page;
    const user = setup();

    openFiles();
    await user.type(dialog()!, "queries");
    await user.click(screen.getByRole("button", { name: /queries\.ts/ }));

    expect(navigate).toHaveBeenCalledWith({
      to: "/modes/code/browse",
      search: {
        file: "packages/spa/src/lib/queries.ts",
        line: undefined,
        tab: "permanent",
      },
    });
  });
});
