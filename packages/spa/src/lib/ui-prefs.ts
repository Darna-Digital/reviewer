/**
 * Ephemeral UI preferences — theme, diff rendering style, panel sizes. These
 * are genuinely-local view state (not navigation), so they live in a tiny
 * localStorage-backed store instead of the URL.
 */
import { useSyncExternalStore } from "react";
import type {
  ChatAccess,
  ChatEffort,
  ChatProviderKind,
} from "@reviewer/core/chats";
import { isChatProviderKind } from "@/interactions/chats/functions/chat-assignment.functions";
import { isPreviewWindow } from "@/lib/preview-window";

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";
export type DiffStyle = "split" | "unified";
/** Agent CLIs that can draft a commit message (threads kinds minus terminal). */
export type CommitAgent = "claude" | "opencode" | "codex" | "cursor";
/** Active tab in the shared bottom dock (git + find + services + threads). */
export type BottomTab =
  "branches" | "history" | "find" | "services" | "threads";

/**
 * What the last session was composed with.
 *
 * A composer that opened on the catalog's first answer every time made the
 * choice again on every session — and a review handed to a new chat always went
 * to Claude, whoever you had actually been working with. So the choices are
 * kept: the next session, started from the composer or handed a review, opens
 * on the agent and model the last one used.
 */
export interface LastSession {
  /**
   * Undefined until the choice has actually been made, which is not the same as
   * a default: a composer that has never been touched wants whatever the
   * catalog's own answer is that day, not last release's copy of it.
   */
  provider?: ChatProviderKind;
  model?: string;
  effort?: ChatEffort;
  access?: ChatAccess;
}

export interface UiPrefs {
  /** The user's choice; "system" follows the OS. */
  theme: ThemePref;
  /** The concrete theme to render (system resolved against the OS). */
  resolvedTheme: Theme;
  diffStyle: DiffStyle;
  connectors: boolean;
  /**
   * Whether the window frame lets the desktop through. Native shell only — a
   * browser tab has nothing behind it to show.
   */
  translucency: boolean;
  /** Whether the shell's left sidebar (the file tree) shows. */
  sidebarVisible: boolean;
  bottomVisible: boolean;
  /** Which bottom-dock tab is selected. */
  bottomTab: BottomTab;
  /** Drag-resizable left sidebar width, in px. */
  sidebarWidth: number;
  /** Drag-resizable left sidebar width for the workspace pages (threads/docs). */
  workspaceSidebarWidth: number;
  /** Drag-resizable width of the sessions page's list, in px. */
  inboxListWidth: number;
  /** Drag-resizable source pane width in the SVG split view, in px. */
  svgSourceWidth: number;
  /** Drag-resizable bottom panel height, in px. */
  bottomHeight: number;
  /** Drag-resizable width of the Find window's results list, in px. */
  findResultsWidth: number;
  /** Drag-resizable changed-files list height in the commit panel, in px. */
  commitFilesHeight: number;
  /** Drag-resizable commit-message textarea height, in px. */
  commitMessageHeight: number;
  /**
   * Drag-resizable width of review mode's pull request column, in px.
   *
   * Its own, not the shell's `sidebarWidth`: the two columns hold different
   * things and want different room — a file tree is as wide as its deepest
   * path, a pull request as wide as its description reads well. Sharing one
   * number meant sizing a review resized the browser's tree behind your back.
   */
  reviewInfoWidth: number;
  /** Drag-resizable width of review mode's file tree column, in px. */
  reviewTreeWidth: number;
  /**
   * Whether review mode shows the file tree column. Its own switch rather than
   * the shell's `sidebarVisible`, which puts the pull request away with it: a
   * reviewer reading one long file wants the tree gone and the pull request
   * still there.
   */
  reviewTreeVisible: boolean;
  /** Drag-resizable commit-details pane width in the history panel, in px. */
  commitDetailsWidth: number;
  /** Which agent CLI drafts commit messages via the "Generate" button. */
  commitAgent: CommitAgent;
  /** Model ids starred in the chat composer's model picker. */
  chatModelFavorites: string[];
  /** Drag-resizable height of the chat composer's prompt box, in px. */
  composerHeight: number;
  /** Drag-resizable height of the launchpad panel, in px. */
  launchpadHeight: number;
  /** The agent and model the last session was composed with. */
  lastSession: LastSession;
}

const STORE_KEY = "reviewer-ui";
const THEME_KEY = "reviewer-theme";

const systemTheme = (): Theme =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const resolve = (pref: ThemePref): Theme =>
  pref === "system" ? systemTheme() : pref;

const BOTTOM_TABS: ReadonlyArray<BottomTab> = [
  "branches",
  "history",
  "find",
  "services",
  "threads",
];

const defaults: Omit<UiPrefs, "resolvedTheme"> = {
  theme: "system",
  diffStyle: "split",
  connectors: true,
  translucency: true,
  sidebarVisible: true,
  bottomVisible: true,
  bottomTab: "history",
  sidebarWidth: 288,
  workspaceSidebarWidth: 256,
  inboxListWidth: 320,
  svgSourceWidth: 420,
  bottomHeight: 256,
  findResultsWidth: 380,
  commitFilesHeight: 180,
  commitMessageHeight: 80,
  reviewInfoWidth: 320,
  reviewTreeWidth: 300,
  reviewTreeVisible: true,
  commitDetailsWidth: 520,
  commitAgent: "claude",
  chatModelFavorites: [],
  composerHeight: 92,
  launchpadHeight: 380,
  lastSession: {},
};

/**
 * Storage holds whatever the last version of the app wrote, so a session read
 * back out of it is checked: an agent that is no longer assignable is not one
 * the composer could open on.
 */
