/**
 * Document tables — the shape most features want from the database.
 *
 * A review comment, a terminal thread, an analysis and a dev command are all
 * the same storage problem: a whole document, identified by id, belonging to
 * one repository, listed in timestamp order. Only the columns that are queried
 * are columns; the document itself rides in `data` as JSON and is decoded
 * through the feature's own `Schema`, so the schema stays the one definition of
 * the shape and adding a field to it is not a migration.
 *
 * One unreadable row is not a reason for a list to fail — a document written by
 * an older schema drops out of the list rather than taking the rest with it,
 * which is the behaviour the file-backed plans store already had and the one
 * every feature wants.
 */
import { allRows, execute, oneRow } from "./database.ts";

interface DocumentRow {
  readonly id: string;
  readonly data: string;
}

export interface DocumentTable<A> {
  /** Every document in `repoPath`, in the table's sort order. */
  readonly list: (repoPath: string) => ReadonlyArray<A>;
  readonly find: (repoPath: string, id: string) => A | undefined;
  /** Insert or replace one document. `sortKey` fills the sort column. */
  readonly put: (
    repoPath: string,
    id: string,
    sortKey: string,
    document: A
  ) => void;
  readonly remove: (repoPath: string, id: string) => void;
}

export interface DocumentTableOptions<A> {
  readonly table: string;
  /** The timestamp column rows are ordered by — `created_at` or `updated_at`. */
  readonly sortColumn: "created_at" | "updated_at";
  readonly direction: "asc" | "desc";
  /** Usually `Schema.decodeUnknownSync(TheFeaturesSchema)`. */
  readonly decode: (input: unknown) => A;
}

export const documentTable = <A>(
  options: DocumentTableOptions<A>
): DocumentTable<A> => {
  const { decode, table, sortColumn, direction } = options;
  const order = `ORDER BY ${sortColumn} ${direction === "asc" ? "ASC" : "DESC"}, id`;

  /** Decoding is best-effort per row; see the note at the top of the file. */
  const readable = (row: DocumentRow): ReadonlyArray<A> => {
    try {
      return [decode(JSON.parse(row.data))];
    } catch {
      return [];
    }
  };

  return {
    list: (repoPath) =>
      allRows<DocumentRow>(
        `SELECT id, data FROM ${table} WHERE repo_path = ? ${order}`,
        repoPath
      ).flatMap(readable),

    find: (repoPath, id) => {
      const row = oneRow<DocumentRow>(
        `SELECT id, data FROM ${table} WHERE repo_path = ? AND id = ?`,
        repoPath,
        id
      );
      if (row === undefined) return undefined;
      return readable(row)[0];
    },

    put: (repoPath, id, sortKey, document) => {
      execute(
        `INSERT INTO ${table} (id, repo_path, ${sortColumn}, data)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           repo_path = excluded.repo_path,
           ${sortColumn} = excluded.${sortColumn},
           data = excluded.data`,
        id,
        repoPath,
        sortKey,
        JSON.stringify(document)
      );
    },

    remove: (repoPath, id) => {
      execute(
        `DELETE FROM ${table} WHERE repo_path = ? AND id = ?`,
        repoPath,
        id
      );
    },
  };
};
