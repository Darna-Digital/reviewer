/**
 * The workspaces kept to come back to — a name over an ordered set of
 * repositories, in the `workspace` and `workspace_root` tables.
 *
 * Plain synchronous functions over the shared database, like `db/scope.ts`:
 * the workspace context reads them while it boots, before any request, and
 * `node:sqlite` answers synchronously anyway. Several servers share the file,
 * so nothing is cached here — a workspace saved from one window is listed in
 * the next window's opener straight away.
 */
import { randomUUID } from "node:crypto";
import type { SavedWorkspace } from "@reviewer/core/workspace";
import { allRows, database, execute, oneRow } from "../db/database.ts";

interface WorkspaceRow {
  readonly id: string;
  readonly name: string;
  readonly created_at: string;
  readonly opened_at: string | null;
}

const rootsOf = (id: string): ReadonlyArray<string> =>
  allRows<{ path: string }>(
    "SELECT path FROM workspace_root WHERE workspace_id = ? ORDER BY position",
    id
  ).map((row) => row.path);

const toSaved = (row: WorkspaceRow): SavedWorkspace => ({
  id: row.id,
  name: row.name,
  roots: rootsOf(row.id),
  createdAt: row.created_at,
  openedAt: row.opened_at,
});

/** Most recently opened first; never-opened ones after, newest made first. */
export const listWorkspaces = (): ReadonlyArray<SavedWorkspace> =>
  allRows<WorkspaceRow>(
    `SELECT id, name, created_at, opened_at FROM workspace
     ORDER BY opened_at IS NULL, opened_at DESC, created_at DESC`
  ).map(toSaved);

export const findWorkspace = (id: string): SavedWorkspace | undefined => {
  const row = oneRow<WorkspaceRow>(
    "SELECT id, name, created_at, opened_at FROM workspace WHERE id = ?",
    id
  );
  return row === undefined ? undefined : toSaved(row);
};

/** The roots replaced as a whole, in one transaction, so a reader never sees half. */
const writeRoots = (id: string, roots: ReadonlyArray<string>): void => {
  execute("DELETE FROM workspace_root WHERE workspace_id = ?", id);
  roots.forEach((path, position) =>
    execute(
      "INSERT INTO workspace_root (workspace_id, path, position) VALUES (?, ?, ?)",
      id,
      path,
      position
    )
  );
};

const inTransaction = <A>(write: () => A): A => {
  const db = database();
  db.exec("BEGIN");
  try {
    const result = write();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

export const createWorkspace = (
  name: string,
  roots: ReadonlyArray<string>
): SavedWorkspace => {
  const id = randomUUID();
  inTransaction(() => {
    execute(
      "INSERT INTO workspace (id, name, created_at, opened_at) VALUES (?, ?, ?, NULL)",
      id,
      name,
      new Date().toISOString()
    );
    writeRoots(id, roots);
  });
  return findWorkspace(id)!;
};

/** Undefined when there is no such workspace. */
export const updateWorkspace = (
  id: string,
  patch: { readonly name?: string; readonly roots?: ReadonlyArray<string> }
): SavedWorkspace | undefined => {
  if (findWorkspace(id) === undefined) return undefined;
  inTransaction(() => {
    if (patch.name !== undefined) {
      execute("UPDATE workspace SET name = ? WHERE id = ?", patch.name, id);
    }
    if (patch.roots !== undefined) writeRoots(id, patch.roots);
  });
  return findWorkspace(id);
};

/** Whether there was one to delete; its roots go with it (ON DELETE CASCADE). */
export const deleteWorkspace = (id: string): boolean => {
  if (findWorkspace(id) === undefined) return false;
  execute("DELETE FROM workspace WHERE id = ?", id);
  return true;
};

export const markWorkspaceOpened = (id: string): void =>
  execute(
    "UPDATE workspace SET opened_at = ? WHERE id = ?",
    new Date().toISOString(),
    id
  );
