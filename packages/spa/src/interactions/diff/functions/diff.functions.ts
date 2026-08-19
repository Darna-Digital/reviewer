import { diffTargetKey } from "@/lib/api/types";
import {
  fileTypeToStatus,
  type DiffDependencies,
  type DiffFunctions,
  type TreeInputs,
} from "../interfaces/diff.interfaces";

/** Where the file viewer anchors everything it writes. */
const WORKTREE_KEY = diffTargetKey({ kind: "worktree" });

export function createDiffFunctions(d: DiffDependencies): DiffFunctions {
  const isInternalPath: DiffFunctions["isInternalPath"] = (path) =>
    path === d.data.internalDir || path.startsWith(`${d.data.internalDir}/`);

  const deriveTarget: DiffFunctions["deriveTarget"] = (selection) => {
    if (selection.mode === "commit") {
      const target = selection.target ?? null;
      return target === null || target.length === 0
        ? { kind: "worktree" }
        : { kind: "branch", target };
    }
    if (selection.mode === "review") {
      // A local task and a pull request are the same row in the same list, so
      // review mode answers for whichever of the two is selected.
      if (selection.selectedTask != null) {
        // Reading a task against something other than what it lands on is a
        // reading, not a re-aim: the base moves, the key does not, so the
        // comments left on it stay where they were put.
        const against = selection.target ?? null;
        return {
          kind: "task",
          branch: selection.selectedTask.branch,
          base:
            against === null || against.length === 0
              ? selection.selectedTask.base
              : against,
        };
      }
      return selection.selectedPull === null
        ? null
        : { kind: "pull", pull: selection.selectedPull };
    }
    if (selection.browse?.kind === "commit") {
      return {
        kind: "commit",
        sha: selection.browse.sha,
        shortSha: selection.browse.shortSha,
      };
    }
    if (selection.browse?.kind === "range") {
      return {
        kind: "range",
        base: selection.browse.base,
        head: selection.browse.head,
      };
    }
    return null;
  };

  const parseFiles: DiffFunctions["parseFiles"] = (diffText) => {
    if (diffText === null || diffText.trim().length === 0) return [];
    try {
      return d.sideEffects.parsePatch(diffText);
    } catch {
      return [];
    }
  };

  const treePaths: DiffFunctions["treePaths"] = ({
    mode,
    allPaths,
    gitStatus,
    parsedFiles,
    commentedPaths = [],
  }: TreeInputs) => {
    if (mode === "browse")
      return allPaths.filter((path) => !isInternalPath(path));
    if (mode === "commit") {
      const commented = new Set(commentedPaths);
      return allPaths
        .filter((path) => !isInternalPath(path))
        .filter(
          (path) =>
            gitStatus.some((entry) => entry.path === path) ||
            commented.has(path)
        );
    }
    return parsedFiles.map((file) => file.name);
  };

  const treeGitStatus: DiffFunctions["treeGitStatus"] = ({
    mode,
    gitStatus,
    parsedFiles,
  }: TreeInputs) => {
    if (mode === "review") {
      return parsedFiles.map((file) => ({
        path: file.name,
        status: fileTypeToStatus(file.type),
      }));
    }
    return gitStatus.filter((entry) => !isInternalPath(entry.path));
  };

  const changedFiles: DiffFunctions["changedFiles"] = (gitStatus) =>
    gitStatus.filter((entry) => !isInternalPath(entry.path));

  const visibleComments: DiffFunctions["visibleComments"] = ({
    targetKind,
    targetKey,
    localComments,
    pullComments,
    viewingFile,
  }) => {
    if (targetKind === "pull") return pullComments;
    const forTarget = localComments.filter(
      (comment) => comment.target === targetKey
    );
    if (viewingFile === null) return forTarget;
    // The viewer writes worktree comments whatever the active target is, so
    // while it is open they count too — browsing a file and leaving a note on
    // it would otherwise file the note where nothing on screen looks for it.
    const seen = new Set(forTarget.map((comment) => comment.id));
    return [
      ...forTarget,
      ...localComments.filter(
        (comment) => comment.target === WORKTREE_KEY && !seen.has(comment.id)
      ),
    ];
  };

  return {
    deriveTarget,
    parseFiles,
    isInternalPath,
    treePaths,
    treeGitStatus,
    changedFiles,
    visibleComments,
  };
}

export { diffTargetKey };
