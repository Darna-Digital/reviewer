import * as Schema from "effect/Schema";

export const CommentSide = Schema.Literals(["deletions", "additions"]);
export type CommentSide = typeof CommentSide.Type;
/**
 * Where a comment is kept. "local" is this machine's own database; the other
 * two are threads on the forge the checkout came from, read and written live.
 * They are spelled apart rather than folded into one "remote" because the id
 * under each is the forge's own and only that forge can read it back.
 */
export const CommentSource = Schema.Literals(["local", "github", "gitlab"]);
export type CommentSource = typeof CommentSource.Type;

/** A comment that lives on the forge rather than in this machine's database. */
export const isRemoteComment = (comment: {
  readonly source: CommentSource;
}): boolean => comment.source !== "local";

/**
 * The prefix a forge's comment ids carry, so a comment says which system can
 * answer for it without a second field to keep in step with the first.
 */
export const COMMENT_ID_PREFIX = { github: "gh", gitlab: "gl" } as const;

/** The forge's own id for a comment we hold, or null for a local one. */
export const remoteCommentId = (comment: {
  readonly id: string;
  readonly source: CommentSource;
}): string | null => {
  if (comment.source === "local") return null;
  const prefix = `${COMMENT_ID_PREFIX[comment.source]}-`;
  return comment.id.startsWith(prefix) ? comment.id.slice(prefix.length) : null;
};
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
