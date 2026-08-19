import * as Effect from "effect/Effect";
import type { BranchTarget } from "../../repo/schema/repo.schema.ts";
import type { BranchTargetsRepo } from "./branch-targets.repository.ts";

export const makeMemoryBranchTargetsRepository = (
  seed: ReadonlyArray<BranchTarget> = []
) =>
  Effect.sync(() => {
    const targets = new Map(seed.map((entry) => [entry.branch, entry.target]));
    const repo: BranchTargetsRepo = {
      list: Effect.sync(() =>
        [...targets].map(([branch, target]) => ({ branch, target }))
      ),
      get: (branch) =>
        Effect.sync(() => {
          const target = targets.get(branch);
          return target === undefined ? null : { branch, target };
        }),
      set: (branch, target) =>
        Effect.sync(() => {
          targets.set(branch, target);
          return { branch, target };
        }),
      remove: (branch) =>
        Effect.sync(() => {
          targets.delete(branch);
        }),
    };
    return repo;
  });
