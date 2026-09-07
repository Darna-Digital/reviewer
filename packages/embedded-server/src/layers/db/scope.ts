/**
 * Where a row belongs — the repository it was written in, and the project that
 * repository was open under.
 *
 * Rows are keyed by repository path, which is the scope every feature already
 * had. The project is a second, looser grouping: the folder the user opened,
 * which may hold several repositories side by side. Keeping it in its own
 * table rather than on every row means re-opening a repository under a
 * different project re-labels its history instead of splitting it.
 *
 * Nothing here fails. A repository reviewer has not been told about yet — a
 * chat imported from a folder that is no longer open — still needs a label, so
 * it stands as its own project, named after the directory.
 */
import { basename } from "node:path";
import { database } from "./database.ts";

export interface Origin {
  /** The project folder the repository was last opened under. */
  readonly projectPath: string;
  /** What to call that folder in the UI. */
  readonly projectName: string;
  readonly repoPath: string;
  /** Project-relative name, so a nested root reads as `apps/web`. */
  readonly repoName: string;
}

const nameOfDirectory = (path: string): string => {
  const name = basename(path);
  return name.length > 0 ? name : path;
};

/** The label a repository falls back to when it has never been registered. */
export const unknownOrigin = (repoPath: string): Origin => ({
  projectPath: repoPath,
  projectName: nameOfDirectory(repoPath),
  repoPath,
  repoName: nameOfDirectory(repoPath),
});

/**
 * Record the project the user just opened and the repositories it holds, so
 * everything written from them can be grouped and filtered by project later.
 * Called on every open — a root cloned into the folder since last time is
 * picked up, and one that vanished keeps its history rather than losing it.
 */
export const rememberProject = (
  projectPath: string,
  repos: ReadonlyArray<{ readonly name: string; readonly path: string }>
): void => {
  const db = database();
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO project (path, name, opened_at) VALUES (?, ?, ?)
       ON CONFLICT (path) DO UPDATE SET name = excluded.name, opened_at = excluded.opened_at`
    ).run(projectPath, nameOfDirectory(projectPath), now);
    const upsert = db.prepare(
      `INSERT INTO repo (path, project_path, name, seen_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (path) DO UPDATE SET
         project_path = excluded.project_path,
         name = excluded.name,
         seen_at = excluded.seen_at`
    );
    for (const repo of repos) {
      upsert.run(repo.path, projectPath, repo.name, now);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

/**
 * Register a repository on its own, for the paths that reach storage without
 * having come through a project open (the boot seed, a chat created against a
 * root that was scanned before this table existed).
 */
export const rememberRepo = (repoPath: string, projectPath: string): void => {
  const db = database();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO project (path, name, opened_at) VALUES (?, ?, ?)
     ON CONFLICT (path) DO NOTHING`
  ).run(projectPath, nameOfDirectory(projectPath), now);
  db.prepare(
    `INSERT INTO repo (path, project_path, name, seen_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (path) DO NOTHING`
  ).run(repoPath, projectPath, nameOfDirectory(repoPath), now);
};
