import * as Schema from "effect/Schema";

export const TasksColumn = Schema.String;
export type TasksColumn = typeof TasksColumn.Type;
export const TaskComment = Schema.Struct({
  id: Schema.String,
  body: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});
export type TaskComment = typeof TaskComment.Type;
export const Column = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  order: Schema.Number,
});
export type Column = typeof Column.Type;
export const DEFAULT_COLUMNS: ReadonlyArray<Column> = [
  { id: "todo", name: "To do", order: 0 },
  { id: "in_progress", name: "In progress", order: 1 },
  { id: "done", name: "Done", order: 2 },
];
export const Card = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  title: Schema.String,
  description: Schema.String,
  column: TasksColumn,
  order: Schema.Number,
  comments: Schema.Array(TaskComment),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});
export type Card = typeof Card.Type;
export const Board = Schema.Struct({
  cards: Schema.Array(Card),
  columns: Schema.Array(Column),
  prefix: Schema.String,
});
export type Board = typeof Board.Type;
export const TaskCommentResolution = Schema.Struct({
  card: Card,
  comment: TaskComment,
});
export type TaskCommentResolution = typeof TaskCommentResolution.Type;
export const NewCard = Schema.Struct({
  title: Schema.String,
  description: Schema.optionalKey(Schema.String),
  column: Schema.optionalKey(TasksColumn),
});
export type NewCard = typeof NewCard.Type;
export const UpdateCard = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  column: Schema.optionalKey(TasksColumn),
  order: Schema.optionalKey(Schema.Number),
});
export type UpdateCard = typeof UpdateCard.Type;
export const CardIdParam = Schema.Struct({ id: Schema.String });
export const TaskRefParam = Schema.Struct({ ref: Schema.String });
export const SetPrefix = Schema.Struct({ prefix: Schema.String });
export type SetPrefix = typeof SetPrefix.Type;
export const NewColumn = Schema.Struct({ name: Schema.String });
export type NewColumn = typeof NewColumn.Type;
export const UpdateColumn = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  order: Schema.optionalKey(Schema.Number),
});
export type UpdateColumn = typeof UpdateColumn.Type;
export const ColumnIdParam = Schema.Struct({ id: Schema.String });
export const NewTaskComment = Schema.Struct({
  body: Schema.String,
  parentId: Schema.optionalKey(Schema.String),
});
export type NewTaskComment = typeof NewTaskComment.Type;
export const TaskCommentIdParam = Schema.Struct({ commentId: Schema.String });
export const CardCommentParams = Schema.Struct({
  id: Schema.String,
  commentId: Schema.String,
});
