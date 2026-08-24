import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { confirm } from "@/components/ui/alerts";
import { fetchClient } from "@/lib/api/client";
import { errorReason } from "@/lib/errors";
import {
  createFileActionsFunctions,
  EMPTY_HISTORY,
} from "../functions/file-actions.functions";
import type {
  FileHistory,
  FileStepEffects,
  PathKind,
} from "../interfaces/file-actions.interfaces";

const create = async (path: string, kind: PathKind) => {
  const { error } = await fetchClient.POST("/api/file/create", {
    body: { path, kind },
  });
  if (error) throw new Error(errorReason(error, `Could not create ${path}`));
};

const move = async (from: string, to: string) => {
  const { error } = await fetchClient.POST("/api/file/rename", {
    body: { from, to },
  });
  if (error) throw new Error(errorReason(error, `Could not move ${from}`));
};

const copy = async (from: string, to: string) => {
  const { error } = await fetchClient.POST("/api/file/copy", {
    body: { from, to },
  });
  if (error) throw new Error(errorReason(error, `Could not copy ${from}`));
};

const upload = async (path: string, base64: string) => {
  const { error } = await fetchClient.POST("/api/file/upload", {
    body: { path, base64 },
  });
  if (error) throw new Error(errorReason(error, `Could not write ${path}`));
};

const trash = async (path: string) => {
  const { data, error } = await fetchClient.POST("/api/file/trash", {
    body: { path },
  });
  if (error) throw new Error(errorReason(error, `Could not delete ${path}`));
  return data.path;
};

const reveal = async (path: string) => {
  const { error } = await fetchClient.POST("/api/file/reveal", {
    body: { path },
  });
  if (error) throw new Error(errorReason(error, `Could not reveal ${path}`));
};

const steps: FileStepEffects = { create, move, copy, upload, trash };

/**
 * The file tree's operations on the project's own files, wired to the typed
 * API, sonner toasts and TanStack Query invalidation. New files open in the
 * viewer; new folders are held here until they hold something git can list;
 * every change is kept so ⌘Z can take it back.
 */
export function useFileActions(openFile: (path: string) => void) {
  const queryClient = useQueryClient();
  const [pendingFolders, setPendingFolders] = useState<ReadonlyArray<string>>(
    []
  );
  const [history, setHistory] = useState<FileHistory>(EMPTY_HISTORY);
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
        data: { pendingFolders, history },
        sideEffects: {
          ...steps,
          reveal,
          rememberFolder,
          openFile: (path) => openFileRef.current(path),
          record: setHistory,
          notify: (text) => toast(text),
          notifyError: (text) => toast.error(text),
          confirm: (path) =>
            confirm({
              title: `Replace ${path}?`,
              description:
                "The file already in the project moves to the trash, so ⌘Z can put it back.",
              confirmLabel: "Replace",
              destructive: true,
            }),
          refresh,
        },
      }),
    [history, pendingFolders, refresh, rememberFolder]
  );
}
