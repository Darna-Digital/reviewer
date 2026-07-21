import * as Layer from "effect/Layer"
import {
  DevCommandsRepository,
  LocalDevService,
  makeLocalDevService,
} from "@byconvo/core/local-dev"
import { makeFileDevCommandsRepository } from "./local-dev.repository.file.ts"

export const LocalDevLive = Layer.effect(LocalDevService)(
  makeLocalDevService
).pipe(
  Layer.provide(
    Layer.effect(DevCommandsRepository)(makeFileDevCommandsRepository)
  )
)
