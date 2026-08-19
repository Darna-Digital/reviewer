/**
 * The two things you do to a task from the review, both of which are merges:
 * bringing the base into it, and landing it on the base.
 *
 * Neither takes you anywhere. That is the point of the surface — the server
 * does the work in whichever worktree git insists on, and the app stays where
 * it was.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchClient } from "@/lib/api/client";

const failureText = (error: unknown): string => {
  const detail = error as {
    message?: string;
    reason?: string;
    stderr?: string;
  };
  const stderr = detail.stderr?.trim();
  return (
    detail.message ??
    detail.reason ??
    (stderr !== undefined && stderr.length > 0 ? stderr : undefined) ??
    "request failed"
  );
};

export function useTaskActions() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  return useMemo(
    () => ({
      busy,

      /**
       * Land the task and let its worktree go with it. A refusal comes back as
       * an outcome rather than an error — a branch behind its base is something
       * to be told, not a failure.
       */
      merge: async (branch: string, base: string | null): Promise<boolean> => {
        setBusy(branch);
        try {
          const { data, error } = await fetchClient.POST(
            "/api/local-tasks/merge",
            { body: { branch, ...(base === null ? {} : { base }) } }
          );
          if (error !== undefined || data === undefined) {
            toast.error(failureText(error));
            return false;
          }
          if (!data.merged) {
            toast.error(data.reason ?? "Could not merge.");
            return false;
          }
          toast.success(
            base === null
              ? `Merged ${branch} and retired its worktree`
              : `Merged ${branch} into ${base} and retired its worktree`
          );
          await queryClient.invalidateQueries();
          return true;
        } finally {
          setBusy(null);
        }
      },

      /**
       * Commit in the worktree, from the review of it. The same panel, the same
       * act — somewhere else.
       */
      commit: async (
        branch: string,
        message: string,
        paths: ReadonlyArray<string>
      ): Promise<boolean> => {
        setBusy(branch);
        try {
          const { data, error } = await fetchClient.POST(
            "/api/local-tasks/commit",
            { body: { branch, message, paths: [...paths] } }
          );
          if (error !== undefined || data === undefined) {
            toast.error(failureText(error));
            return false;
          }
          if (!data.merged) {
            toast.error(data.reason ?? "Could not commit.");
            return false;
          }
          await queryClient.invalidateQueries();
          return true;
        } finally {
          setBusy(null);
        }
      },

      /**
       * Bring another branch into the worktree, in the worktree itself. `base`
       * null means whatever it is aimed at.
       */
      update: async (branch: string, base: string | null): Promise<boolean> => {
        setBusy(branch);
        try {
          const { error } = await fetchClient.POST("/api/local-tasks/update", {
            body: { branch, ...(base === null ? {} : { base }) },
          });
          if (error !== undefined) {
            toast.error(failureText(error));
            return false;
          }
          toast.success(
            base === null
              ? `Updated ${branch} from its base`
              : `Updated ${branch} from ${base}`
          );
          await queryClient.invalidateQueries();
          return true;
        } finally {
          setBusy(null);
        }
      },

      /**
       * Stop working on it here. The server keeps the branch when it has
       * commits of its own, so the toast says which of the two happened rather
       * than claiming the same thing both times.
       */
      discard: async (
        branch: string,
        keptBranch: boolean
      ): Promise<boolean> => {
        setBusy(branch);
        try {
          const { error } = await fetchClient.POST("/api/local-tasks/discard", {
            body: { branch },
          });
          if (error !== undefined) {
            toast.error(failureText(error));
            return false;
          }
          toast.success(
            keptBranch
              ? `Discarded the worktree — ‘${branch}’ still has your commits`
              : `Discarded ${branch}`
          );
          await queryClient.invalidateQueries();
          return true;
        } finally {
          setBusy(null);
        }
      },
    }),
    [busy, queryClient]
  );
}
