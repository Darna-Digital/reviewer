/**
 * The reviewer database — one SQLite file at `~/.reviewer/reviewer.db` holding
 * every project's state, in place of the `.reviewer/*.json` files each
 * repository used to carry.
 *
 * One file, not one per repository, is what makes the sessions surface able to
 * show every project's conversations side by side: rows carry the repository
 * they belong to (`repo_path`) rather than being separated by which file they
 * were written into. Everything else follows from that — filtering by project
 * is a `WHERE`, and a chat opened from another project still knows the
 * directory its agent has to run in.
 *
 * Like `current-repo.ts`, this is a module-level singleton rather than an
 * Effect Ref: two very different callers share it. The feature repositories
 * reach it through the `Database` service (per request), and the chat turn
 * runtime — which lives outside the Effect runtime, on spawned processes and
 * WebSockets — calls straight in as a turn streams. `node:sqlite` is
 * synchronous, which is exactly what that second caller needs.
 */
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { MIGRATIONS } from "./migrations.ts";

export type Param = SQLInputValue;

/**
 * Query helpers. `node:sqlite` types every row as `Record<string,
 * SQLOutputValue>`; each caller here knows the columns its own SELECT asked
 * for, so the row shape is named at the call site instead of being re-asserted
 * inline every time.
 */
export const allRows = <A>(
  sql: string,
  ...params: ReadonlyArray<Param>
): ReadonlyArray<A> =>
  database()
    .prepare(sql)
    .all(...params) as unknown as ReadonlyArray<A>;

export const oneRow = <A>(
  sql: string,
  ...params: ReadonlyArray<Param>
): A | undefined =>
  database()
    .prepare(sql)
    .get(...params) as unknown as A | undefined;

export const execute = (sql: string, ...params: ReadonlyArray<Param>): void => {
  database()
    .prepare(sql)
    .run(...params);
};

/** `REVIEWER_DB` overrides it; `:memory:` is what the tests open. */
export const databasePath = (): string => {
  const configured = process.env["REVIEWER_DB"];
  if (configured !== undefined && configured.length > 0) return configured;
  return `${homedir()}/.reviewer/reviewer.db`;
};

let handle: DatabaseSync | null = null;

/**
 * WAL keeps the streaming turn's writes from blocking the reads every open
 * client makes; the busy timeout covers the moment two of them do collide.
 */
const configure = (db: DatabaseSync): void => {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
};

const applied = (db: DatabaseSync): ReadonlySet<string> => {
  db.exec(
    "CREATE TABLE IF NOT EXISTS migration (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
  );
  const rows = db
    .prepare("SELECT id FROM migration")
    .all() as unknown as ReadonlyArray<{ id: string }>;
  return new Set(rows.map((row) => row.id));
};

/**
 * Bring the file up to date. Each migration and the row recording it land in
 * one transaction, so a crash halfway through leaves the file on the last
 * version that fully applied rather than on half of the next one.
 */
export const migrate = (db: DatabaseSync): void => {
  const done = applied(db);
  const record = db.prepare(
    "INSERT INTO migration (id, applied_at) VALUES (?, ?)"
  );
  for (const migration of MIGRATIONS) {
    if (done.has(migration.id)) continue;
    db.exec("BEGIN");
    try {
      migration.up(db);
      record.run(migration.id, new Date().toISOString());
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
};

/** Open (or replace) the process-wide database. Returns the live handle. */
export const openDatabase = (path: string = databasePath()): DatabaseSync => {
  closeDatabase();
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  configure(db);
  migrate(db);
  handle = db;
  return db;
};

/** The database, opened on first use. */
export const database = (): DatabaseSync => handle ?? openDatabase();

export const closeDatabase = (): void => {
  if (handle === null) return;
  const open = handle;
  handle = null;
  try {
    open.close();
  } catch {
    // a handle that is already closed is the state we wanted
  }
};

/**
 * Run `f` inside a transaction. Feature writes that touch more than one row —
 * a chat and its messages, a board and its cards — go through here so a reader
 * never sees half of one.
 */
export const transact = <A>(f: (db: DatabaseSync) => A): A => {
  const db = database();
  db.exec("BEGIN");
  try {
    const result = f(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};
