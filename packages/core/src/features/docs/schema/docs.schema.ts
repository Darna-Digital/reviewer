import * as Schema from "effect/Schema"

/** A doc without its body — what the sidebar list needs, and nothing more. */
export const DocSummary = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  title: Schema.String,
  updatedAt: Schema.String,
})
export type DocSummary = typeof DocSummary.Type

export const Doc = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  title: Schema.String,
  /** Markdown. */
  content: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type Doc = typeof Doc.Type

export const NewDoc = Schema.Struct({
  projectId: Schema.String,
  title: Schema.optionalKey(Schema.String),
  content: Schema.optionalKey(Schema.String),
})
export type NewDoc = typeof NewDoc.Type

export const UpdateDoc = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  content: Schema.optionalKey(Schema.String),
})
export type UpdateDoc = typeof UpdateDoc.Type

export const DocIdParam = Schema.Struct({ id: Schema.String })
export const DocListQuery = Schema.Struct({ projectId: Schema.String })
