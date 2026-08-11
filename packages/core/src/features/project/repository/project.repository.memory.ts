import * as Effect from "effect/Effect";
import { mergeCommits } from "../functions/project.functions.ts";
import type {
  ProjectBranches,
  ProjectChanges,
  ProjectFiles,
  ProjectLog,
  RepoBranches,
  RepoChanges,
  RepoFailure,
} from "../schema/project.schema.ts";
import type { CommitInfo } from "../../repo/schema/repo.schema.ts";
import type { RepoEntry } from "../../workspace/schema/workspace.schema.ts";
import type { ProjectRepo } from "./project.repository.ts";

export interface MemoryProjectSeed {
  readonly files?: ReadonlyArray<string>;
  readonly worktreeDiff?: string;
  readonly changes?: ReadonlyArray<RepoChanges>;
  readonly branches?: ReadonlyArray<RepoBranches>;
  /** Each root's own history, newest first — merged on read, as git's is. */
  readonly log?: ReadonlyArray<{
    readonly repo: RepoEntry;
    readonly commits: ReadonlyArray<CommitInfo>;
  }>;
  readonly failed?: ReadonlyArray<RepoFailure>;
}

export const makeMemoryProjectRepository = (seed: MemoryProjectSeed = {}) =>
  Effect.sync((): ProjectRepo => {
    const failed = seed.failed ?? [];
    return {
      files: Effect.succeed({
        paths: seed.files ?? [],
        gitStatus: (seed.changes ?? []).flatMap((entry) =>
          entry.files.map((file) => ({
            ...file,
            path: `${entry.repo.name}/${file.path}`,
          }))
        ),
        failed,
      } satisfies ProjectFiles),
      worktreeDiff: Effect.succeed(seed.worktreeDiff ?? ""),
      changes: Effect.succeed({
        repos: seed.changes ?? [],
        failed,
      } satisfies ProjectChanges),
      branches: Effect.succeed({
        repos: seed.branches ?? [],
        failed,
      } satisfies ProjectBranches),
      log: (query) =>
        Effect.succeed({
          commits: mergeCommits(seed.log ?? []).slice(
            query.skip,
            query.skip + query.limit
          ),
          failed,
        } satisfies ProjectLog),
    };
  });
