/**
 * How the collaboration mode is laid out, worked out from the URL.
 *
 * Basecamp's shape is one centred column, and the whole of it is one decision:
 * how wide that column runs. Every page but the board is read down — a project,
 * a list of to-dos, a note — and reads best at the width of a page of prose.
 * The board is read *across*, and a column of prose can hold three of its
 * columns at most, so it gets the window.
 *
 * Kept as a function of the path rather than a prop the shell is handed, so the
 * shell can stay mounted while the page under it changes and still be the right
 * shape the frame after the URL does.
 */
import type { CollabPanel, CollabWidth } from "../interfaces/collab.interfaces";

export const COLLAB_PATH = "/modes/collaboration";

/** Where a project's own surfaces live, so links and matching agree. */
export const projectPath = (id: string): string =>
  `${COLLAB_PATH}/projects/${id}`;

export const boardPath = (id: string): string => `${projectPath(id)}/board`;
export const todosPath = (id: string): string => `${projectPath(id)}/todos`;
export const notesPath = (id: string): string => `${projectPath(id)}/notes`;

/**
 * The board is the one surface read across rather than down, so it is the one
 * that takes the window's width. Matched on the path's last segment rather than
 * with `includes`, so a project that happened to be called "board" — or a note
 * route beneath one — does not widen a page that is still a column of prose.
 */
export function collabWidth(pathname: string): CollabWidth {
  const segments = pathname.split("?")[0].split("/").filter(Boolean);
  return segments.at(-1) === "board" ? "wide" : "narrow";
}

/** The project a collaboration URL is under, if it is under one. */
export function projectIdOf(pathname: string): string | null {
  const segments = pathname.split("?")[0].split("/").filter(Boolean);
  const at = segments.indexOf("projects");
  return at === -1 ? null : (segments[at + 1] ?? null);
}

/**
 * The shortcuts the hovering bar carries, in the order it carries them.
 *
 * A list rather than three buttons written out, because the bar and the drawer
 * have to agree about them twice over — which panel each opens, and which one
 * is lit while it is open — and a list is the only way to say that once.
 */
export interface CollabShortcut {
  readonly panel: CollabPanel;
  readonly label: string;
}

export const COLLAB_SHORTCUTS: ReadonlyArray<CollabShortcut> = [
  { panel: "tasks", label: "My tasks" },
  { panel: "bookmarks", label: "My bookmarks" },
  { panel: "notes", label: "My notes" },
];

/**
 * What pressing a shortcut does to the drawer: the same one closes it, a
 * different one swaps what it shows without shutting it first.
 *
 * The drawer is one surface showing one of three things rather than three
 * drawers, so crossing between panels is a change of contents — closing and
 * reopening for a neighbouring panel would animate the whole sheet for what is
 * a change of a list.
 */
export function nextPanel(
  open: CollabPanel | null,
  pressed: CollabPanel
): CollabPanel | null {
  return open === pressed ? null : pressed;
}
