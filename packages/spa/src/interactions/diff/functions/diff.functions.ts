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
    comparing = false,
  }: TreeInputs) => {
    if (mode === "browse")
      return allPaths.filter((path) => !isInternalPath(path));
    if (mode === "commit") {
      const commented = new Set(commentedPaths);
      // Read against a branch, the diff's own files belong in the tree too:
      // a file committed earlier on the branch is part of the change being
      // read, however quiet it has been since.
      const compared = new Set(
        comparing ? parsedFiles.map((file) => file.name) : []
      );
      const listed = allPaths
        .filter((path) => !isInternalPath(path))
        .filter(
          (path) =>
            gitStatus.some((entry) => entry.path === path) ||
            commented.has(path) ||
            compared.has(path)
        );
      // A file the branch deleted is in the diff and gone from disk, so the
      // repository's file list cannot supply it.
      const seen = new Set(listed);
      return [
        ...listed,
        ...[...compared].filter(
          (path) => !seen.has(path) && !isInternalPath(path)
        ),
      ];
    }
    return parsedFiles.map((file) => file.name);
  };

  const treeGitStatus: DiffFunctions["treeGitStatus"] = ({
    mode,
    gitStatus,
    parsedFiles,
    comparing = false,
  }: TreeInputs) => {
    const fromDiff = parsedFiles.map((file) => ({
      path: file.name,
      status: fileTypeToStatus(file.type),
    }));
    if (mode === "review") return fromDiff;
    const live = gitStatus.filter((entry) => !isInternalPath(entry.path));
    if (!comparing) return live;
    // The badge says what the file is against what it is being read against —
    // a file added by a commit on the branch reads as added, not as unchanged.
    // Uncommitted entries the diff cannot carry (an untracked file) keep
    // theirs, so nothing loses its badge by comparing.
    const inDiff = new Set(fromDiff.map((entry) => entry.path));
    return [
      ...fromDiff.filter((entry) => !isInternalPath(entry.path)),
      ...live.filter((entry) => !inDiff.has(entry.path)),
    ];
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
