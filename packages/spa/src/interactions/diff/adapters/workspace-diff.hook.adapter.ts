import { useCallback, useMemo } from "react";
import type { ReviewComment } from "@reviewer/core/comments";
import type { WorkspaceRoot } from "@reviewer/core/workspace";
import type { DiffFileLocation } from "@/interactions/diff/components/diff-pane";
import { useWorkspaceChanges } from "@/lib/queries";
import {
  locateWorkspaceFile,
  qualifiedName,
  workspacePatch,
  workspaceRootKeys,
} from "../functions/workspace-diff.functions";

export interface WorkspaceDiff {
  /** Every root's patch under its key, as one text; null while off. */
  readonly text: string | null;
  readonly pending: boolean;
  readonly error: unknown;
  /** Every root's comments, their files named the way the diff names them. */
  readonly comments: ReadonlyArray<ReviewComment>;
  /** The repository behind a name — undefined for the page's own. */
  readonly locate: (name: string) => DiffFileLocation;
  /** The name a root's file goes by in the diff; null is the page's own. */
  readonly nameOf: (root: string | null, path: string) => string;
}

const NO_ROOTS: ReadonlyArray<WorkspaceRoot> = [];
const NO_COMMENTS: ReadonlyArray<ReviewComment> = [];

/**
 * Your own changes in every repository of the workspace, as the one diff the
 * pane reads — see `workspace-diff.functions`. Off, it asks nothing and every
 * name is the page's own path.
 */
export function useWorkspaceDiff(
  roots: ReadonlyArray<WorkspaceRoot> | undefined,
  ownRoot: string | null,
  enabled: boolean
): WorkspaceDiff {
  const shown = enabled ? (roots ?? NO_ROOTS) : NO_ROOTS;
  const keys = useMemo(() => workspaceRootKeys(shown), [shown]);
  const rootsByKey = useMemo(
    () => new Map([...keys].map(([root, key]) => [key, root])),
    [keys]
  );
  const scopes = useMemo(
    () => shown.map((root) => (root.path === ownRoot ? undefined : root.path)),
    [shown, ownRoot]
  );
  const { diffs, comments } = useWorkspaceChanges(scopes, enabled);

  const text = useMemo(
    () =>
      enabled
        ? workspacePatch(
            shown.map((root, index) => ({
              key: keys.get(root.path) ?? root.name,
              text: diffs.texts[index] ?? "",
            }))
          )
        : null,
    [enabled, shown, keys, diffs.texts]
  );

  const qualifiedComments = useMemo(
    () =>
      enabled
        ? shown.flatMap((root, index) => {
            const key = keys.get(root.path) ?? root.name;
            return (comments[index] ?? NO_COMMENTS).map((comment) => ({
              ...comment,
              filePath: qualifiedName(key, comment.filePath),
            }));
          })
        : NO_COMMENTS,
    [enabled, shown, keys, comments]
  );

  const locate = useCallback(
    (name: string): DiffFileLocation => {
      const file = enabled ? locateWorkspaceFile(name, rootsByKey) : null;
      if (file === null) return { repo: undefined, path: name };
      return {
        repo: file.root === ownRoot ? undefined : file.root,
        path: file.path,
      };
    },
    [enabled, rootsByKey, ownRoot]
  );

  const nameOf = useCallback(
    (root: string | null, path: string) => {
      const key = enabled ? keys.get(root ?? ownRoot ?? "") : undefined;
      return key === undefined ? path : qualifiedName(key, path);
    },
    [enabled, keys, ownRoot]
  );

  return {
    text,
    pending: enabled && diffs.pending,
    error: enabled ? diffs.error : null,
    comments: qualifiedComments,
    locate,
    nameOf,
  };
}
