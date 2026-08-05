import * as Layer from "effect/Layer";
import {
  ThreadsRepository,
  ThreadsService,
  makeThreadsService,
} from "@byconvo/core/threads";
import { makeFileThreadsRepository } from "./threads.repository.file.ts";

export const ThreadsLive = Layer.effect(ThreadsService)(
  makeThreadsService
).pipe(
  Layer.provide(Layer.effect(ThreadsRepository)(makeFileThreadsRepository))
);
