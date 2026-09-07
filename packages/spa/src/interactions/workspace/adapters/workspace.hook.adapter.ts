import { IconRepeat } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { fetchClient } from "@/lib/api/client";
import { useRegisterCommands } from "@/interactions/search/adapters/search.store";
import type { Command } from "@/interactions/search/interfaces/search.interfaces";
import {
  createWorkspaceFunctions,
  repoCommands,
} from "../functions/workspace.functions";
import type { WorkspaceInfo } from "@reviewer/core/workspace";

/** The query key `useWorkspace` reads, so a selection can seed it directly. */
const WORKSPACE_KEY = ["get", "/api/workspace"];
/** The query key `useRepo` reads — the repository identity everything names. */
const REPO_KEY = ["get", "/api/repo"];

/** Wires the real selection endpoints, query cache and toasts into the logic. */
export function useWorkspaceActions() {
  const queryClient = useQueryClient();

  return useMemo(
    () =>
      createWorkspaceFunctions({
        data: {},
        sideEffects: {
          setProject: async (path) => {
            const { data, error } = await fetchClient.POST("/api/workspace", {
              body: { path },
            });
            if (error !== undefined) throw error;
            return data;
          },
          setRepo: async (path) => {
            const { data, error } = await fetchClient.POST(
              "/api/workspace/repo",
              { body: { path } }
            );
            if (error !== undefined) throw error;
            return data;
          },
          cacheWorkspace: (info) =>
            queryClient.setQueryData(WORKSPACE_KEY, info),
          refreshRepo: async () => {
            await queryClient.refetchQueries({ queryKey: REPO_KEY });
          },
          // A frame, not a microtask: React commits its render before the
          // browser paints, so by the next frame the views have re-read the
          // repository the cache now holds.
          settle: () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve())
            ),
          invalidateAll: async () => {
            await queryClient.invalidateQueries();
          },
          notifyError: (text) => toast.error(text),
        },
      }),
    [queryClient]
  );
}

/**
 * Registers "Switch to <root>" in the command palette for as long as a
 * multi-root project is open, so the roots are reachable by typing.
 *
 * `onLeave` lets the shell drop whatever it holds against the root being left
 * (its open file, the branch its history follows) before the switch goes out,
 * so nothing refetches against a ref the arriving root has never heard of.
 */
export function useRepoCommands(
  workspace: WorkspaceInfo | undefined,
  onLeave?: () => void
): void {
  const actions = useWorkspaceActions();
  const commands = useMemo<ReadonlyArray<Command>>(
    () =>
      repoCommands(workspace).map((command) => ({
        id: command.id,
        label: command.label,
        group: "Project",
        icon: IconRepeat,
        keywords: command.keywords,
        run: () => {
          onLeave?.();
          void actions.openRepo(command.path);
        },
      })),
    [workspace, actions, onLeave]
  );
  useRegisterCommands("workspace-repos", commands);
}
