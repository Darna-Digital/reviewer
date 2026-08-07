/**
 * Live state for the browser pane, in the same shape as the window-tab store.
 *
 * Nothing here is persisted: which page the pane last showed is a UI preference
 * (`browserPaneUrls`), while the title, spinner and history flags are only true
 * of the webview that is mounted right now.
 *
 * The mounted `<webview>` is registered here too. The agent bridge has to reach
 * it from a socket callback rather than from a React tree, and a module-scoped
 * handle is the honest way to say that there is exactly one pane per window.
 */
import { useSyncExternalStore } from "react";
import type { ConsoleMessage } from "@byconvo/core/browser";
import type {
  BrowserPaneState,
  WebviewElement,
} from "../interfaces/browser-pane.interfaces";

const initial: BrowserPaneState = {
  url: "",
  title: "",
  loading: false,
  canGoBack: false,
  canGoForward: false,
  mode: "browse",
  draft: null,
};

let state: BrowserPaneState = initial;
let webview: WebviewElement | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function updateBrowserPane(patch: Partial<BrowserPaneState>): void {
  const next = { ...state, ...patch };
  if (
    (Object.keys(patch) as Array<keyof BrowserPaneState>).every(
      (key) => state[key] === next[key]
    )
  ) {
    return;
  }
  state = next;
  emit();
}

export const browserPaneSnapshot = (): BrowserPaneState => state;

export function registerPaneWebview(element: WebviewElement | null): void {
  webview = element;
  emit();
}

/** The mounted webview, or null when the pane is closed. */
export const paneWebview = (): WebviewElement | null => webview;

/**
 * The guest's console, kept as a ring so a chatty page can't grow without
 * bound. An agent asks for this after a change to see what the page complained
 * about, which is only ever the recent tail.
 */
const CONSOLE_LIMIT = 200;
let consoleLog: ReadonlyArray<ConsoleMessage> = [];

export function recordConsoleMessage(message: ConsoleMessage): void {
  consoleLog = [...consoleLog, message].slice(-CONSOLE_LIMIT);
}

export const consoleMessages = (): ReadonlyArray<ConsoleMessage> => consoleLog;

/** Dropped on navigation: the previous page's complaints are not this one's. */
export const clearConsoleMessages = (): void => {
  consoleLog = [];
};

export const useBrowserPane = (): BrowserPaneState =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state
  );
