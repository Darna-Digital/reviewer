import * as Layer from "effect/Layer";
import { CollabRepository } from "../repository/collab.repository.ts";
import {
  makeMemoryCollabRepository,
  type MemoryCollabSeed,
} from "../repository/collab.repository.memory.ts";
import { CollabService, makeCollabService } from "../service/collab.service.ts";

export const CollabMemory = (seed: MemoryCollabSeed = {}) =>
  Layer.effect(CollabService)(makeCollabService).pipe(
    Layer.provide(
      Layer.effect(CollabRepository)(makeMemoryCollabRepository(seed))
    )
  );
