import {
  errorText,
  type GitActionsDependencies,
  type GitActionsFunctions,
  type NoticeKind,
  type RepoCommitOutcome,
} from "../interfaces/git-actions.interfaces";

export function createGitActionsFunctions(
  d: GitActionsDependencies
): GitActionsFunctions {
  const { commit, commitAcrossRepos, notify, push, refresh } = d.sideEffects;

  const commitChanges: GitActionsFunctions["commitChanges"] = async (
    message,
    paths,
    andPush
  ) => {
    let sha: string;
    if (commitAcrossRepos !== null) {
      let results: ReadonlyArray<RepoCommitOutcome>;
      try {
        results = await commitAcrossRepos(message, paths);
      } catch (cause) {
        notify("err", errorText(cause));
        return false;
      }
      const summary = summariseCommits(results);
      notify(summary.kind, summary.text);
      refresh();
      // Pushing is per-root and follows the same shape; it is not folded into
      // this step until the branch widget makes "which root" explicit.
      return summary.kind === "ok";
    }
    try {
      ({ sha } = await commit(message, paths));
    } catch (cause) {
      notify("err", errorText(cause));
      return false;
    }
    try {
      if (andPush) {
        await push();
        notify("ok", `Committed ${sha} and pushed`);
      } else {
        notify("ok", `Committed ${sha}`);
      }
    } catch (pushCause) {
      // The commit landed — say so alongside the push failure.
      notify(
        "err",
        `Committed ${sha}, but push failed:\n${errorText(pushCause)}`
      );
    }
    refresh();
    return true;
  };

  const runOp: GitActionsFunctions["runOp"] = async (label, op) => {
    try {
      const result = (await op()) as { output?: string } | undefined;
      const output =
        result !== undefined &&
        typeof result.output === "string" &&
        result.output.length > 0
          ? result.output
          : label;
      notify("ok", output);
      refresh();
      return true;
    } catch (cause) {
      notify("err", errorText(cause));
      return false;
    }
  };

  return { commitChanges, runOp };
}

/**
 * What to tell someone about a commit that spanned several roots. A commit
 * landing in one root and failing in another is neither a success nor a
 * failure, and saying only one of those would send them looking in the wrong
 * place — so each root that failed is named alongside the ones that landed.
 */
export const summariseCommits = (
  results: ReadonlyArray<RepoCommitOutcome>
): { readonly kind: NoticeKind; readonly text: string } => {
  const landed = results.filter((result) => result.sha !== null);
  const failed = results.filter((result) => result.sha === null);
  const list = (of: ReadonlyArray<RepoCommitOutcome>) =>
    of.map((result) => result.repo.name).join(", ");

  if (results.length === 0) {
    return { kind: "err", text: "Nothing selected to commit" };
  }
  if (failed.length === 0) {
    return {
      kind: "ok",
      text:
        landed.length === 1
          ? `Committed ${landed[0]?.sha} in ${landed[0]?.repo.name}`
          : `Committed in ${list(landed)}`,
    };
  }
  const why = failed
    .map((result) => `${result.repo.name}: ${result.reason ?? "failed"}`)
    .join("\n");
  return {
    kind: "err",
    text:
      landed.length === 0
        ? `Nothing committed.\n${why}`
        : `Committed in ${list(landed)}, but not in:\n${why}`,
  };
};
