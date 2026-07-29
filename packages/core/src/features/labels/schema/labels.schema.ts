import * as Schema from "effect/Schema"
import { AccentColor } from "../../projects/schema/projects.schema.ts"

export const Label = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  name: Schema.String,
  color: AccentColor,
  createdAt: Schema.String,
})
export type Label = typeof Label.Type

export const NewLabel = Schema.Struct({
  projectId: Schema.String,
  name: Schema.String,
  color: Schema.optionalKey(AccentColor),
})
export type NewLabel = typeof NewLabel.Type

export const UpdateLabel = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  color: Schema.optionalKey(AccentColor),
})
export type UpdateLabel = typeof UpdateLabel.Type

export const LabelIdParam = Schema.Struct({ id: Schema.String })
export const LabelListQuery = Schema.Struct({ projectId: Schema.String })
