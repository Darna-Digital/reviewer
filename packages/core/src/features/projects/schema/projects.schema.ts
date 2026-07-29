import * as Schema from "effect/Schema"

/**
 * The palette a project (or label) picks its accent from. Stored as the name,
 * not a hex value, so the two themes can resolve it to different ink.
 */
export const AccentColor = Schema.Literals([
  "gray",
  "blue",
  "indigo",
  "purple",
  "pink",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
])
export type AccentColor = typeof AccentColor.Type

export const Project = Schema.Struct({
  id: Schema.String,
  /** Short uppercase prefix — the first half of every task key ("BYC-12"). */
  key: Schema.String,
  name: Schema.String,
  description: Schema.String,
  color: AccentColor,
  archived: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
})
export type Project = typeof Project.Type

export const NewProject = Schema.Struct({
  name: Schema.String,
  /** Derived from the name when omitted. */
  key: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  color: Schema.optionalKey(AccentColor),
})
export type NewProject = typeof NewProject.Type

export const UpdateProject = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  key: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  color: Schema.optionalKey(AccentColor),
  archived: Schema.optionalKey(Schema.Boolean),
})
export type UpdateProject = typeof UpdateProject.Type

export const ProjectIdParam = Schema.Struct({ id: Schema.String })
