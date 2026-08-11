/**
 * The project's git state seen whole, across every root it holds.
 *
 * The `repo` feature answers for one repository — the one currently selected.
 * This one answers for all of them at once, which is what the views a person
 * works in actually need: a commit view listing the changes in `backend` and
 * `frontend` together, a branch popup showing where each root sits, one history
 * covering the lot. Each entry carries the root it came from, so a row can say
 * where it belongs and an action on it knows which repository to run in.
 */
import * as Schema from "effect/Schema";
import {
  BranchInfo,
  CommitInfo,
  ContentMatch,
  GitStatusEntry,
  RemoteBranchInfo,
  RepoStatus,
} from "../../repo/schema/repo.schema.ts";
import { RepoEntry } from "../../workspace/schema/workspace.schema.ts";

/** One root's uncommitted work — the commit view's per-repository group. */
export const RepoChanges = Schema.Struct({
  repo: RepoEntry,
  status: RepoStatus,
  files: Schema.Array(GitStatusEntry),
});
export type RepoChanges = typeof RepoChanges.Type;

/** One root's branches — the branch popup's per-repository section. */
export const RepoBranches = Schema.Struct({
  repo: RepoEntry,
  branches: Schema.Array(BranchInfo),
  remoteBranches: Schema.Array(RemoteBranchInfo),
});
export type RepoBranches = typeof RepoBranches.Type;

/** A commit, and the root whose history it belongs to. */
export const ProjectCommit = Schema.Struct({
  repo: RepoEntry,
  commit: CommitInfo,
});
export type ProjectCommit = typeof ProjectCommit.Type;

/**
 * A root that could not be read — a repository mid-clone, or one whose git
 * data is broken. Named rather than dropped, so a project view says which root
 * is missing instead of quietly shrinking.
 */
export const RepoFailure = Schema.Struct({
  repo: RepoEntry,
  reason: Schema.String,
});
export type RepoFailure = typeof RepoFailure.Type;

export const ProjectChanges = Schema.Struct({
  repos: Schema.Array(RepoChanges),
  failed: Schema.Array(RepoFailure),
});
export type ProjectChanges = typeof ProjectChanges.Type;

export const ProjectBranches = Schema.Struct({
  repos: Schema.Array(RepoBranches),
  failed: Schema.Array(RepoFailure),
});
export type ProjectBranches = typeof ProjectBranches.Type;

/**
 * Every root's files as the project sees them: paths prefixed with the root
 * they belong to, so `web-app/src/a.ts` and `backend-app/src/a.ts` are two
 * files and the tree nests them under their roots without being told to.
 */
export const ProjectFiles = Schema.Struct({
  paths: Schema.Array(Schema.String),
  gitStatus: Schema.Array(GitStatusEntry),
  failed: Schema.Array(RepoFailure),
});
export type ProjectFiles = typeof ProjectFiles.Type;

/** Files to commit, named from the project root, and the message for them. */
export const ProjectCommitBody = Schema.Struct({
  message: Schema.String,
  paths: Schema.Array(Schema.String),
});
export type ProjectCommitBody = typeof ProjectCommitBody.Type;

/** What one root did with the commit: a sha, or why it did not get one. */
export const RepoCommitResult = Schema.Struct({
  repo: RepoEntry,
  sha: Schema.NullOr(Schema.String),
  reason: Schema.NullOr(Schema.String),
});
export type RepoCommitResult = typeof RepoCommitResult.Type;

export const ProjectCommitResult = Schema.Struct({
  results: Schema.Array(RepoCommitResult),
});
export type ProjectCommitResult = typeof ProjectCommitResult.Type;

export const ProjectLog = Schema.Struct({
  commits: Schema.Array(ProjectCommit),
  failed: Schema.Array(RepoFailure),
});
export type ProjectLog = typeof ProjectLog.Type;

/**
 * Every root's content matches as one result, each path named from the project
 * root the same way `ProjectFiles` names them — so a hit opens the file it came
 * from without the dialog having to remember which repository ran the grep.
 */
export const ProjectMatches = Schema.Struct({
  matches: Schema.Array(ContentMatch),
  truncated: Schema.Boolean,
  failed: Schema.Array(RepoFailure),
});
export type ProjectMatches = typeof ProjectMatches.Type;
