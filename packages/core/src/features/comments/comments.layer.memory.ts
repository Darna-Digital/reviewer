import * as Layer from "effect/Layer"
import { CommentsRepository } from "./comments.repository.ts"
import { makeMemoryCommentsRepository } from "./comments.repository.memory.ts"
import { CommentsService, make } from "./comments.service.ts"
import type { ReviewComment } from "./comments.schema.ts"

export const CommentsMemory = (seed: ReadonlyArray<ReviewComment> = []) =>
  Layer.effect(CommentsService)(make).pipe(
    Layer.provide(
      Layer.effect(CommentsRepository)(makeMemoryCommentsRepository(seed))
    )
  )
