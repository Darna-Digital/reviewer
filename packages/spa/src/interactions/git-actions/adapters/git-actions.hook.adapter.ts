import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { api, fetchClient } from "@/lib/api/client";
import { useWorkspace } from "@/lib/queries";
import { isMultiRepo } from "@reviewer/core/workspace";
import type { CommitDraft } from "@reviewer/core/git-message";
import type { CommitAgent } from "@/lib/ui-prefs";
import { createGitActionsFunctions } from "../functions/git-actions.functions";
import {
  errorText,
  type NoticeKind,
} from "../interfaces/git-actions.interfaces";

const unwrap = async <T>(
  p: Promise<{ data?: T; error?: unknown }>
): Promise<T> => {
  const { data, error } = await p;
  if (error) {
    const e = error as { message?: string; reason?: string; stderr?: string };
    const stderr = e.stderr?.trim();
    throw new Error(
      e.message ??
        e.reason ??
        (stderr !== undefined && stderr.length > 0 ? stderr : undefined) ??
        "request failed"
    );
  }
  return data as T;
};

/** A draft's cache slot — one per project, the way the server keeps it. */
const draftKey = api.queryOptions("get", "/api/git-message/draft", {}).queryKey;

/**
 * All imperative git actions, wired to the typed API, sonner toasts and
 * TanStack Query invalidation. Components call these; the pure flow logic
 * (commit→push messaging, op notices) lives in the functions layer.
 */
