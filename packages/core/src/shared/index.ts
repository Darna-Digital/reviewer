import * as Schema from "effect/Schema"

export const Ok = Schema.Struct({ ok: Schema.Boolean })
export type Ok = typeof Ok.Type

export const DiffText = Schema.String
export type DiffText = typeof DiffText.Type
