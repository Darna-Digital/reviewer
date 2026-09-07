import * as Layer from "effect/Layer";
import {
  BranchTargetsRepository,
  BranchTargetsService,
  makeBranchTargetsService,
} from "@reviewer/core/branch-targets";
import { makeSqliteBranchTargetsRepository } from "./branch-targets.repository.sqlite.ts";

export const BranchTargetsLive = Layer.effect(BranchTargetsService)(
  makeBranchTargetsService
).pipe(
  Layer.provide(
    Layer.effect(BranchTargetsRepository)(makeSqliteBranchTargetsRepository)
  )
);
