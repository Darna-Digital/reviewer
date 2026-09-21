// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BranchChoice,
  Command,
  ContentMatch,
  GrepOptions,
  GrepResults,
  SearchMode,
} from "../interfaces/search.interfaces";

const Icon = () => null;

const COMMANDS: ReadonlyArray<Command> = [
  {
    id: "git-push",
    label: "Push",
    group: "Git",
    submenu: "git",
    icon: Icon,
    keywords: "remote upload",
    run: vi.fn(),
  },
  {
    id: "go-settings",
    label: "Open settings",
    group: "Navigation",
    icon: Icon,
    keywords: "theme appearance",
    run: vi.fn(),
  },
];

const BRANCHES: ReadonlyArray<BranchChoice> = [
  {
    name: "master",
    ref: "master",
    group: "Local",
    isCurrent: true,
    hint: "current",
  },
  {
    name: "task/BMB-207",
    ref: "task/BMB-207",
    group: "Local",
    isCurrent: false,
    hint: "↑2",
  },
  {
    name: "origin/release",
    ref: "release",
    group: "Remote",
    isCurrent: false,
    hint: "origin",
  },
];

const FILES = [
  "packages/spa/src/lib/queries.ts",
  "packages/spa/src/components/layout/app-shell.tsx",
];

const match = (over: Partial<ContentMatch> = {}): ContentMatch => ({
  path: "packages/spa/src/lib/queries.ts",
  line: 12,
  column: 14,
  text: "export const useFiles = () => api.useQuery();",
  ...over,
});

const MATCHES: GrepResults = {
  matches: [
    match(),
    match({ line: 40, text: "  const files = useFiles();" }),
    match({
      path: "packages/spa/src/components/tree.tsx",
      line: 8,
      text: "import { useFiles } from '@/lib/queries';",
    }),
  ],
  truncated: false,
};

const state = vi.hoisted(() => ({
  data: undefined as GrepResults | undefined,
  isFetching: false,
  error: null as Error | null,
}));
const grep = vi.hoisted(() => vi.fn());

vi.mock("../adapters/search.hook.adapter", () => ({
  MIN_QUERY_LENGTH: 2,
  useGrepSearch: (query: string, options: GrepOptions, enabled: boolean) => {
    grep(query, options, enabled);
    return state;
  },
}));

vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
}));
// jsdom has no layout, so keeping the active row in view is a no-op here.
Element.prototype.scrollIntoView = () => {};

const { SearchDialog } = await import("./search-dialog");

const onOpenChange = vi.fn();
const onOpenFile = vi.fn();
const onOpenLocation = vi.fn();
const onCheckout = vi.fn();

/** Renders the dialog with `mode` as live state, the way the shell holds it. */
function Harness({ initialMode = "commands" as SearchMode, open = true }) {
  const [mode, setMode] = useState<SearchMode>(initialMode);
  return (
    <SearchDialog
      open={open}
      mode={mode}
      onOpenChange={onOpenChange}
      onModeChange={setMode}
      commands={COMMANDS}
      files={FILES}
      branches={BRANCHES}
      onOpenFile={onOpenFile}
      onOpenLocation={onOpenLocation}
      onCheckout={onCheckout}
    />
  );
}

const setup = (props: { initialMode?: SearchMode } = {}) => {
  const user = userEvent.setup();
  const view = render(<Harness {...props} />);
  return { user, view };
};

const box = () => screen.getByRole("textbox");
const value = () => (box() as HTMLInputElement).value;
const crumbs = () =>
  within(screen.getByRole("navigation", { name: "Search modes" }));
const lastOptions = (): GrepOptions =>
  grep.mock.calls[grep.mock.calls.length - 1][1] as GrepOptions;

beforeEach(() => {
  vi.clearAllMocks();
  state.data = MATCHES;
  state.isFetching = false;
  state.error = null;
});

afterEach(cleanup);

describe("SearchDialog — commands", () => {
  it("opens on the command list, not on a search", () => {
    setup();

    expect(screen.getByText("Open settings")).toBeDefined();
    expect(screen.queryByText("queries.ts")).toBeNull();
  });

  it("offers the deeper lists as commands", () => {
    setup();

    expect(screen.getByRole("button", { name: /Go to file/ })).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Search in files/ })
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /Git actions/ })).toBeDefined();
  });

  it("keeps the git actions behind their own list", () => {
    setup();

    expect(screen.queryByText("Push")).toBeNull();
  });

  it("still finds a git action typed at the root", async () => {
    const { user } = setup();

    await user.type(box(), "push");

    expect(screen.getByText("Push")).toBeDefined();
  });

  it("filters the commands as you type", async () => {
    const { user } = setup();

    await user.type(box(), "appearance");

    expect(screen.getByText("Open settings")).toBeDefined();
    expect(screen.queryByText("Push")).toBeNull();
  });

  it("runs a command and closes", async () => {
    const { user } = setup();

    await user.click(screen.getByText("Open settings"));

    expect(COMMANDS[1].run).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a single breadcrumb for the root list", () => {
    setup();

    expect(crumbs().getByText("Commands")).toBeDefined();
    expect(crumbs().queryByText("Files")).toBeNull();
  });
});

