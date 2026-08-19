import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type { BranchTarget } from "../../repo/schema/repo.schema.ts";

export type BranchTargetsFailure = NoRepoSelected | NotFound | StorageError;

/**
 * Where each branch's work is aimed, kept for the repository as a whole rather
 * than for one of its worktrees — a branch read from its own worktree and the
 * same branch read from the main one have to give the same answer.
 */
export interface BranchTargetsRepo {
  readonly list: Effect.Effect<
    ReadonlyArray<BranchTarget>,
    BranchTargetsFailure
  >;
  /** Null when the branch has never been aimed at anything. */
  readonly get: (
    branch: string
  ) => Effect.Effect<BranchTarget | null, BranchTargetsFailure>;
  readonly set: (
    branch: string,
    target: string
  ) => Effect.Effect<BranchTarget, BranchTargetsFailure>;
  readonly remove: (
    branch: string
  ) => Effect.Effect<void, BranchTargetsFailure>;
}

export class BranchTargetsRepository extends Context.Service<
  BranchTargetsRepository,
  BranchTargetsRepo
>()("BranchTargetsRepository") {}
