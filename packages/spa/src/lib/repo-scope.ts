/**
 * Which of the workspace's repositories the page is about.
 *
 * A workspace holds several repositories open at once, and the server answers
 * every repository-scoped request for the root the request names (the
 * `X-Reviewer-Repo` header; `?repo=` on a socket). The page's root is part of
 * its address — the `repo` search param on the app's layout route, kept
 * across every navigation inside the app (see `routes/_app.tsx`) — so a link,
 * a window tab or the shell's `navigate` carries the repository along with
 * the file or diff it opens, and two tabs of two repositories sit side by side.
 *
 * Read in three places, all through `scopedRepo`: the fetch client stamps it
 * on each request, the sockets put it in their query, and the query cache
 * hashes it into every key — so the same `/api/status` of two repositories is
 * two entries, and nothing one repository answered is ever shown for another.
 *
 * A page without the param — the web app on its own, a client that predates
 * workspaces — names no root, and the server answers for the workspace's
 * first.
 */
export const REPO_SEARCH_PARAM = "repo";

/** The absolute path the header and the socket query carry, URI-encoded. */
export const REPO_HEADER = "X-Reviewer-Repo";

type RepoSource = () => string | undefined;

let source: RepoSource = () => undefined;

/** Where the page's root is read from — the router's location, wired at boot. */
export const readScopedRepoFrom = (read: RepoSource): void => {
  source = read;
};

/** The root the page is about, or undefined for the workspace's first. */
export const scopedRepo = (): string | undefined => {
  const repo = source();
  return repo !== undefined && repo.length > 0 ? repo : undefined;
};

/** The search param a root is addressed by, read off an untyped search. */
export const repoFromSearch = (
  search: Record<string, unknown>
): string | undefined => {
  const repo = search[REPO_SEARCH_PARAM];
  return typeof repo === "string" && repo.length > 0 ? repo : undefined;
};
