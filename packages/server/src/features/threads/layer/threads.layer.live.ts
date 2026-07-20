import * as Layer from "effect/Layer"
import { ThreadsRepository, ThreadsService, make } from "@byconvo/core/threads"
import { makeFileThreadsRepository } from "../repository/threads.repository.file.ts"

export const ThreadsLive = Layer.effect(ThreadsService)(make).pipe(
  Layer.provide(Layer.effect(ThreadsRepository)(makeFileThreadsRepository))
)
