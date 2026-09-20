import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { fetchClient } from "@/lib/api/client";
import { createWorkspaceFunctions } from "../functions/workspace.functions";

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
