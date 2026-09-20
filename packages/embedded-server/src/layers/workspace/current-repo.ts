/**
 * The single store for what is open — the repository every git view, file
 * read and comment runs against — held at module level so it can be read
 * both inside and outside the Effect runtime.
 *
 * The live PTY WebSocket handler and chat runtime run outside Effect (wired
 * straight onto the Node HTTP server's `upgrade` event / spawned processes), so
 * an Effect Ref wouldn't be reachable from them. WorkspaceContext therefore owns
 * no separate copy: it reads and writes the selection through here (on boot and
 * on every selection), and everything else reads it here too.
 */
let currentRepo: string | null = null;

/** Notified when the selection actually changes, with (next, previous) paths. */
type SelectionListener = (next: string | null, prev: string | null) => void;
const listeners = new Set<SelectionListener>();

/**
 * Subscribe to repository-selection changes. Used by long-lived, non-Effect
 * state outside the request cycle — the chat runtime repairs a repo's stale
 * turns when the user opens it, the dev-process registry stops the processes
 * the one being left was running. Returns an unsubscribe function.
 */
export const onCurrentRepoChange = (
  listener: SelectionListener
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

/** The repository everything runs against — git, files, comments. */
export const getCurrentRepo = (): string | null => currentRepo;
