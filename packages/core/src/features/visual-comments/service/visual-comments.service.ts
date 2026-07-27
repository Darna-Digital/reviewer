import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import {
  VisualCommentsRepository,
  type VisualCommentsFailure,
  type VisualCommentsRepo,
} from "../repository/visual-comments.repository.ts"
import {
  EmptyCommentBody,
  MAX_ELEMENT_HTML,
  MAX_ELEMENT_TEXT,
  type AddVisualComment,
  type NewVisualComment,
  type VisualComment,
} from "../schema/visual-comments.schema.ts"

const DEFAULT_AUTHOR = "you"

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}…` : value

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim()

export const normalize = (input: NewVisualComment): AddVisualComment => ({
  ...input,
  body: input.body.trim(),
  author:
    input.author !== undefined && input.author.trim().length > 0
      ? input.author.trim()
      : DEFAULT_AUTHOR,
  route: input.route.startsWith("/") ? input.route : `/${input.route}`,
  label: collapseWhitespace(input.label),
  elementText: truncate(
    collapseWhitespace(input.elementText),
    MAX_ELEMENT_TEXT
  ),
  elementHtml: truncate(input.elementHtml, MAX_ELEMENT_HTML),
  rect: {
    x: Math.round(input.rect.x),
    y: Math.round(input.rect.y),
    width: Math.round(input.rect.width),
    height: Math.round(input.rect.height),
  },
})

export interface VisualCommentsServiceShape {
  readonly list: VisualCommentsRepo["list"]
  readonly add: (
    input: NewVisualComment
  ) => Effect.Effect<VisualComment, VisualCommentsFailure | EmptyCommentBody>
  readonly update: (
    id: string,
    body: string
  ) => Effect.Effect<VisualComment, VisualCommentsFailure | EmptyCommentBody>
  readonly remove: VisualCommentsRepo["remove"]
}

export class VisualCommentsService extends Context.Service<
  VisualCommentsService,
  VisualCommentsServiceShape
>()("VisualCommentsService") {}

export const makeVisualCommentsService = Effect.gen(function* () {
  const repo = yield* VisualCommentsRepository
  return VisualCommentsService.of({
    list: repo.list,
    add: (input) => {
      const normalized = normalize(input)
      return normalized.body.length === 0
        ? Effect.fail(new EmptyCommentBody())
        : repo.add(normalized)
    },
    update: (id, body) => {
      const trimmed = body.trim()
      if (trimmed.length === 0) return Effect.fail(new EmptyCommentBody())
      return repo.update(id, { body: trimmed })
    },
    remove: repo.remove,
  })
})
