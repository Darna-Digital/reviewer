/**
 * The single store for what is open — the repositories of the workspace, side
 * by side, every git view, file read and comment runs against one of — held
 * at module level so it can be read both inside and outside the Effect
 * runtime.
 *
 * The live PTY WebSocket handler and chat runtime run outside Effect (wired
 * straight onto the Node HTTP server's `upgrade` event / spawned processes), so
 * an Effect Ref wouldn't be reachable from them. WorkspaceContext therefore owns
 * no separate copy: it reads and writes the roots through here (on boot and
 * on every open), and everything else reads them here too.
 *
 * Which root a request is about is the request's to say (see
 * `requested-repo.ts`); what is kept here is only which roots are open. The
 * first of them is the default root — what a request that names none runs
 * against, so a client that predates workspaces keeps working on a workspace
 * of one, and on the first repository of a larger one.
 */
let openRoots: ReadonlyArray<string> = [];

/** Notified when the roots actually change, with (next, previous). */
type RootsListener = (
  next: ReadonlyArray<string>,
  prev: ReadonlyArray<string>
) => void;
const listeners = new Set<RootsListener>();

/**
 * Subscribe to changes of the open roots. Used by long-lived, non-Effect
 * state outside the request cycle — the chat runtime repairs the stale turns
 * of repositories as they open, the dev-process registry stops the processes
 * of the roots that left. Returns an unsubscribe function.
 */
export const onOpenRootsChange = (listener: RootsListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const sameRoots = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  a.length === b.length && a.every((root, index) => root === b[index]);

export const setOpenRoots = (roots: ReadonlyArray<string>): void => {
  const next = [...new Set(roots)];
  if (sameRoots(next, openRoots)) return;
  const prev = openRoots;
  openRoots = next;
  for (const listener of listeners) {
    try {
      listener(next, prev);
    } catch {
      // a listener must never break selection bookkeeping
    }
  }
};

/** Every repository open in the workspace, in its order. */
export const getOpenRoots = (): ReadonlyArray<string> => openRoots;

export const isOpenRoot = (path: string): boolean => openRoots.includes(path);

/** The default root: what a request that names no repository runs against. */
export const getCurrentRepo = (): string | null => openRoots[0] ?? null;

/**
 * The root a caller outside Effect asked for — a socket's `?repo=` — when it
 * is open; the default root when it asked for none; null for one that is not
 * open, which the caller refuses rather than quietly running elsewhere.
 */
export const repoFor = (requested: string | null): string | null =>
  requested === null || requested.length === 0
    ? getCurrentRepo()
    : isOpenRoot(requested)
      ? requested
      : null;
