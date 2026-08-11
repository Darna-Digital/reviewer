/**
 * The single store for what is open — the project folder and, inside it, the
 * git root the git views follow — held at module level so it can be read both
 * inside and outside the Effect runtime.
 *
 * The live PTY WebSocket handler and chat runtime run outside Effect (wired
 * straight onto the Node HTTP server's `upgrade` event / spawned processes), so
 * an Effect Ref wouldn't be reachable from them. WorkspaceContext therefore owns
 * no separate copy: it reads and writes the selection through here (on boot and
 * on every selection), and everything else reads it here too.
 *
 * A project holding one repository moves both values together. One holding
 * several (`backend`, `frontend`) keeps the project put while the repository
 * changes underneath it — which is why the two have separate listeners: work
 * tied to the project (running dev servers) must survive a repository switch.
 */
let currentProject: string | null = null;
let currentRepo: string | null = null;

/** Notified when a selection actually changes, with (next, previous) paths. */
type SelectionListener = (next: string | null, prev: string | null) => void;
const repoListeners = new Set<SelectionListener>();
const projectListeners = new Set<SelectionListener>();

const notify = (
  listeners: ReadonlySet<SelectionListener>,
  next: string | null,
  prev: string | null
): void => {
  for (const listener of listeners) {
    try {
      listener(next, prev);
    } catch {
      // a listener must never break selection bookkeeping
    }
  }
};

/**
 * Subscribe to repository-selection changes. Used by long-lived, non-Effect
 * state outside the request cycle — e.g. the chat runtime repairs a repo's
 * stale turns when the user selects it. Returns an unsubscribe function.
 */
export const onCurrentRepoChange = (
  listener: SelectionListener
): (() => void) => {
  repoListeners.add(listener);
  return () => repoListeners.delete(listener);
};

/**
 * Subscribe to project changes — the coarser event, for state that belongs to
 * the project as a whole (the Local Dev processes of every root it holds)
 * rather than to whichever root is selected right now.
 */
export const onCurrentProjectChange = (
  listener: SelectionListener
): (() => void) => {
  projectListeners.add(listener);
  return () => projectListeners.delete(listener);
};

export const setCurrentProject = (path: string | null): void => {
  if (path === currentProject) return;
  const prev = currentProject;
  currentProject = path;
  notify(projectListeners, path, prev);
};

export const setCurrentRepo = (path: string | null): void => {
  if (path === currentRepo) return;
  const prev = currentRepo;
  currentRepo = path;
  notify(repoListeners, path, prev);
};

/** The git root everything repo-scoped runs against — git, files, comments. */
export const getCurrentRepo = (): string | null => currentRepo;

/** The open project folder, which may hold several repositories. */
export const getCurrentProject = (): string | null => currentProject;
