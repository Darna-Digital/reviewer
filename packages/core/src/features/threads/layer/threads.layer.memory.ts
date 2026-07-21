import * as Layer from "effect/Layer"
import { memoryLayer as terminalMemoryLayer } from "../../../ports/terminal-exec.ts"
import { ThreadsRepository } from "../repository/threads.repository.ts"
import { makeMemoryThreadsRepository } from "../repository/threads.repository.memory.ts"
import {
  ThreadsService,
  makeThreadsService,
} from "../service/threads.service.ts"
import type { Thread } from "../schema/threads.schema.ts"

export const ThreadsMemory = (seed: ReadonlyArray<Thread> = []) =>
  Layer.effect(ThreadsService)(makeThreadsService).pipe(
    Layer.provide(
      Layer.effect(ThreadsRepository)(makeMemoryThreadsRepository(seed))
    ),
    Layer.provide(terminalMemoryLayer())
  )
