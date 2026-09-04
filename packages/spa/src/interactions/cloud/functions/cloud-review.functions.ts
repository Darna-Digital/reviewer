/**
 * Where a cloud run's pull request is reviewed.
 *
 * A run finishes by opening a pull request, and the point of byconvo is that
 * you read it here rather than in a browser tab. byconvo reviews a pull
 * request by number against whatever repository is open, though, so the number
 * alone is not enough: opening `#12` while a different repository is checked
 * out would show someone else's twelfth pull request. So the run's repository
 * and the open one are compared first, and the link only comes inside when
 * they are the same repository.
 */

/** The repository byconvo has open, as `/api/repo` answers it. */
export interface OpenRepo {
  readonly remote: {
    readonly host: string;
    readonly owner: string;
    readonly repo: string;
  } | null;
}

/**
 * The open repository as GitHub knows it, or null when it is not on GitHub.
 *
 * byconvo cloud runs on GitHub and only on GitHub — a run is a branch and a
 * pull request there — so everything about a run compares against this rather
 * than against whichever forge the checkout happens to be on. A GitLab project
 * is simply not a repository any cloud run can belong to.
 */
export const githubRepoOf = (
  open: OpenRepo | null | undefined
): { readonly owner: string; readonly repo: string } | null => {
  const remote = open?.remote ?? null;
  return remote === null || remote.host !== "github"
    ? null
    : { owner: remote.owner, repo: remote.repo };
};

export type ReviewDestination =
  /** Reviewed here, at this route. */
  | { readonly kind: "byconvo"; readonly href: string; readonly number: number }
  /** Reviewable, but not against the repository that is open. */
  | {
      readonly kind: "elsewhere";
      readonly url: string;
      readonly repoFullName: string;
    }
  /** No pull request yet — the run is still working, or opened none. */
  | { readonly kind: "none" };

/**
 * The pull request's number from its URL. GitHub's is
 * `https://github.com/owner/repo/pull/12`, and anything that is not that
 * shape is not something this can route to.
 */
export const pullNumberOf = (url: string): number | null => {
  const match = /\/pull\/(\d+)(?:[/?#]|$)/.exec(url);
  if (match?.[1] === undefined) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/** `owner/repo` compared the way GitHub does it: case-insensitively. */
export const sameRepo = (
  fullName: string,
  open: { readonly owner: string; readonly repo: string } | null
): boolean => {
  if (open === null) return false;
  return fullName.toLowerCase() === `${open.owner}/${open.repo}`.toLowerCase();
};

export const reviewDestination = (
  run: {
    readonly pullRequestUrl: string | null;
    readonly repoFullName: string;
  },
  open: OpenRepo | null | undefined
): ReviewDestination => {
  const url = run.pullRequestUrl;
  if (url === null || url.length === 0) return { kind: "none" };
  const number = pullNumberOf(url);
  if (number === null || !sameRepo(run.repoFullName, githubRepoOf(open))) {
    return { kind: "elsewhere", url, repoFullName: run.repoFullName };
  }
  return {
    kind: "byconvo",
    href: `/modes/code/review/pull/${number}`,
    number,
  };
};

/**
 * A page of the cloud app on whichever server this machine is connected to.
 * The stored URL is whatever was typed into the setting, so it may carry a
 * trailing slash or a path of its own; both are joined without doubling.
 */
export const cloudAppHref = (serverUrl: string, path: string): string => {
  const base = serverUrl.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};
