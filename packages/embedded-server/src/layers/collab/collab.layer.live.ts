import * as Layer from "effect/Layer";
import {
  CollabRepository,
  CollabService,
  makeCollabService,
} from "@byconvo/core/collab";
import { makeSqliteCollabRepository } from "./collab.repository.sqlite.ts";

export const CollabLive = Layer.effect(CollabService)(makeCollabService).pipe(
  Layer.provide(Layer.effect(CollabRepository)(makeSqliteCollabRepository))
);