export function useGitActions() {
  const queryClient = useQueryClient();
  // Committing spans the roots only when there is more than one to span; a
  // single-root project keeps the plain commit, which says the same thing
  // without a per-root breakdown.
  const workspace = useWorkspace();
  const acrossRoots = isMultiRepo({ repos: workspace.data?.repos ?? [] });

  const notify = useCallback(
    (kind: NoticeKind, text: string) =>
      kind === "ok" ? toast.success(text) : toast.error(text),
    []
  );
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);

  const fns = useMemo(
    () =>
      createGitActionsFunctions({
        data: {},
        sideEffects: {
          commitAcrossRepos: acrossRoots
            ? async (message, paths) => {
                const result = await unwrap(
                  fetchClient.POST("/api/project/commit", {
                    body: { message, paths: [...paths] },
                  })
                );
                return result.results;
              }
            : null,
          commit: (message, paths) =>
            unwrap(
              fetchClient.POST("/api/commit", {
                body: { message, paths: [...paths] },
              })
            ),
          push: () => unwrap(fetchClient.POST("/api/push", {})),
          notify,
          refresh,
        },
      }),
    [notify, refresh, acrossRoots]
  );

  const post =
    <T>(p: Promise<{ data?: T; error?: unknown }>) =>
    () =>
      unwrap(p);

  return {
    commitChanges: fns.commitChanges,

    /**
     * Set a locally installed agent CLI (claude/opencode/codex) drafting a
     * commit message for the selected paths. The CLI runs on the server and
     * outlives the request that started it, so this answers with the run rather
     * than the message; the message is read off `useCommitDraft` when it lands,
     * by whichever page is around to read it.
     */
    startCommitMessage: async (
      paths: ReadonlyArray<string>,
      agent: CommitAgent
    ): Promise<void> => {
      try {
        const draft = await unwrap(
          fetchClient.POST("/api/git-message/generate", {
            body: { paths: [...paths], agent },
          })
        );
        queryClient.setQueryData<CommitDraft>(draftKey, draft);
      } catch (cause) {
        notify("err", errorText(cause));
      }
    },

    /**
     * Drop the finished draft now that the composer holds it — otherwise every
     * later mount would put the same message back over whatever was typed
     * since. A clear that fails is not worth a toast: the message is in hand.
     */
    clearCommitDraft: async (): Promise<void> => {
      const { data } = await fetchClient.POST(
        "/api/git-message/draft/clear",
        {}
      );
      if (data !== undefined)
        queryClient.setQueryData<CommitDraft>(draftKey, data);
    },

    /**
     * Discard the working-tree changes for the given paths, reverting them to HEAD
     * (modifications and deletions are restored; new files are removed). This is
     * irreversible — callers should confirm before invoking.
     *
     * Paths spanning several roots are named from the project, so they revert
     * through the project's endpoint, which splits them back into the roots
     * that own them — the same way committing them does.
     */
    discard: (paths: ReadonlyArray<string>) =>
      fns.runOp(
        paths.length === 1
          ? `Discarded changes in ${paths[0]}`
          : `Discarded changes in ${paths.length} files`,
        () =>
          acrossRoots
            ? unwrap(
                fetchClient.POST("/api/project/discard", {
                  body: { paths: [...paths] },
                })
              )
            : unwrap(
                fetchClient.POST("/api/discard", {
                  body: { paths: [...paths] },
                })
              )
      ),

    /**
     * Discard a single hunk of a file's working-tree diff, reverting just that
     * change. `hunkIndex` is zero-based in the order the diff renders its hunks.
     * Irreversible — callers should confirm before invoking.
     */
    discardHunk: (path: string, hunkIndex: number) =>
      fns.runOp(`Discarded a change in ${path}`, () =>
        acrossRoots
          ? unwrap(
              fetchClient.POST("/api/project/discard-hunk", {
                body: { path, hunkIndex },
              })
            )
          : unwrap(
              fetchClient.POST("/api/discard-hunk", {
                body: { path, hunkIndex },
              })
            )
      ),

    checkout: (branch: string) =>
      fns.runOp(`Checked out ${branch}`, () =>
        unwrap(fetchClient.POST("/api/checkout", { body: { branch } }))
      ),

    /**
     * Bring a pull request's head onto a local branch and switch to it. The
     * branch name is decided here rather than by the server — see
     * `localBranchForPull` — because only the app knows a fork's branch must
     * not be allowed to land on ours of the same name.
     */
    checkoutPull: (pullNumber: number, branch: string) =>
      fns.runOp(`Checked out ${branch}`, () =>
        unwrap(
          fetchClient.POST("/api/checkout-pull", {
            body: { number: pullNumber, branch },
          })
        )
      ),

    /**
     * Land a pull request on its base branch. Outward-facing and not ours to
     * undo, so the caller confirms first — this only carries it out, and
     * reports GitHub's own sentence about what happened.
     */
    mergePull: (pullNumber: number, method: "merge" | "squash" | "rebase") =>
      fns.runOp(`Merged #${pullNumber}`, async () => {
        const { message } = await unwrap(
          fetchClient.POST("/api/github/pulls/{number}/merge", {
            params: { path: { number: String(pullNumber) } },
            body: { method },
          })
        );
        return { output: message };
      }),

    /**
     * Close a pull request without merging it. Nothing local changes — the
     * branch and its commits stay where they are — but the pull request is
     * gone from everyone else's list too, so the caller confirms first.
     */
    closePull: (pullNumber: number) =>
      fns.runOp(`Closed #${pullNumber}`, async () => {
        const { message } = await unwrap(
          fetchClient.POST("/api/github/pulls/{number}/close", {
            params: { path: { number: String(pullNumber) } },
          })
        );
        return { output: message };
      }),

    checkoutAndUpdate: async (branch: string) => {
      try {
        await unwrap(fetchClient.POST("/api/checkout", { body: { branch } }));
        const { output } = await unwrap(fetchClient.POST("/api/pull", {}));
        notify(
          "ok",
          output.length > 0 ? output : `Checked out and updated ${branch}`
        );
        refresh();
      } catch (cause) {
        notify("err", errorText(cause));
      }
    },

    createBranch: (name: string, startPoint: string | null) =>
      fns.runOp(`Created branch ${name}`, () =>
        unwrap(
          fetchClient.POST("/api/branch", {
            body: { name, startPoint: startPoint ?? undefined },
          })
        )
      ),

    renameBranch: (from: string, to: string) =>
      fns.runOp(`Renamed ${from} → ${to}`, () =>
        unwrap(fetchClient.POST("/api/branch/rename", { body: { from, to } }))
      ),

    deleteBranch: (name: string) =>
      fns.runOp(`Deleted ${name}`, () =>
        unwrap(fetchClient.POST("/api/branch/delete", { body: { name } }))
      ),

    merge: (branch: string) =>
      fns.runOp(
        `Merged ${branch}`,
        post(fetchClient.POST("/api/merge", { body: { branch } }))
      ),

    rebase: (onto: string) =>
      fns.runOp(
        `Rebased onto ${onto}`,
        post(fetchClient.POST("/api/rebase", { body: { onto } }))
      ),

    fetch: () => fns.runOp("Fetched", post(fetchClient.POST("/api/fetch", {}))),
    push: () => fns.runOp("Pushed", post(fetchClient.POST("/api/push", {}))),
    pull: () => fns.runOp("Pulled", post(fetchClient.POST("/api/pull", {}))),

    // --- conflicts -----------------------------------------------------------
    /** Resolve a conflicted file by taking one whole side. */
    resolveConflict: (path: string, resolution: "ours" | "theirs") =>
      fns.runOp(`Resolved ${path}`, () =>
        unwrap(
          fetchClient.POST("/api/conflicts/resolve", {
            body: { path, resolution },
          })
        )
      ),

    /** Write the user-merged content, then stage it as resolved. */
    resolveConflictWithContent: async (path: string, contents: string) => {
      try {
        await unwrap(
          fetchClient.PUT("/api/file", { body: { path, contents } })
        );
        await unwrap(
          fetchClient.POST("/api/conflicts/resolve", {
            body: { path, resolution: "content" },
          })
        );
        notify("ok", `Resolved ${path}`);
        refresh();
      } catch (cause) {
        notify("err", errorText(cause));
      }
    },

    abortMerge: () =>
      fns.runOp("Aborted", post(fetchClient.POST("/api/merge/abort", {}))),
    continueMerge: () =>
      fns.runOp("Continued", post(fetchClient.POST("/api/merge/continue", {}))),

    refresh,
  };
}
