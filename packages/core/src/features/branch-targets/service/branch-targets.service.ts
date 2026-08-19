import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
  BranchTargetsRepository,
  type BranchTargetsRepo,
} from "../repository/branch-targets.repository.ts";

export interface BranchTargetsServiceShape extends BranchTargetsRepo {}
export class BranchTargetsService extends Context.Service<
  BranchTargetsService,
  BranchTargetsServiceShape
>()("BranchTargetsService") {}
export const makeBranchTargetsService = Effect.gen(function* () {
  const repo = yield* BranchTargetsRepository;
  return BranchTargetsService.of(repo);
});
