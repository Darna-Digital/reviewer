import * as Layer from "effect/Layer"
import { memoryLayer as terminalMemoryLayer } from "../../ports/terminal-exec.ts"
import { ThreadsRepository } from "./threads.repository.ts"
import { makeMemoryThreadsRepository } from "./threads.repository.memory.ts"
import { ThreadsService, make } from "./threads.service.ts"
import type { Thread } from "./threads.schema.ts"

export const ThreadsMemory = (seed: ReadonlyArray<Thread> = []) =>
  Layer.effect(ThreadsService)(make).pipe(
    Layer.provide(
      Layer.effect(ThreadsRepository)(makeMemoryThreadsRepository(seed))
    ),
    Layer.provide(terminalMemoryLayer())
  )
