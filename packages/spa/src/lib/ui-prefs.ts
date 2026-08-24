/**
 * Ephemeral UI preferences — theme, diff rendering style, panel sizes. These
 * are genuinely-local view state (not navigation), so they live in a tiny
 * localStorage-backed store instead of the URL.
 */
import { useSyncExternalStore } from "react";
import { isPreviewWindow } from "@/lib/preview-window";

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";
export type DiffStyle = "split" | "unified";
/** Agent CLIs that can draft a commit message (threads kinds minus terminal). */
export type CommitAgent = "claude" | "opencode" | "codex" | "cursor";
/** Active tab in the shared bottom dock (history + services + threads). */
export type BottomTab = "history" | "services" | "threads";
/** Which way of working the app is framed around (UI only for now). */
export type WorkMode = "code" | "collaboration";

export interface UiPrefs {
  /** The user's choice; "system" follows the OS. */
  theme: ThemePref;
  /** The concrete theme to render (system resolved against the OS). */
  resolvedTheme: Theme;
  diffStyle: DiffStyle;
  /** The selected mode in the top bar's mode selector. */
  workMode: WorkMode;
  connectors: boolean;
  /**
   * Whether the window frame lets the desktop through. Native shell only — a
   * browser tab has nothing behind it to show.
   */
  translucency: boolean;
  /** Whether the shell's left sidebar (file tree / collaboration nav) shows. */
  sidebarVisible: boolean;
  /**
   * Modal editing in the code view: Vim motions and operators, a block caret,
   * and line numbers counted from the caret rather than from the top.
   */
  vimMode: boolean;
  /**
   * Whether saving a file runs the project's own formatter over it first. Inert
   * in a project that configures none.
   */
  formatOnSave: boolean;
  bottomVisible: boolean;
  /** Which bottom-dock tab is selected. */
  bottomTab: BottomTab;
  /** Drag-resizable left sidebar width, in px. */
  sidebarWidth: number;
  /** Drag-resizable left sidebar width for the workspace pages (threads/docs). */
  workspaceSidebarWidth: number;
  /** Drag-resizable width of the inbox's message list, in px. */
  inboxListWidth: number;
  /** Drag-resizable source pane width in the SVG split view, in px. */
  svgSourceWidth: number;
  /** Drag-resizable bottom panel height, in px. */
  bottomHeight: number;
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
  /** Whether the browser pane splits the canvas. Native shell only. */
  browserPaneOpen: boolean;
  /** Drag-resizable browser pane width, in px. */
  browserPaneWidth: number;
  /**
   * The page the browser pane last showed, per repository path. Keyed rather
   * than single so switching repos doesn't carry the last app's URL over.
   */
  browserPaneUrls: Record<string, string>;
  /** Whether the analysis pane splits the canvas. Native shell only. */
  plansPaneOpen: boolean;
  /** Drag-resizable analysis pane width, in px. */
  plansPaneWidth: number;
  /** Drag-resizable height of the notes list under the analysis graph, in px. */
  plansNotesHeight: number;
  /** Drag-resizable height of the launchpad panel, in px. */
  launchpadHeight: number;
}

const STORE_KEY = "byconvo-ui";
const THEME_KEY = "byconvo-theme";

const systemTheme = (): Theme =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const resolve = (pref: ThemePref): Theme =>
  pref === "system" ? systemTheme() : pref;

const BOTTOM_TABS: ReadonlyArray<BottomTab> = [
  "history",
  "services",
  "threads",
];

const defaults: Omit<UiPrefs, "resolvedTheme"> = {
  theme: "system",
  diffStyle: "split",
  workMode: "code",
  connectors: true,
  translucency: true,
  sidebarVisible: true,
  vimMode: false,
  formatOnSave: true,
  bottomVisible: true,
  bottomTab: "history",
  sidebarWidth: 288,
  workspaceSidebarWidth: 256,
  inboxListWidth: 320,
  svgSourceWidth: 420,
  bottomHeight: 256,
  commitFilesHeight: 180,
  commitMessageHeight: 80,
  reviewInfoWidth: 320,
  reviewTreeWidth: 300,
  reviewTreeVisible: true,
  commitDetailsWidth: 320,
  commitAgent: "claude",
  chatModelFavorites: [],
  composerHeight: 92,
  browserPaneOpen: false,
  browserPaneWidth: 480,
  browserPaneUrls: {},
  plansPaneOpen: false,
  plansPaneWidth: 560,
  plansNotesHeight: 220,
  launchpadHeight: 380,
};

function load(): UiPrefs {
  let prefs = { ...defaults };
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw !== null)
        prefs = { ...prefs, ...(JSON.parse(raw) as Partial<typeof defaults>) };
    } catch {
      // ignore malformed storage
    }
    if (!BOTTOM_TABS.includes(prefs.bottomTab)) prefs.bottomTab = "history";
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
  // at — marking the inbox read, sizing a pane — is not the window's doing.
  if (typeof window === "undefined" || isPreviewWindow) return;
  try {
    const {
      theme,
      diffStyle,
      workMode,
      connectors,
      translucency,
      sidebarVisible,
      vimMode,
      formatOnSave,
      bottomVisible,
      bottomTab,
      sidebarWidth,
      workspaceSidebarWidth,
      inboxListWidth,
      svgSourceWidth,
      bottomHeight,
      commitFilesHeight,
      commitMessageHeight,
      reviewInfoWidth,
      reviewTreeWidth,
      reviewTreeVisible,
      commitDetailsWidth,
      commitAgent,
      chatModelFavorites,
      composerHeight,
      browserPaneOpen,
      browserPaneWidth,
      browserPaneUrls,
      plansPaneOpen,
      plansPaneWidth,
      plansNotesHeight,
      launchpadHeight,
    } = state;
    window.localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        theme,
        diffStyle,
        workMode,
        connectors,
        translucency,
        sidebarVisible,
        vimMode,
        formatOnSave,
        bottomVisible,
        bottomTab,
        sidebarWidth,
        workspaceSidebarWidth,
        inboxListWidth,
        svgSourceWidth,
        bottomHeight,
        commitFilesHeight,
        commitMessageHeight,
        reviewInfoWidth,
        reviewTreeWidth,
        reviewTreeVisible,
        commitDetailsWidth,
        commitAgent,
        chatModelFavorites,
        composerHeight,
        browserPaneOpen,
        browserPaneWidth,
        browserPaneUrls,
        plansPaneOpen,
        plansPaneWidth,
        plansNotesHeight,
        launchpadHeight,
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

export function setUiPrefs(patch: Partial<Omit<UiPrefs, "resolvedTheme">>) {
  state = { ...state, ...patch };
  if (patch.theme !== undefined) {
    state.resolvedTheme = resolve(patch.theme);
    applyTheme();
  }
  if (patch.translucency !== undefined) applyTranslucency();
  persist();
  emit();
}

/** Show the bottom dock and select a tab (History / Services / Threads). */
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
