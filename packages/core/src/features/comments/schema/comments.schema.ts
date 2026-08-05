import * as Schema from "effect/Schema";

export const CommentSide = Schema.Literals(["deletions", "additions"]);
export type CommentSide = typeof CommentSide.Type;
export const CommentSource = Schema.Literals(["local", "github"]);
export type CommentSource = typeof CommentSource.Type;
export const ReviewComment = Schema.Struct({
  id: Schema.String,
  filePath: Schema.String,
  side: CommentSide,
  lineNumber: Schema.Number,
  body: Schema.String,
  author: Schema.String,
  createdAt: Schema.String,
  target: Schema.String,
  source: CommentSource,
});
export type ReviewComment = typeof ReviewComment.Type;
export const NewComment = Schema.Struct({
  filePath: Schema.String,
  side: CommentSide,
  lineNumber: Schema.Number,
  body: Schema.String,
  author: Schema.optionalKey(Schema.String),
  target: Schema.optionalKey(Schema.String),
});
export type NewComment = typeof NewComment.Type;
export const UpdateComment = Schema.Struct({
  body: Schema.String,
});
export type UpdateComment = typeof UpdateComment.Type;
export const CommentIdParam = Schema.Struct({ id: Schema.String });
