/**
 * Tasks store — the `task_board` and `task_card` tables for one repository.
 *
 * Framework-free for the same reason the chat and thread stores are: the PTY
 * socket looks a card up by key while a terminal is attaching, outside the
 * Effect runtime.
 *
 * The board's own state (its key prefix, the running counter, its columns) is a
 * single row; the cards are rows of their own, so moving one card is an update
 * of one card rather than a rewrite of the board.
 */
import * as Schema from "effect/Schema";
import { Card, Column, DEFAULT_COLUMNS } from "@byconvo/core/tasks";
import { allRows, database, oneRow, transact } from "../db/database.ts";

export const DEFAULT_PREFIX = "T";

const decodeCard = Schema.decodeUnknownSync(Card);
const decodeColumns = Schema.decodeUnknownSync(Schema.Array(Column));

export interface BoardState {
  readonly cards: ReadonlyArray<Card>;
  readonly counter: number;
  readonly prefix: string;
  readonly columns: ReadonlyArray<Column>;
}

export const EMPTY_BOARD: BoardState = {
  cards: [],
  counter: 0,
  prefix: DEFAULT_PREFIX,
  columns: DEFAULT_COLUMNS,
};

export const sortedColumns = (
  columns: ReadonlyArray<Column>
): ReadonlyArray<Column> => [...columns].sort((a, b) => a.order - b.order);

interface BoardRow {
  readonly prefix: string;
  readonly counter: number;
  readonly columns: string;
}

/** Every card in a repository's board, in board order. */
export const readCards = (repoPath: string): ReadonlyArray<Card> =>
  allRows<{ data: string }>(
    "SELECT data FROM task_card WHERE repo_path = ? ORDER BY sort_order, id",
    repoPath
  ).flatMap((row) => {
    try {
      return [decodeCard(JSON.parse(row.data))];
    } catch {
      return [];
    }
  });

export const readBoard = (repoPath: string): BoardState => {
  const row = oneRow<BoardRow>(
    "SELECT prefix, counter, columns FROM task_board WHERE repo_path = ?",
    repoPath
  );
  if (row === undefined) return { ...EMPTY_BOARD, cards: readCards(repoPath) };
  let columns: ReadonlyArray<Column>;
  try {
    columns = decodeColumns(JSON.parse(row.columns));
  } catch {
    columns = DEFAULT_COLUMNS;
  }
  return {
    cards: readCards(repoPath),
    counter: row.counter,
    prefix: row.prefix.length > 0 ? row.prefix : DEFAULT_PREFIX,
    // Seed the default columns when a board has none yet.
    columns: columns.length > 0 ? columns : DEFAULT_COLUMNS,
  };
};

export const writeBoardState = (
  repoPath: string,
  state: {
    readonly counter: number;
    readonly prefix: string;
    readonly columns: ReadonlyArray<Column>;
  }
): void => {
  database()
    .prepare(
      `INSERT INTO task_board (repo_path, prefix, counter, columns)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (repo_path) DO UPDATE SET
         prefix = excluded.prefix,
         counter = excluded.counter,
         columns = excluded.columns`
    )
    .run(repoPath, state.prefix, state.counter, JSON.stringify(state.columns));
};

export const writeCard = (repoPath: string, card: Card): void => {
  database()
    .prepare(
      `INSERT INTO task_card (id, repo_path, column_id, sort_order, data)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         repo_path = excluded.repo_path,
         column_id = excluded.column_id,
         sort_order = excluded.sort_order,
         data = excluded.data`
    )
    .run(card.id, repoPath, card.column, card.order, JSON.stringify(card));
};

export const writeCards = (
  repoPath: string,
  cards: ReadonlyArray<Card>
): void => {
  transact(() => {
    for (const card of cards) writeCard(repoPath, card);
  });
};

export const removeCard = (repoPath: string, id: string): void => {
  database()
    .prepare("DELETE FROM task_card WHERE repo_path = ? AND id = ?")
    .run(repoPath, id);
};

export const findCard = (repoPath: string, id: string): Card | undefined =>
  readCards(repoPath).find((card) => card.id === id);

/** The card a thread is linked to, looked up by its human key (`T-12`). */
export const findCardByKey = (
  repoPath: string,
  key: string
): Card | undefined => readCards(repoPath).find((card) => card.key === key);
