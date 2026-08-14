/**
 * Who is signed in, on its own.
 *
 * This is two strings, but where it is read from matters. The window bar's user
 * menu is part of the app shell — it renders on the first paint of every page,
 * code or collaboration — and it used to read `VIEWER` out of
 * `collaboration.mock`, a ~54 KB prototype dataset of projects, tasks, chats
 * and agents. One import of a name and an email was enough to put the whole of
 * it in the shell's chunk graph, where the build then module-preloaded it: paid
 * for on first paint by every user, to render an avatar.
 *
 * Splitting it out is the whole fix. `collaboration.mock` re-exports both
 * names, so everything that reads the viewer alongside the rest of the
 * prototype data is untouched, and the shell now imports only what it uses.
 */
export interface MockViewer {
  name: string;
  email: string;
}

/** Whoever is signed in — the account the workspace picker hangs off. */
export const VIEWER: MockViewer = {
  name: "Rūtenis Raila",
  email: "rutenis@darnadigital.com",
};