describe("SearchDialog — git", () => {
  const enterGit = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole("button", { name: /Git actions/ }));

  it("lists the git actions under a Git crumb", async () => {
    const { user } = setup();

    await enterGit(user);

    expect(crumbs().getByText("Git")).toBeDefined();
    expect(screen.getByText("Push")).toBeDefined();
    expect(screen.queryByText("Open settings")).toBeNull();
  });

  it("runs a git action and closes", async () => {
    const { user } = setup();

    await enterGit(user);
    await user.click(screen.getByText("Push"));

    expect(COMMANDS[0].run).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("leads on to the branches, keeping the whole trail", async () => {
    const { user } = setup();

    await enterGit(user);
    await user.click(screen.getByRole("button", { name: /Switch branch/ }));

    expect(crumbs().getByText("Commands")).toBeDefined();
    expect(crumbs().getByText("Git")).toBeDefined();
    expect(crumbs().getByText("Branches").getAttribute("aria-current")).toBe(
      "page"
    );
  });

  it("goes back to the git list on Backspace, not to the root", async () => {
    const { user } = setup({ initialMode: "branches" });

    await user.type(box(), "{Backspace}");

    expect(screen.getByText("Push")).toBeDefined();
    expect(crumbs().queryByText("Branches")).toBeNull();
  });
});

describe("SearchDialog — branches", () => {
  it("lists local and remote branches without waiting for a query", () => {
    setup({ initialMode: "branches" });

    expect(screen.getByText("Local")).toBeDefined();
    expect(screen.getByText("Remote")).toBeDefined();
    expect(screen.getByText("task/BMB-207")).toBeDefined();
    expect(screen.getByText("origin/release")).toBeDefined();
  });

  it("marks the branch you are on", () => {
    setup({ initialMode: "branches" });

    expect(screen.getByText("current")).toBeDefined();
  });

  it("finds a branch by a loose match on its name", async () => {
    const { user } = setup({ initialMode: "branches" });

    await user.type(box(), "207");

    expect(screen.getByText("task/BMB-207")).toBeDefined();
    expect(screen.queryByText("origin/release")).toBeNull();
  });

  it("checks out the branch it was asked for, and closes", async () => {
    const { user } = setup({ initialMode: "branches" });

    await user.type(box(), "release{Enter}");

    expect(onCheckout).toHaveBeenCalledWith("release");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says when nothing matches", async () => {
    const { user } = setup({ initialMode: "branches" });

    await user.type(box(), "zzzzz");

    expect(screen.getByText("No branches match.")).toBeDefined();
  });
});

describe("SearchDialog — moving between modes", () => {
  it("enters the file search without closing, and says so in the breadcrumb", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /Go to file/ }));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(crumbs().getByText("Files")).toBeDefined();
    expect(box().getAttribute("aria-label")).toBe("Search files by name");
  });

  it("enters the text search from its command", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: /Search in files/ }));

    expect(crumbs().getByText("Text")).toBeDefined();
    expect(box().getAttribute("aria-label")).toBe("Search file contents");
  });

  it("walks back to the commands from the breadcrumb", async () => {
    const { user } = setup({ initialMode: "files" });

    await user.click(crumbs().getByRole("button", { name: "Commands" }));

    expect(screen.getByText("Open settings")).toBeDefined();
    expect(crumbs().queryByText("Files")).toBeNull();
  });

  it("marks the mode you are in as the current crumb", () => {
    setup({ initialMode: "text" });

    expect(crumbs().getByText("Text").getAttribute("aria-current")).toBe(
      "page"
    );
  });

  it("goes back on Backspace once the query is empty", async () => {
    const { user } = setup({ initialMode: "files" });

    await user.type(box(), "queries");
    await user.type(box(), "{Backspace}");
    expect(crumbs().getByText("Files")).toBeDefined();

    await user.clear(box());
    await user.type(box(), "{Backspace}");
    expect(screen.getByText("Open settings")).toBeDefined();
  });
});

describe("SearchDialog — files", () => {
  it("waits for a query before listing anything", () => {
    setup({ initialMode: "files" });

    expect(screen.getByText(/Type to find a file/)).toBeDefined();
  });

  it("finds a file by a loose match on its path", async () => {
    const { user } = setup({ initialMode: "files" });

    await user.type(box(), "querts");

    expect(screen.getByRole("button", { name: /queries\.ts/ })).toBeDefined();
    expect(screen.queryByText(/app-shell/)).toBeNull();
  });

  it("opens the file it was asked for, and closes", async () => {
    const { user } = setup({ initialMode: "files" });

    await user.type(box(), "queries");
    await user.click(screen.getByRole("button", { name: /queries\.ts/ }));

    expect(onOpenFile).toHaveBeenCalledWith("packages/spa/src/lib/queries.ts");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says when nothing matches", async () => {
    const { user } = setup({ initialMode: "files" });

    await user.type(box(), "zzzzz");

    expect(screen.getByText("No files match.")).toBeDefined();
  });
});

