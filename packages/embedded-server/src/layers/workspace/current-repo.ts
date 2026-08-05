/**
 * The single store for the currently selected repository root, held at module
 * level so it can be read both inside and outside the Effect runtime.
 *
 * The live PTY WebSocket handler and chat runtime run outside Effect (wired
 * straight onto the Node HTTP server's `upgrade` event / spawned processes), so
 * an Effect Ref wouldn't be reachable from them. WorkspaceContext therefore owns
 * no separate copy: it reads and writes the selection through here (on boot and
 * on every `select`), and everything else reads it here too.
 */
let currentRepo: string | null = null;

/** Notified when the selection actually changes, with (next, previous) roots. */
type RepoChangeListener = (next: string | null, prev: string | null) => void;
const listeners = new Set<RepoChangeListener>();

/**
 * Subscribe to repository-selection changes. Used by long-lived, non-Effect
 * state outside the request cycle — e.g. the Local Dev process manager stops a
 * repo's running processes when the user switches away from it. Returns an
 * unsubscribe function.
 */
export const onCurrentRepoChange = (
  listener: RepoChangeListener
): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setCurrentRepo = (path: string | null): void => {
  if (path === currentRepo) return;
  const prev = currentRepo;
  currentRepo = path;
  for (const listener of listeners) {
    try {
      listener(path, prev);
    } catch {
      // a listener must never break selection bookkeeping
    }
  }
};

export const getCurrentRepo = (): string | null => currentRepo;
