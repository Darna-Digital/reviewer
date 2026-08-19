/**
 * The two things you do with a worktree: cut one for a task, and retire one.
 *
 * Cutting does not take you there, which is the whole point. A task is started,
 * read and merged from where you are standing; the worktree is where its agent
 * works, not a place you visit. Going there is a separate decision, made from
 * the review when you want to see the change running.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { fetchClient } from "@/lib/api/client";
import { useWorkspaceActions } from "@/interactions/workspace/adapters/workspace.hook.adapter";

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

export function useWorktreeActions() {
  const queryClient = useQueryClient();
  const workspace = useWorkspaceActions();

  const focus = useCallback(
    async (path: string, current: string | null) => {
      await workspace.followRepo(path, current);
    },
    [workspace]
  );

  return useMemo(
    () => ({
      focus,

      /**
       * Cut a worktree for `branch`, aimed at `target`, and stay where you are.
       * Nothing is announced: the caller is starting a session in it, and the
       * session arriving is the announcement.
       */
      cut: async (branch: string, target: string | null) => {
        const { data, error } = await fetchClient.POST("/api/worktrees", {
          body: { branch, ...(target === null ? {} : { target }) },
        });
        if (error !== undefined || data === undefined) {
          toast.error(failureText(error));
          return null;
        }
        await queryClient.invalidateQueries();
        return data;
      },

      retire: async (path: string, force = false) => {
        const { error } = await fetchClient.POST("/api/worktrees/remove", {
          body: { path, force },
        });
        if (error !== undefined) {
          toast.error(failureText(error));
          return false;
        }
        toast.success("Worktree retired");
        await queryClient.invalidateQueries();
        return true;
      },

      /** Aim a branch's work somewhere, so its diff has something to read against. */
      aim: async (branch: string, target: string) => {
        const { error } = await fetchClient.POST("/api/branch-targets", {
          body: { branch, target },
        });
        if (error !== undefined) {
          toast.error(failureText(error));
          return false;
        }
        await queryClient.invalidateQueries({
          queryKey: ["get", "/api/branch-targets"],
        });
        return true;
      },
    }),
    [focus, queryClient]
  );
}
