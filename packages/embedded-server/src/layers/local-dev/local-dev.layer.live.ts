import * as Layer from "effect/Layer";
import {
  DevCommandsRepository,
  LocalDevService,
  makeLocalDevService,
} from "@reviewer/core/local-dev";
import { makeSqliteDevCommandsRepository } from "./local-dev.repository.sqlite.ts";

export const LocalDevLive = Layer.effect(LocalDevService)(
  makeLocalDevService
).pipe(
  Layer.provide(
    Layer.effect(DevCommandsRepository)(makeSqliteDevCommandsRepository)
  )
);
