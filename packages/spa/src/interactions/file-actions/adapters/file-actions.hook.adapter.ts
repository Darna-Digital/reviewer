import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchClient } from "@/lib/api/client";
import { errorReason } from "@/lib/errors";
import { createFileActionsFunctions } from "../functions/file-actions.functions";
import type { PathKind } from "../interfaces/file-actions.interfaces";

const create = async (path: string, kind: PathKind) => {
  const { error } = await fetchClient.POST("/api/file/create", {
    body: { path, kind },
  });
  if (error) throw new Error(errorReason(error, `Could not create ${path}`));
};

/**
 * Creating files and folders in the selected repository, wired to the typed
 * API, sonner toasts and TanStack Query invalidation. New files open in the
 * viewer; new folders are held here until they hold something git can list.
 */
export function useFileActions(openFile: (path: string) => void) {
  const queryClient = useQueryClient();
  const [pendingFolders, setPendingFolders] = useState<ReadonlyArray<string>>(
    []
  );
  // Kept in a ref so the tree's path list is only recomputed when a folder is
  // actually created, not on every render that redefines `openFile`.
  const openFileRef = useRef(openFile);
  openFileRef.current = openFile;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries();
  }, [queryClient]);
  const rememberFolder = useCallback(
    (path: string) =>
      setPendingFolders((existing) =>
        existing.includes(path) ? existing : [...existing, path]
      ),
    []
  );

  return useMemo(
    () =>
      createFileActionsFunctions({
        data: { pendingFolders },
        sideEffects: {
          create,
          rememberFolder,
          openFile: (path) => openFileRef.current(path),
          notifyError: (text) => toast.error(text),
          refresh,
        },
      }),
    [pendingFolders, refresh, rememberFolder]
  );
}
