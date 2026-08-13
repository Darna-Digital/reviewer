/**
 * SQLite-backed Tasks board — cards, columns (statuses) and the key counter,
 * scoped to the repository the board belongs to.
 */
import * as Effect from "effect/Effect";
import { NotFound, StorageError } from "@byconvo/core/shared";
import { normalizePrefix } from "@byconvo/core/tasks";
import type {
  Card,
  Column,
  CreateCardInput,
  TaskComment,
  TasksRepo,
  UpdateCardInput,
  UpdateColumnInput,
} from "@byconvo/core/tasks";
import { inRepo } from "../db/db.service.ts";
import { transact } from "../db/database.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import {
  findCard,
  readBoard,
  removeCard,
  sortedColumns,
  writeBoardState,
  writeCard,
  writeCards,
  type BoardState,
} from "./store.ts";

const toBoard = (state: BoardState) => ({
  cards: [...state.cards].sort((a, b) => a.order - b.order),
  columns: sortedColumns(state.columns),
  prefix: state.prefix,
});

/** A stable, readable column id derived from a name, unique within the board. */
const columnIdFrom = (
  name: string,
  existing: ReadonlyArray<Column>
): string => {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "column";
  const taken = new Set(existing.map((c) => c.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
};

// Module-scoped so comment ids stay unique across per-request repository instances.
let commentCounter = 0;
const nextCommentId = () =>
  `cmt-${Date.now().toString(36)}-${(commentCounter += 1)}`;

export const makeSqliteTasksRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;
  const withRepo = inRepo(ctx);

  const requireCard = (repoPath: string, id: string): Card => {
    const card = findCard(repoPath, id);
    if (card === undefined) {
      throw new NotFound({ reason: `card ${id} not found` });
    }
    return card;
  };

  const board: TasksRepo["board"] = withRepo((repoPath) =>
    toBoard(readBoard(repoPath))
  );

  const create: TasksRepo["create"] = (input: CreateCardInput) =>
    withRepo((repoPath) =>
      transact(() => {
        const state = readBoard(repoPath);
        const counter = state.counter + 1;
        const now = new Date().toISOString();
        const column =
          input.column ?? sortedColumns(state.columns)[0]?.id ?? "todo";
        const maxOrder = state.cards
          .filter((c) => c.column === column)
          .reduce((max, c) => Math.max(max, c.order), 0);
        const created: Card = {
          id: `card-${Date.now().toString(36)}-${counter}`,
          key: `${state.prefix}-${counter}`,
          title: input.title,
          description: input.description,
          column,
          order: maxOrder + 1,
          comments: [],
          createdAt: now,
          updatedAt: now,
        };
        writeBoardState(repoPath, { ...state, counter });
        writeCard(repoPath, created);
        return created;
      })
    );

  /** Apply `change` to one card and persist it. */
  const patchCard = (
    repoPath: string,
    id: string,
    change: (card: Card) => Card
  ): Card => {
    const updated = change(requireCard(repoPath, id));
    writeCard(repoPath, updated);
    return updated;
  };

  const update: TasksRepo["update"] = (id, input: UpdateCardInput) =>
    withRepo((repoPath) =>
      patchCard(repoPath, id, (existing) => ({
        ...existing,
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        column: input.column ?? existing.column,
        order: input.order ?? existing.order,
        updatedAt: new Date().toISOString(),
      }))
    );

  const remove: TasksRepo["remove"] = (id) =>
    withRepo((repoPath) => removeCard(repoPath, id));

  const setPrefix: TasksRepo["setPrefix"] = (prefix) =>
    withRepo((repoPath) => {
      const next = { ...readBoard(repoPath), prefix: normalizePrefix(prefix) };
      writeBoardState(repoPath, next);
      return toBoard(next);
    });

  const addColumn: TasksRepo["addColumn"] = (name) =>
    withRepo((repoPath) => {
      const state = readBoard(repoPath);
      const trimmed = name.trim();
      const maxOrder = state.columns.reduce((m, c) => Math.max(m, c.order), -1);
      const column: Column = {
        id: columnIdFrom(
          trimmed.length > 0 ? trimmed : "column",
          state.columns
        ),
        name: trimmed.length > 0 ? trimmed : "New column",
        order: maxOrder + 1,
      };
      const next = { ...state, columns: [...state.columns, column] };
      writeBoardState(repoPath, next);
      return toBoard(next);
    });

  const updateColumn: TasksRepo["updateColumn"] = (
    id,
    input: UpdateColumnInput
  ) =>
    withRepo((repoPath) => {
      const state = readBoard(repoPath);
      const existing = state.columns.find((c) => c.id === id);
      if (existing === undefined) {
        throw new NotFound({ reason: `column ${id} not found` });
      }
      const updated: Column = {
        ...existing,
        name:
          input.name !== undefined && input.name.trim().length > 0
            ? input.name.trim()
            : existing.name,
        order: input.order ?? existing.order,
      };
      const next = {
        ...state,
        columns: state.columns.map((c) => (c.id === id ? updated : c)),
      };
      writeBoardState(repoPath, next);
      return toBoard(next);
    });

  const removeColumn: TasksRepo["removeColumn"] = (id) =>
    withRepo((repoPath) =>
      transact(() => {
        const state = readBoard(repoPath);
        // A board always keeps at least one column.
        if (state.columns.length <= 1) {
          throw new StorageError({
            reason: "a board needs at least one column",
          });
        }
        const remaining = sortedColumns(
          state.columns.filter((c) => c.id !== id)
        );
        const fallback = remaining[0]?.id ?? "todo";
        // Move orphaned cards to the first remaining column (no data loss).
        const moved = state.cards
          .filter((c) => c.column === id)
          .map((c) => ({ ...c, column: fallback }));
        const next: BoardState = {
          ...state,
          columns: remaining,
          cards: state.cards.map((c) =>
            c.column === id ? { ...c, column: fallback } : c
          ),
        };
        writeBoardState(repoPath, next);
        writeCards(repoPath, moved);
        return toBoard(next);
      })
    );

  const addComment: TasksRepo["addComment"] = (cardId, body, parentId) =>
    withRepo((repoPath) => {
      const now = new Date().toISOString();
      const comment: TaskComment = {
        id: nextCommentId(),
        body: body.trim(),
        parentId,
        createdAt: now,
      };
      return patchCard(repoPath, cardId, (existing) => ({
        ...existing,
        comments: [...existing.comments, comment],
        updatedAt: now,
      }));
    });

  const removeComment: TasksRepo["removeComment"] = (cardId, commentId) =>
    withRepo((repoPath) =>
      patchCard(repoPath, cardId, (existing) => ({
        ...existing,
        comments: existing.comments.filter((c) => c.id !== commentId),
        updatedAt: new Date().toISOString(),
      }))
    );

  return {
    board,
    create,
    update,
    remove,
    setPrefix,
    addColumn,
    updateColumn,
    removeColumn,
    addComment,
    removeComment,
  } satisfies TasksRepo;
});