describe("SearchDialog — text", () => {
  it("lists every match under the file it was found in", () => {
    setup({ initialMode: "text" });

    expect(screen.getByText("packages/spa/src/lib/queries.ts")).toBeDefined();
    expect(
      screen.getByText("packages/spa/src/components/tree.tsx")
    ).toBeDefined();
    expect(screen.getAllByRole("button", { name: /useFiles/ })).toHaveLength(3);
  });

  it("searches for what is typed", async () => {
    const { user } = setup({ initialMode: "text" });

    await user.type(box(), "useFiles");

    expect(grep.mock.calls.at(-1)?.[0]).toBe("useFiles");
  });

  it("opens the file at the matched line, and closes", async () => {
    const { user } = setup({ initialMode: "text" });

    await user.click(
      screen.getByRole("button", { name: /import \{ useFiles \}/ })
    );

    expect(onOpenLocation).toHaveBeenCalledWith(
      "packages/spa/src/components/tree.tsx",
      8
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("walks the results with the arrow keys and opens with Enter", async () => {
    const { user } = setup({ initialMode: "text" });

    await user.type(box(), "{ArrowDown}{ArrowDown}{Enter}");

    expect(onOpenLocation).toHaveBeenCalledWith(
      "packages/spa/src/components/tree.tsx",
      8
    );
  });

  it("wraps around the ends of the list", async () => {
    const { user } = setup({ initialMode: "text" });

    await user.type(box(), "{ArrowUp}{Enter}");

    expect(onOpenLocation).toHaveBeenCalledWith(
      "packages/spa/src/components/tree.tsx",
      8
    );
  });

  it("highlights the matched text inside the line", async () => {
    const { user } = setup({ initialMode: "text" });

    await user.type(box(), "usefiles");

    const marks = document.querySelectorAll("mark");
    expect(marks).toHaveLength(3);
    expect(marks[0].textContent).toBe("useFiles");
  });

  it("re-runs the search with each toggle the user turns on", async () => {
    const { user } = setup({ initialMode: "text" });

    await user.click(screen.getByRole("button", { name: "Match case" }));
    expect(lastOptions().caseSensitive).toBe(true);

    await user.click(screen.getByRole("button", { name: "Match whole word" }));
    expect(lastOptions().wholeWord).toBe(true);

    await user.click(
      screen.getByRole("button", { name: "Use regular expression" })
    );
    expect(lastOptions()).toEqual({
      caseSensitive: true,
      wholeWord: true,
      regex: true,
    });
  });

  it("counts what was found", () => {
    setup({ initialMode: "text" });

    expect(screen.getByText(/3 matches in 2 files/)).toBeDefined();
  });

  it("says so when the results were cut short", () => {
    state.data = { ...MATCHES, truncated: true };
    setup({ initialMode: "text" });

    expect(screen.getByText(/first results only/)).toBeDefined();
  });

  it("waits for something to search for", () => {
    state.data = { matches: [], truncated: false };
    setup({ initialMode: "text" });

    expect(screen.getByText("Type to search.")).toBeDefined();
  });

  it("surfaces a failed search", () => {
    state.data = undefined;
    state.error = new Error("git exploded");
    setup({ initialMode: "text" });

    expect(screen.getByText(/Could not search/)).toBeDefined();
  });

  it("only runs the search while it is the mode on screen", () => {
    setup({ initialMode: "files" });

    expect(grep.mock.calls.every(([, , enabled]) => enabled === false)).toBe(
      true
    );
  });
});

describe("SearchDialog — remembering a search", () => {
  const reopen = (view: ReturnType<typeof render>, mode: SearchMode) => {
    view.rerender(<Harness initialMode={mode} open={false} />);
    view.rerender(<Harness initialMode={mode} open />);
  };

  it("keeps the last text search when reopened", async () => {
    const { user, view } = setup({ initialMode: "text" });

    await user.type(box(), "useFiles");
    reopen(view, "text");

    expect(value()).toBe("useFiles");
  });

  it("keeps the last file search when reopened", async () => {
    const { user, view } = setup({ initialMode: "files" });

    await user.type(box(), "queries");
    reopen(view, "files");

    expect(value()).toBe("queries");
  });

  it("starts the command list fresh, since it is a menu and not a search", async () => {
    const { user, view } = setup();

    await user.type(box(), "settings");
    reopen(view, "commands");

    expect(value()).toBe("");
  });

  it("drops what was typed at the root once you walk into a menu and back", async () => {
    const { user } = setup();

    await user.type(box(), "git");
    await user.click(screen.getByRole("button", { name: /Git actions/ }));
    await user.click(crumbs().getByRole("button", { name: "Commands" }));

    expect(value()).toBe("");
  });
});
