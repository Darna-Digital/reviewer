import * as Layer from "effect/Layer"
import {
  DevCommandsRepository,
  LocalDevService,
  make,
} from "@byconvo/core/local-dev"
import { makeFileDevCommandsRepository } from "../repository/local-dev.repository.file.ts"

export const LocalDevLive = Layer.effect(LocalDevService)(make).pipe(
  Layer.provide(
    Layer.effect(DevCommandsRepository)(makeFileDevCommandsRepository)
  )
)
