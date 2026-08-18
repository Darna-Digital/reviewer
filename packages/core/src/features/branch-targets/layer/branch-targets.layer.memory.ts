import * as Layer from "effect/Layer";
import { BranchTargetsRepository } from "../repository/branch-targets.repository.ts";
import { makeMemoryBranchTargetsRepository } from "../repository/branch-targets.repository.memory.ts";
import {
  BranchTargetsService,
  makeBranchTargetsService,
} from "../service/branch-targets.service.ts";
import type { BranchTarget } from "../../repo/schema/repo.schema.ts";

export const BranchTargetsMemory = (seed: ReadonlyArray<BranchTarget> = []) =>
  Layer.effect(BranchTargetsService)(makeBranchTargetsService).pipe(
    Layer.provide(
      Layer.effect(BranchTargetsRepository)(
        makeMemoryBranchTargetsRepository(seed)
      )
    )
  );