const readLastSession = (stored: LastSession | undefined): LastSession => {
  const merged = { ...defaults.lastSession, ...stored };
  return {
    ...merged,
    provider:
      merged.provider !== undefined && isChatProviderKind(merged.provider)
        ? merged.provider
        : undefined,
  };
};

/**
 * The commit details panel used to open at 320px — too narrow to read a diff
 * in. A stored width still sitting at that old default was never dragged
 * there, so it follows the new default rather than being kept.
 */
const LEGACY_COMMIT_DETAILS_WIDTH = 320;

/** Storage holds whatever the last version of the app wrote, whatever that was. */
type StoredPrefs = Partial<typeof defaults>;

function load(): UiPrefs {
  let prefs = { ...defaults };
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw !== null) {
        prefs = { ...prefs, ...(JSON.parse(raw) as StoredPrefs) };
      }
    } catch {
      // ignore malformed storage
    }
    if (prefs.commitDetailsWidth === LEGACY_COMMIT_DETAILS_WIDTH)
      prefs.commitDetailsWidth = defaults.commitDetailsWidth;
    if (!BOTTOM_TABS.includes(prefs.bottomTab)) prefs.bottomTab = "history";
    prefs.lastSession = readLastSession(prefs.lastSession);
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system")
      prefs.theme = stored;
  }
  return { ...prefs, resolvedTheme: resolve(prefs.theme) };
}

let state: UiPrefs = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  // A preview shares the window's storage: what a page does while being looked
  // at — sizing a pane — is not the window's doing.
  if (typeof window === "undefined" || isPreviewWindow) return;
  try {
    const {
      theme,
      diffStyle,
      connectors,
      translucency,
      sidebarVisible,
      bottomVisible,
      bottomTab,
      sidebarWidth,
      workspaceSidebarWidth,
      inboxListWidth,
      svgSourceWidth,
      bottomHeight,
      findResultsWidth,
      commitFilesHeight,
      commitMessageHeight,
      reviewInfoWidth,
      reviewTreeWidth,
      reviewTreeVisible,
      commitDetailsWidth,
      commitAgent,
      chatModelFavorites,
      composerHeight,
      launchpadHeight,
      lastSession,
    } = state;
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        theme,
        diffStyle,
        connectors,
        translucency,
        sidebarVisible,
        bottomVisible,
        bottomTab,
        sidebarWidth,
        workspaceSidebarWidth,
        inboxListWidth,
        svgSourceWidth,
        bottomHeight,
        findResultsWidth,
        commitFilesHeight,
        commitMessageHeight,
        reviewInfoWidth,
        reviewTreeWidth,
        reviewTreeVisible,
        commitDetailsWidth,
        commitAgent,
        chatModelFavorites,
        composerHeight,
        launchpadHeight,
        lastSession,
      })
    );
    window.localStorage.setItem(THEME_KEY, state.theme);
  } catch {
    // ignore quota errors
  }
}

function applyTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(
    "dark",
    state.resolvedTheme === "dark"
  );
  document.documentElement.dataset["theme"] = state.resolvedTheme;
}

/**
 * The frame reads its translucency off a class rather than a React prop: the
 * window is painted before the app mounts, and a flash of the wrong chrome is
 * exactly what the pre-paint script in __root exists to avoid.
 */
function applyTranslucency() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("translucent", state.translucency);
}

type UiPrefsPatch = Partial<Omit<UiPrefs, "resolvedTheme">>;

export function setUiPrefs(patch: UiPrefsPatch) {
  const changed = (Object.keys(patch) as Array<keyof UiPrefsPatch>).some(
    (key) => !Object.is(state[key], patch[key])
  );
  if (!changed) return;

  state = { ...state, ...patch };
  if (patch.theme !== undefined) {
    state.resolvedTheme = resolve(patch.theme);
    applyTheme();
  }
  if (patch.translucency !== undefined) applyTranslucency();
  persist();
  emit();
}

/**
 * Keep what a session was composed with, so the next one opens on it. Patched
 * rather than set whole: the agent is picked in one place and the mode in
 * another, and neither knows what the other last chose.
 */
export function rememberSession(patch: Partial<LastSession>) {
  const next = { ...state.lastSession, ...patch };
  const changed = (Object.keys(next) as Array<keyof LastSession>).some(
    (key) => next[key] !== state.lastSession[key]
  );
  if (changed) setUiPrefs({ lastSession: next });
}

/** The preferences as they stand, for stores that read them outside React. */
export const readUiPrefs = (): UiPrefs => state;

/** Show the bottom dock and select a tab (History / Find / Services / …). */
export function openBottomTab(tab: BottomTab) {
  setUiPrefs({ bottomVisible: true, bottomTab: tab });
}

/** Expand or collapse the bottom dock; its tab strip stays put either way. */
export function toggleBottomVisible() {
  setUiPrefs({ bottomVisible: !state.bottomVisible });
}

const THEME_ORDER: ThemePref[] = ["light", "dark", "system"];
export function cycleTheme() {
  const next =
    THEME_ORDER[(THEME_ORDER.indexOf(state.theme) + 1) % THEME_ORDER.length];
  setUiPrefs({ theme: next });
}

// Track the OS theme so "system" updates live.
if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (state.theme === "system") {
        // New object reference so useSyncExternalStore's Object.is check sees a
        // change and re-renders. Components reading resolvedTheme through a React
        // prop (e.g. pierre's FileDiff themeType) won't update otherwise — the
        // <html> class flips via applyTheme() but the prop value would be stale.
        state = { ...state, resolvedTheme: systemTheme() };
        applyTheme();
        emit();
      }
    });
}

export function useUiPrefs(): UiPrefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state
  );
}
