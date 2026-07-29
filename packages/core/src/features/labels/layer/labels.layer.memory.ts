import * as Layer from "effect/Layer"
import { LabelsRepository } from "../repository/labels.repository.ts"
import { makeMemoryLabelsRepository } from "../repository/labels.repository.memory.ts"
import { LabelsService, makeLabelsService } from "../service/labels.service.ts"
import type { Label } from "../schema/labels.schema.ts"

export const LabelsMemory = (seed: ReadonlyArray<Label> = []) =>
  Layer.effect(LabelsService)(makeLabelsService).pipe(
    Layer.provide(
      Layer.effect(LabelsRepository)(makeMemoryLabelsRepository(seed))
    )
  )
