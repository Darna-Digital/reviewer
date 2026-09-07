/**
 * `workspace` feature — opening a project and moving between the git roots it
 * holds. A project is a folder: either a repository itself or a parent holding
 * `backend`, `frontend` and friends side by side.
 *
 * The two flows differ in what they invalidate. Opening a project changes
 * everything the app shows, so every cache goes. Selecting another root inside
 * the open project changes everything repo-scoped but leaves the project put —
 * so the caller stays where it is instead of being thrown back to the commit
 * view. The API calls, cache and toasts are injected; the sequencing is the
 * real logic and is what the tests pin down.
 */
import type { WorkspaceInfo } from "@reviewer/core/workspace";

export interface WorkspaceDependencies {
  data: Record<string, never>;
  sideEffects: {
    /** Open a folder as the project; resolves to the workspace it produced. */
    readonly setProject: (path: string) => Promise<WorkspaceInfo>;
    /** Point the git views at one of the open project's roots. */
    readonly setRepo: (path: string) => Promise<WorkspaceInfo>;
    /** Seed the workspace cache with the answer the server just gave. */
    readonly cacheWorkspace: (info: WorkspaceInfo) => void;
    /** Reload just the repository identity, and wait for it. */
    readonly refreshRepo: () => Promise<void>;
    /** Wait for the views to re-render against what the cache now holds. */
    readonly settle: () => Promise<void>;
    /** Drop every cached query — the new selection invalidates all of them. */
    readonly invalidateAll: () => Promise<void>;
    readonly notifyError: (text: string) => void;
  };
}

/** One command-palette entry for following a root of the open project. */
export interface RepoCommand {
  readonly id: string;
  readonly label: string;
  readonly keywords: string;
  readonly path: string;
}

export interface WorkspaceFunctions {
  /**
   * Open `path` as the project. Returns the workspace it opened on, or null
   * when the server refused it (already reported to the user).
   */
  readonly openProject: (path: string) => Promise<WorkspaceInfo | null>;
  /**
   * Follow one of the open project's roots. Returns the workspace it moved to,
   * or null when the server refused it (already reported to the user).
   */
  readonly openRepo: (path: string) => Promise<WorkspaceInfo | null>;
  /**
   * Make `path` the current root before acting on something that belongs to
   * it — a change or a commit in a project-wide list. Already being there is
   * success and costs nothing. Returns whether the root can now be acted on.
   */
  readonly followRepo: (
    path: string,
    current: string | null
  ) => Promise<boolean>;
}
