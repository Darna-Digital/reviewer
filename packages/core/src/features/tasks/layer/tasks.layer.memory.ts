import * as Layer from "effect/Layer"
import { TasksRepository } from "../repository/tasks.repository.ts"
import { makeMemoryTasksRepository } from "../repository/tasks.repository.memory.ts"
import { TasksService, makeTasksService } from "../service/tasks.service.ts"
import type { Card } from "../schema/tasks.schema.ts"

export const TasksMemory = (seed: ReadonlyArray<Card> = []) =>
  Layer.effect(TasksService)(makeTasksService).pipe(
    Layer.provide(
      Layer.effect(TasksRepository)(makeMemoryTasksRepository(seed))
    )
  )
