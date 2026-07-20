import * as Layer from "effect/Layer"
import { TasksRepository } from "./tasks.repository.ts"
import { makeMemoryTasksRepository } from "./tasks.repository.memory.ts"
import { TasksService, make } from "./tasks.service.ts"
import type { Card } from "./tasks.schema.ts"

export const TasksMemory = (seed: ReadonlyArray<Card> = []) =>
  Layer.effect(TasksService)(make).pipe(
    Layer.provide(
      Layer.effect(TasksRepository)(makeMemoryTasksRepository(seed))
    )
  )
