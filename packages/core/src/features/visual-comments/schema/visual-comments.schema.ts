import * as Schema from "effect/Schema"

export const ElementRect = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
})
export type ElementRect = typeof ElementRect.Type

export const Viewport = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
})
export type Viewport = typeof Viewport.Type

const anchorFields = {
  pageUrl: Schema.String,
  pageTitle: Schema.String,
  route: Schema.String,
  selector: Schema.String,
  label: Schema.String,
  tagName: Schema.String,
  elementText: Schema.String,
  elementHtml: Schema.String,
  rect: ElementRect,
  viewport: Viewport,
  sourceFile: Schema.optionalKey(Schema.String),
  sourceLine: Schema.optionalKey(Schema.Number),
}

export const NewVisualComment = Schema.Struct({
  body: Schema.String,
  author: Schema.optionalKey(Schema.String),
  ...anchorFields,
})
export type NewVisualComment = typeof NewVisualComment.Type

export const AddVisualComment = Schema.Struct({
  ...NewVisualComment.fields,
  author: Schema.String,
})
export type AddVisualComment = typeof AddVisualComment.Type

export const VisualComment = Schema.Struct({
  id: Schema.String,
  createdAt: Schema.String,
  ...AddVisualComment.fields,
})
export type VisualComment = typeof VisualComment.Type

export const VisualCommentIdParam = Schema.Struct({ id: Schema.String })

export class EmptyCommentBody extends Schema.TaggedErrorClass<EmptyCommentBody>()(
  "EmptyCommentBody",
  {},
  { httpApiStatus: 422 }
) {
  override get message(): string {
    return "a visual comment needs a body"
  }
}

export const MAX_ELEMENT_HTML = 2000
export const MAX_ELEMENT_TEXT = 500
