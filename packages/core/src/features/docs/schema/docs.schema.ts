import * as Schema from "effect/Schema"

export const DocSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  updatedAt: Schema.String,
})
export type DocSummary = typeof DocSummary.Type
export const Doc = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  content: Schema.String,
  updatedAt: Schema.String,
})
export type Doc = typeof Doc.Type
export const NewDoc = Schema.Struct({
  title: Schema.String,
})
export type NewDoc = typeof NewDoc.Type
export const UpdateDoc = Schema.Struct({
  content: Schema.String,
})
export type UpdateDoc = typeof UpdateDoc.Type
export const DocIdParam = Schema.Struct({ id: Schema.String })
