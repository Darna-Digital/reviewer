// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOUBLE_TAP_WINDOW_MS } from "../functions/shortcuts.functions";
import { SearchShortcuts } from "./search-shortcuts";

const onOpenCommands = vi.fn();
const onOpenFiles = vi.fn();
const onOpenText = vi.fn();

/** Drives `Date.now`, so a tap can be placed anywhere in (or past) the window. */
let clock = 10_000;
const passTime = (ms: number) => {
  clock += ms;
};

const setup = () => {
  const user = userEvent.setup();
  render(
    <>
      <SearchShortcuts
        onOpenCommands={onOpenCommands}
        onOpenFiles={onOpenFiles}
        onOpenText={onOpenText}
      />
      <input aria-label="Filter" />
      <button type="button">Somewhere else</button>
    </>
  );
  return user;
};

const tapShift = (user: ReturnType<typeof userEvent.setup>) =>
  user.keyboard("{Shift>}{/Shift}");

beforeEach(() => {
  vi.clearAllMocks();
  clock = 10_000;
  vi.spyOn(Date, "now").mockImplementation(() => clock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SearchShortcuts", () => {
  it("opens the file search when Shift is tapped twice", async () => {
    const user = setup();

    await tapShift(user);
    passTime(120);
    await tapShift(user);

    expect(onOpenFiles).toHaveBeenCalledOnce();
    expect(onOpenCommands).not.toHaveBeenCalled();
  });

  it("opens the command list on Cmd+K", async () => {
    const user = setup();

    await user.keyboard("{Meta>}k{/Meta}");

    expect(onOpenCommands).toHaveBeenCalledOnce();
    expect(onOpenFiles).not.toHaveBeenCalled();
    expect(onOpenText).not.toHaveBeenCalled();
  });

  it("opens the command list on Ctrl+K, and from inside a field", async () => {
    const user = setup();

    await user.click(screen.getByLabelText("Filter"));
    await user.keyboard("{Control>}k{/Control}");

    expect(onOpenCommands).toHaveBeenCalledOnce();
  });

  it("leaves a single tap alone", async () => {
    const user = setup();

    await tapShift(user);

    expect(onOpenFiles).not.toHaveBeenCalled();
  });

  it("leaves two slow taps alone", async () => {
    const user = setup();

    await tapShift(user);
    passTime(DOUBLE_TAP_WINDOW_MS + 50);
    await tapShift(user);

    expect(onOpenFiles).not.toHaveBeenCalled();
  });

  it("does not fire when a key is typed between the taps", async () => {
    const user = setup();

    await tapShift(user);
    await user.keyboard("a");
    await tapShift(user);

    expect(onOpenFiles).not.toHaveBeenCalled();
  });

  it("stays out of the way while typing capitals in a field", async () => {
    const user = setup();

    await user.click(screen.getByLabelText("Filter"));
    await user.keyboard("{Shift>}A{/Shift}");
    await tapShift(user);
    await tapShift(user);

    expect(onOpenFiles).not.toHaveBeenCalled();
  });

  it("opens the text search on Cmd+Shift+F", async () => {
    const user = setup();

    await user.keyboard("{Meta>}{Shift>}f{/Shift}{/Meta}");

    expect(onOpenText).toHaveBeenCalledOnce();
    expect(onOpenFiles).not.toHaveBeenCalled();
  });

  it("opens the text search on Ctrl+Shift+F, and from inside a field", async () => {
    const user = setup();

    await user.click(screen.getByLabelText("Filter"));
    await user.keyboard("{Control>}{Shift>}f{/Shift}{/Control}");

    expect(onOpenText).toHaveBeenCalledOnce();
  });

  it("does not let the Shift of a chord count towards a double tap", async () => {
    const user = setup();

    await user.keyboard("{Meta>}{Shift>}f{/Shift}{/Meta}");
    passTime(50);
    await tapShift(user);

    expect(onOpenFiles).not.toHaveBeenCalled();
  });

  it("stops listening once unmounted", async () => {
    const user = setup();
    cleanup();

    await tapShift(user);
    passTime(80);
    await tapShift(user);

    expect(onOpenFiles).not.toHaveBeenCalled();
  });
});
