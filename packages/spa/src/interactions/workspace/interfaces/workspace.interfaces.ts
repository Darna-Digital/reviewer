/**
 * `workspace` feature — opening a git repository as the project.
 *
 * Opening changes everything the app shows, so every cache goes. The API
 * call, cache and toasts are injected; the sequencing is the real logic and is
 * what the tests pin down.
 */
import type { WorkspaceInfo } from "@reviewer/core/workspace";

export interface WorkspaceDependencies {
  data: Record<string, never>;
  sideEffects: {
    /** Open a repository as the project; resolves to the workspace it produced. */
    readonly setProject: (path: string) => Promise<WorkspaceInfo>;
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

export interface WorkspaceFunctions {
  /**
   * Open `path` as the project. Returns the workspace it opened on, or null
   * when the server refused it (already reported to the user).
   */
  readonly openProject: (path: string) => Promise<WorkspaceInfo | null>;
}
