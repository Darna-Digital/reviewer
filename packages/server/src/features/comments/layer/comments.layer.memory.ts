import * as Layer from "effect/Layer"
import { CommentsRepository } from "../repository/comments.repository.ts"
import { makeMemoryCommentsRepository } from "../repository/comments.repository.memory.ts"
import { CommentsService, make } from "../service/comments.service.ts"
import type { ReviewComment } from "@byconvo/models/comments"

export const CommentsMemory = (seed: ReadonlyArray<ReviewComment> = []) =>
  Layer.effect(CommentsService)(make).pipe(
    Layer.provide(
      Layer.effect(CommentsRepository)(makeMemoryCommentsRepository(seed))
    )
  )
