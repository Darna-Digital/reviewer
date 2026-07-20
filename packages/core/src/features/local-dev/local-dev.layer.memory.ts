import * as Layer from "effect/Layer"
import { DevCommandsRepository } from "./local-dev.repository.ts"
import { makeMemoryDevCommandsRepository } from "./local-dev.repository.memory.ts"
import { LocalDevService, make } from "./local-dev.service.ts"
import type { DevCommand } from "./local-dev.schema.ts"

export const LocalDevMemory = (seed: ReadonlyArray<DevCommand> = []) =>
  Layer.effect(LocalDevService)(make).pipe(
    Layer.provide(
      Layer.effect(DevCommandsRepository)(makeMemoryDevCommandsRepository(seed))
    )
  )
