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
import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  themeNameOrDefault,
} from "@reviewer/core/themes";

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";
/**
 * The theme a code surface is drawn with in each scheme, in the shape
 * `@pierre/diffs` takes it: the pair, with `themeType` picking the side.
 */
export type CodeThemes = { readonly light: string; readonly dark: string };
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
  /**
   * Which theme paints the light scheme and which the dark — names from the
   * catalog in `@reviewer/core/themes`. One choice per scheme rather than one
   * for both: a theme is written for one scheme, and following the system
   * from day to night means switching between two of them.
   */
  lightTheme: string;
  darkTheme: string;
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
  /** The agent and model the last session was composed with. */
  lastSession: LastSession;
}

const STORE_KEY = "reviewer-ui";
const THEME_KEY = "reviewer-theme";
/**
 * The theme names, kept beside the mode under keys of their own rather than
 * inside the store: the macOS shell, which owns the choice there, writes them
 * before the page's first script (see `NativePalette`), and the pre-paint
 * script in `__root` reads them back the same way.
 */
const LIGHT_THEME_KEY = "reviewer-theme-light";
const DARK_THEME_KEY = "reviewer-theme-dark";
/** What the shell dispatches once it has rewritten the keys above. */
export const THEMES_CHANGED_EVENT = "reviewer:themes";

/**
 * The OS's scheme, where there is an OS to ask: a test's DOM has no
 * `matchMedia`, and a module that loads there — every code surface imports
 * this store for its theme pair — must not fall over asking.
 */
const osScheme = (): MediaQueryList | undefined =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : undefined;

const systemTheme = (): Theme => (osScheme()?.matches ? "dark" : "light");

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
  lightTheme: DEFAULT_LIGHT_THEME,
  darkTheme: DEFAULT_DARK_THEME,
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
    Object.assign(prefs, readThemeNames());
  }
  return { ...prefs, resolvedTheme: resolve(prefs.theme) };
}

/**
 * The stored names, each checked against the catalog and against its scheme
 * — a name this build no longer ships, or a dark theme filed under light,
 * falls back to the scheme's default rather than leaving code unhighlighted.
 */
function readThemeNames(): Pick<UiPrefs, "lightTheme" | "darkTheme"> {
  const read = (key: string) => window.localStorage.getItem(key) ?? undefined;
  return {
    lightTheme: themeNameOrDefault(read(LIGHT_THEME_KEY), "light"),
    darkTheme: themeNameOrDefault(read(DARK_THEME_KEY), "dark"),
  };
}

let state: UiPrefs = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    const {
      theme,
      lightTheme,
      darkTheme,
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
      lastSession,
    } = state;
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        theme,
        lightTheme,
        darkTheme,
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
        lastSession,
      })
    );
    window.localStorage.setItem(THEME_KEY, state.theme);
    window.localStorage.setItem(LIGHT_THEME_KEY, state.lightTheme);
    window.localStorage.setItem(DARK_THEME_KEY, state.darkTheme);
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
  if (patch.lightTheme !== undefined)
    state.lightTheme = themeNameOrDefault(patch.lightTheme, "light");
  if (patch.darkTheme !== undefined)
    state.darkTheme = themeNameOrDefault(patch.darkTheme, "dark");
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

/**
 * The pair a code surface is drawn with. One object per pair of names, so a
 * view handed it as an option sees the same value until a name changes —
 * `@pierre/diffs` re-highlights on new options, and would on every render.
 */
let codeThemesCache: CodeThemes = {
  light: defaults.lightTheme,
  dark: defaults.darkTheme,
};
export const codeThemesOf = (prefs: UiPrefs): CodeThemes => {
  if (
    codeThemesCache.light !== prefs.lightTheme ||
    codeThemesCache.dark !== prefs.darkTheme
  )
    codeThemesCache = { light: prefs.lightTheme, dark: prefs.darkTheme };
  return codeThemesCache;
};

/**
 * The one of the pair that is actually on screen — the theme everything
 * derived from a theme is derived from: the window's palette (see
 * `lib/chrome-theme`) and the colours code is set in (see `lib/syntax-theme`).
 */
export const themeNameOf = (prefs: UiPrefs): string =>
  prefs.resolvedTheme === "dark" ? prefs.darkTheme : prefs.lightTheme;

/** Show the bottom dock and select a tab (History / Find / Services / …). */
export function openBottomTab(tab: BottomTab) {
  setUiPrefs({ bottomVisible: true, bottomTab: tab });
}

const THEME_ORDER: ThemePref[] = ["light", "dark", "system"];
export function cycleTheme() {
  const next =
    THEME_ORDER[(THEME_ORDER.indexOf(state.theme) + 1) % THEME_ORDER.length];
  setUiPrefs({ theme: next });
}

// Track the OS theme so "system" updates live.
osScheme()?.addEventListener("change", () => {
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

// The macOS shell owns the theme names there, and says so by rewriting the
// keys and dispatching the event: the store takes them up as a choice made on
// its own settings page would have been (see `NativePalette.applyScript`).
if (typeof window !== "undefined") {
  window.addEventListener(THEMES_CHANGED_EVENT, () => {
    setUiPrefs(readThemeNames());
  });
}

/** Called on every change; for what keeps in step with the prefs outside React. */
export function subscribeUiPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUiPrefs(): UiPrefs {
  return useSyncExternalStore(
    subscribeUiPrefs,
    () => state,
    () => state
  );
}
