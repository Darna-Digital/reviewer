import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import { BranchTargetsService } from "@reviewer/core/branch-targets";
import type {
  DiffFileTarget,
  LogQuery,
  SearchQuery,
} from "@reviewer/core/repo";
import { RepoService } from "@reviewer/core/repo";

const ok = { ok: true } as const;
const MAX_SEARCH_MATCHES = 2000;
const trimmed = (value: string | undefined): string | null =>
  value !== undefined && value.trim().length > 0 ? value.trim() : null;

export const RepoHandler = HttpApiBuilder.group(Api, "repo", (handlers) =>
  handlers
    .handle("info", () => Effect.flatMap(RepoService, (s) => s.info))
    .handle("identity", () => Effect.flatMap(RepoService, (s) => s.identity))
    .handle("files", () => Effect.flatMap(RepoService, (s) => s.files))
    .handle("status", () => Effect.flatMap(RepoService, (s) => s.status))
    .handle("branches", () => Effect.flatMap(RepoService, (s) => s.branches))
    .handle("remoteBranches", () =>
      Effect.flatMap(RepoService, (s) => s.remoteBranches)
    )
    .handle("log", ({ query }) => {
      const q: LogQuery = {
        ref: query.ref ?? "HEAD",
        limit: Math.min(Number(query.limit ?? 150) || 150, 10_000),
        skip: Math.max(0, Number(query.skip ?? 0) || 0),
        author: trimmed(query.author),
        grep: trimmed(query.grep),
        regex: query.regex === "1",
        caseSensitive: query.case === "1",
        after: trimmed(query.after),
        before: trimmed(query.before),
        path: trimmed(query.path),
        follow: query.follow === "1",
      };
      return Effect.flatMap(RepoService, (s) => s.log(q));
    })
    .handle("search", ({ query }) => {
      const q: SearchQuery = {
        query: query.q.trim(),
        caseSensitive: query.case === "1",
        wholeWord: query.word === "1",
        regex: query.regex === "1",
        limit: Math.min(Number(query.limit ?? 200) || 200, MAX_SEARCH_MATCHES),
      };
      return Effect.flatMap(RepoService, (s) => s.search(q));
    })
    .handle("commitDetail", ({ params }) =>
      Effect.flatMap(RepoService, (s) => s.commitDetail(params.sha))
    )
    .handle("diff", ({ query }) =>
      Effect.flatMap(RepoService, (s) => {
        if (query.commit !== undefined) return s.commitDiff(query.commit);
        if (query.target !== undefined) return s.targetDiff(query.target);
        if (query.base !== undefined && query.head !== undefined) {
          return s.rangeDiff(query.base, query.head);
        }
        return s.worktreeDiff;
      })
    )
    .handle("diffFile", ({ query }) =>
      Effect.flatMap(RepoService, (s) => {
        const target: DiffFileTarget =
          query.commit !== undefined
            ? { kind: "commit", sha: query.commit }
            : query.target !== undefined
              ? { kind: "branch", target: query.target }
              : query.base !== undefined && query.head !== undefined
                ? { kind: "range", base: query.base, head: query.head }
                : { kind: "worktree" };
        return s.diffFileContents(target, query.path, query.prevPath ?? null);
      })
    )
    /**
     * Only the branches that are still there. A branch can be deleted by the
     * command line or by another window, neither of which comes past here, so
     * a target is reported against what git says exists rather than against
     * what was recorded whenever it was last written.
     */
    .handle("branchTargets", () =>
      Effect.gen(function* () {
        const targets = yield* Effect.flatMap(
          BranchTargetsService,
          (s) => s.list
        );
        const branches = yield* Effect.flatMap(RepoService, (s) => s.branches);
        const live = new Set(branches.map((branch) => branch.name));
        return targets.filter((entry) => live.has(entry.branch));
      })
    )
    .handle("setBranchTarget", ({ payload }) =>
      Effect.flatMap(BranchTargetsService, (s) =>
        s.set(payload.branch, payload.target)
      )
    )
    .handle("checkout", ({ payload }) =>
      Effect.flatMap(RepoService, (s) => s.checkout(payload.branch)).pipe(
        Effect.as(ok)
      )
    )
    .handle("checkoutPull", ({ payload }) =>
      Effect.flatMap(RepoService, (s) =>
        s.checkoutPull(payload.number, payload.branch)
      ).pipe(Effect.map((branch) => ({ branch })))
    )
    .handle("commit", ({ payload }) =>
      Effect.flatMap(RepoService, (s) =>
        s.commit(payload.message, payload.paths ?? [])
      ).pipe(Effect.map((sha) => ({ sha })))
    )
    .handle("discard", ({ payload }) =>
      Effect.flatMap(RepoService, (s) => s.discard(payload.paths)).pipe(
        Effect.as(ok)
      )
    )
    .handle("discardHunk", ({ payload }) =>
      Effect.flatMap(RepoService, (s) =>
        s.discardHunk(payload.path, payload.hunkIndex)
      ).pipe(Effect.as(ok))
    )
    .handle("push", () =>
      Effect.flatMap(RepoService, (s) => s.push).pipe(
        Effect.map((output) => ({ output }))
      )
    )
    .handle("pull", () =>
      Effect.flatMap(RepoService, (s) => s.pull).pipe(
        Effect.map((output) => ({ output }))
      )
    )
    .handle("fetch", () =>
      Effect.flatMap(RepoService, (s) => s.fetch).pipe(
        Effect.map((output) => ({ output }))
      )
    )
    .handle("merge", ({ payload }) =>
      Effect.flatMap(RepoService, (s) => s.merge(payload.branch)).pipe(
        Effect.map((output) => ({ output }))
      )
    )
    .handle("rebase", ({ payload }) =>
      Effect.flatMap(RepoService, (s) => s.rebase(payload.onto)).pipe(
        Effect.map((output) => ({ output }))
      )
    )
    .handle("mergeState", () =>
      Effect.flatMap(RepoService, (s) => s.mergeState)
    )
    .handle("conflict", ({ query }) =>
      Effect.flatMap(RepoService, (s) => s.conflictBlobs(query.path))
    )
    .handle("resolveConflict", ({ payload }) =>
      Effect.flatMap(RepoService, (s) =>
        s.resolveConflict(payload.path, payload.resolution)
      ).pipe(Effect.as(ok))
    )
    .handle("abortMerge", () =>
      Effect.flatMap(RepoService, (s) => s.abortMerge).pipe(
        Effect.map((output) => ({ output }))
      )
    )
    .handle("continueMerge", () =>
      Effect.flatMap(RepoService, (s) => s.continueMerge).pipe(
        Effect.map((output) => ({ output }))
      )
    )
    .handle("createBranch", ({ payload }) =>
      Effect.flatMap(RepoService, (s) =>
        s.createBranch(payload.name, payload.startPoint ?? null)
      ).pipe(Effect.as(ok))
    )
    .handle("renameBranch", ({ payload }) =>
      Effect.flatMap(RepoService, (s) =>
        s.renameBranch(payload.from, payload.to)
      ).pipe(Effect.as(ok))
    )
    /** A branch that is gone is aimed nowhere, so its target goes with it. */
    .handle("deleteBranch", ({ payload }) =>
      Effect.gen(function* () {
        yield* Effect.flatMap(RepoService, (s) =>
          s.deleteBranch(payload.name, payload.force ?? false)
        );
        yield* Effect.flatMap(BranchTargetsService, (s) =>
          s.remove(payload.name)
        );
        return ok;
      })
    )
);
