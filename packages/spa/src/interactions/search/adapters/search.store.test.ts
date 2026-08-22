// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Command } from "../interfaces/search.interfaces";
import {
  closeSearch,
  openSearch,
  registerCommands,
  resetSearchStore,
  setSearchMode,
  setSearchOpen,
  toggleCommandSearch,
  useRegisteredCommands,
  useSearchState,
} from "./search.store";

const Icon = () => null;
const command = (id: string): Command => ({
  id,
  label: id,
  group: "Test",
  icon: Icon,
  run: () => {},
});

/** The store as a page sees it: through the hook it publishes. */
const watchState = () => renderHook(() => useSearchState());
const watchCommands = () =>
  renderHook(() => useRegisteredCommands().map((c) => c.id));

afterEach(() => {
  cleanup();
  resetSearchStore();
});

describe("search state", () => {
  it("starts closed on the command list", () => {
    const { result } = watchState();

    expect(result.current).toEqual({
      open: false,
      mode: "commands",
      seed: null,
    });
  });

  it("opens on the mode it was asked for", () => {
    const { result } = watchState();

    act(() => openSearch("text"));

    expect(result.current).toEqual({ open: true, mode: "text", seed: null });
  });

  it("carries a phrase in, once per press", () => {
    const { result } = watchState();

    act(() => openSearch("text", "useFiles"));
    const first = result.current.seed;
    expect(first).toMatchObject({ text: "useFiles" });

    act(() => closeSearch());
    act(() => openSearch("text", "useFiles"));

    // Same phrase, different press: the dialog has to be able to tell them
    // apart, or the second ⌘⇧F would leave the box as the user last left it.
    expect(result.current.seed).toMatchObject({ text: "useFiles" });
    expect(result.current.seed?.nonce).not.toBe(first?.nonce);
  });

  it("carries nothing in when nothing was highlighted", () => {
    const { result } = watchState();

    act(() => openSearch("text", "useFiles"));
    act(() => closeSearch());
    act(() => openSearch("text"));

    expect(result.current.seed).toBeNull();
  });

  it("switches mode while staying open", () => {
    const { result } = watchState();

    act(() => openSearch("files"));
    act(() => setSearchMode("text"));

    expect(result.current).toEqual({ open: true, mode: "text", seed: null });
  });

  it("keeps the mode on close, so the list does not change as it animates out", () => {
    const { result } = watchState();

    act(() => openSearch("text"));
    act(() => setSearchOpen(false));

    expect(result.current).toEqual({ open: false, mode: "text", seed: null });
  });

  it("opens on the mode it was asked for, whatever it closed on", () => {
    const { result } = watchState();

    act(() => openSearch("text"));
    act(closeSearch);
    act(toggleCommandSearch);

    expect(result.current).toEqual({
      open: true,
      mode: "commands",
      seed: null,
    });
  });

  it("toggles the command list shut, and back open", () => {
    const { result } = watchState();

    act(toggleCommandSearch);
    expect(result.current).toEqual({
      open: true,
      mode: "commands",
      seed: null,
    });

    act(toggleCommandSearch);
    expect(result.current.open).toBe(false);

    act(toggleCommandSearch);
    expect(result.current).toEqual({
      open: true,
      mode: "commands",
      seed: null,
    });
  });

  it("goes straight from the text search to closed, never via the commands", () => {
    const seen: Array<string> = [];
    renderHook(() => {
      const state = useSearchState();
      seen.push(`${state.open}:${state.mode}`);
      return state;
    });

    act(() => openSearch("text"));
    act(closeSearch);

    expect(seen).toEqual(["false:commands", "true:text", "false:text"]);
  });

  it("brings the commands back rather than closing another mode", () => {
    const { result } = watchState();

    act(() => openSearch("text"));
    act(toggleCommandSearch);

    expect(result.current).toEqual({
      open: true,
      mode: "commands",
      seed: null,
    });
  });

  it("does not re-render subscribers when nothing changed", () => {
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useSearchState();
    });
    const before = renders;

    act(() => openSearch("files"));
    act(() => openSearch("files"));

    expect(renders).toBe(before + 1);
  });

  it("closing an already-closed dialog is a no-op", () => {
    const { result } = watchState();

    act(closeSearch);

    expect(result.current).toEqual({
      open: false,
      mode: "commands",
      seed: null,
    });
  });
});

describe("registered commands", () => {
  it("collects what every mounted scope offers", () => {
    const { result } = watchCommands();

    act(() => void registerCommands("shell", [command("a")]));
    act(() => void registerCommands("page", [command("b")]));

    expect(result.current).toEqual(["a", "b"]);
  });

  it("replaces a scope's commands when it registers again", () => {
    const { result } = watchCommands();

    act(() => void registerCommands("shell", [command("a")]));
    act(() => void registerCommands("shell", [command("a2")]));

    expect(result.current).toEqual(["a2"]);
  });

  it("forgets a scope once it unmounts, keeping the others", () => {
    const { result } = watchCommands();
    let unregister = () => {};

    act(() => {
      unregister = registerCommands("shell", [command("a")]);
    });
    act(() => void registerCommands("page", [command("b")]));
    act(() => unregister());

    expect(result.current).toEqual(["b"]);
  });
});
