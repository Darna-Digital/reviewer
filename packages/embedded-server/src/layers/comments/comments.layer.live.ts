import * as Layer from "effect/Layer"
import {
  CommentsRepository,
  CommentsService,
  makeCommentsService,
} from "@byconvo/core/comments"
import { makeFileCommentsRepository } from "./comments.repository.file.ts"

export const CommentsLive = Layer.effect(CommentsService)(
  makeCommentsService
).pipe(
  Layer.provide(Layer.effect(CommentsRepository)(makeFileCommentsRepository))
)
