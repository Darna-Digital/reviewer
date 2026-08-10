// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
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
const { resetSearchStore, useRegisterCommands } =
  await import("../adapters/search.store");

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

  it("opens the command list on Cmd+K from a page that shows no files", async () => {
    const user = setup();

    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByText("Go to Local Changes")).toBeDefined();
    expect(screen.getByText("Git Actions…")).toBeDefined();
  });

  it("opens even while the page's own text box has focus", async () => {
    const user = setup();

    await user.click(screen.getByLabelText("Message"));
    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByText("Go to Local Changes")).toBeDefined();
  });

  it("offers the commands the page registered alongside its own", async () => {
    const user = setup();

    await user.keyboard("{Meta>}k{/Meta}");
    await user.click(screen.getByText("Do the Page Thing"));

    expect(pageCommand).toHaveBeenCalledOnce();
  });

  it("forgets a page's commands once it leaves", async () => {
    const user = setup({ withPage: false });

    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.queryByText("Do the Page Thing")).toBeNull();
  });

  it("runs a git command straight from another page", async () => {
    const user = setup();

    await user.keyboard("{Meta>}k{/Meta}");
    await user.click(screen.getByText("Git Actions…"));
    await user.click(screen.getByText("Fetch"));

    expect(git.fetch).toHaveBeenCalledOnce();
  });

  it("checks out a branch found by name", async () => {
    const user = setup();

    await user.keyboard("{Meta>}k{/Meta}");
    await user.click(screen.getByText("Git Actions…"));
    await user.click(screen.getByText("Switch Branch…"));
    await user.type(dialog()!, "207{Enter}");

    expect(git.checkout).toHaveBeenCalledWith("task/BMB-207");
  });

  it("drops the list you had walked into when Cmd+K is pressed again", async () => {
    const user = setup();

    await user.keyboard("{Meta>}k{/Meta}");
    await user.click(screen.getByText("Git Actions…"));
    await user.keyboard("{Meta>}k{/Meta}");

    expect(screen.getByText("Go to Local Changes")).toBeDefined();
    expect(screen.queryByText("Fetch")).toBeNull();
  });

  it("goes straight to the file search on a double-tap of Shift", async () => {
    const user = setup();

    await user.keyboard("{Shift>}{/Shift}");
    await user.keyboard("{Shift>}{/Shift}");

    expect(screen.getByText(/Type to find a file/)).toBeDefined();
  });

  it("goes straight to the text search on Cmd+Shift+F", async () => {
    const user = setup();

    await user.keyboard("{Meta>}{Shift>}f{/Shift}{/Meta}");

    expect(screen.getByText("Type to search.")).toBeDefined();
  });

  it("opens a file on the code page when the current one cannot show it", async () => {
    const user = setup();

    await user.keyboard("{Shift>}{/Shift}");
    await user.keyboard("{Shift>}{/Shift}");
    await user.type(dialog()!, "queries");
    await user.click(screen.getByRole("button", { name: /queries\.ts/ }));

    expect(navigate).toHaveBeenCalledWith({
      to: "/modes/code/commit",
      search: { file: "packages/spa/src/lib/queries.ts" },
    });
  });

  it("opens a file in place when the page already shows files", async () => {
    pathname = "/modes/code/review/12";
    const user = setup();

    await user.keyboard("{Shift>}{/Shift}");
    await user.keyboard("{Shift>}{/Shift}");
    await user.type(dialog()!, "queries");
    await user.click(screen.getByRole("button", { name: /queries\.ts/ }));

    const [call] = navigate.mock.calls;
    expect(call[0].to).toBe(".");
    expect(call[0].search({ path: "kept" })).toEqual({
      path: "kept",
      file: "packages/spa/src/lib/queries.ts",
    });
  });
});
