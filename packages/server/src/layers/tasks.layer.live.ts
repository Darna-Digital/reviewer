import * as Layer from "effect/Layer"
import { TasksRepository, TasksService, make } from "@byconvo/core/tasks"
import { makeFileTasksRepository } from "../repositories/tasks.repository.file.ts"

export const TasksLive = Layer.effect(TasksService)(make).pipe(
  Layer.provide(Layer.effect(TasksRepository)(makeFileTasksRepository))
)
