import * as Layer from "effect/Layer"
import { TasksRepository, TasksService, makeTasksService } from "@byconvo/core"
import { makeFileTasksRepository } from "./tasks.repository.file.ts"

export const TasksLive = Layer.effect(TasksService)(makeTasksService).pipe(
  Layer.provide(Layer.effect(TasksRepository)(makeFileTasksRepository))
)
