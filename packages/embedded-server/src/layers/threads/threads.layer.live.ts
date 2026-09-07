import * as Layer from "effect/Layer";
import {
  ThreadsRepository,
  ThreadsService,
  makeThreadsService,
} from "@reviewer/core/threads";
import { makeSqliteThreadsRepository } from "./threads.repository.sqlite.ts";

export const ThreadsLive = Layer.effect(ThreadsService)(
  makeThreadsService
).pipe(
  Layer.provide(Layer.effect(ThreadsRepository)(makeSqliteThreadsRepository))
);
