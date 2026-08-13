import * as Layer from "effect/Layer";
import {
  TasksRepository,
  TasksService,
  makeTasksService,
} from "@byconvo/core/tasks";
import { makeSqliteTasksRepository } from "./tasks.repository.sqlite.ts";

export const TasksLive = Layer.effect(TasksService)(makeTasksService).pipe(
  Layer.provide(Layer.effect(TasksRepository)(makeSqliteTasksRepository))
);
