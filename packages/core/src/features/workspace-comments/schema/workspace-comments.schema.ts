import * as Schema from "effect/Schema"

/** What a comment hangs off. Tasks and docs share one thread implementation. */
export const CommentSubject = Schema.Literals(["task", "doc"])
export type CommentSubject = typeof CommentSubject.Type

/**
 * The commenter, denormalized onto the comment so a thread renders from one
 * read. Null-ish fields cover a member who has since left the organization.
 */
export const CommentAuthor = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  image: Schema.NullOr(Schema.String),
})
export type CommentAuthor = typeof CommentAuthor.Type

export const WorkspaceComment = Schema.Struct({
  id: Schema.String,
  subjectType: CommentSubject,
  subjectId: Schema.String,
  /** The comment being replied to, or null at the top of a thread. */
  parentId: Schema.NullOr(Schema.String),
  body: Schema.String,
  author: CommentAuthor,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  /** True once the body has been edited after posting. */
  edited: Schema.Boolean,
})
export type WorkspaceComment = typeof WorkspaceComment.Type

export const NewWorkspaceComment = Schema.Struct({
  subjectType: CommentSubject,
  subjectId: Schema.String,
  body: Schema.String,
  parentId: Schema.optionalKey(Schema.NullOr(Schema.String)),
})
export type NewWorkspaceComment = typeof NewWorkspaceComment.Type

export const UpdateWorkspaceComment = Schema.Struct({
  body: Schema.String,
})
export type UpdateWorkspaceComment = typeof UpdateWorkspaceComment.Type

export const WorkspaceCommentIdParam = Schema.Struct({ id: Schema.String })
export const WorkspaceCommentListQuery = Schema.Struct({
  subjectType: CommentSubject,
  subjectId: Schema.String,
})
