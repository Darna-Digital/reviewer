/**
 * What GitHub says about a pull request, read into `PullRequestInfo`.
 *
 * Two shapes arrive here for the same thing. `/repos/{o}/{r}/pulls` is the
 * listing every install can make — it works without a token on a public repo —
 * but it carries none of what a reviewer decides by: no CI, no mergeability,
 * no description of the change. GraphQL carries all of it, for every open pull
 * request, in one round trip, and refuses anonymous callers.
 *
 * So the provider asks GraphQL first and falls back to the listing, and both
 * readings land here as pure functions: parsing GitHub's several spellings of
 * "this check failed" is the part worth testing, and it should not need a
 * network to do it.
 */
import {
  unenrichedPull,
  type CheckState,
  type MergeableState,
  type PullRequestCheck,
  type PullRequestInfo,
  type PullRequestLabel,
} from "@reviewer/core/ports/git-provider";

const str = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const nodes = (value: unknown): ReadonlyArray<Record<string, unknown>> => {
  const list = (value as { nodes?: unknown } | null | undefined)?.nodes;
  return Array.isArray(list)
    ? list.filter(
        (node): node is Record<string, unknown> =>
          typeof node === "object" && node !== null
      )
    : [];
};

/**
 * A check run's conclusion, or — while it has none — its status.
 *
 * `neutral` is the bucket for everything that ran and declined to have an
 * opinion: skipped, cancelled, neutral itself. It is deliberately not
 * `success`; a skipped required check is not a passing one, and it is
 * deliberately not `failure`; nothing is wrong.
 */
export const checkRunState = (
  status: unknown,
  conclusion: unknown
): CheckState => {
  switch (str(conclusion).toUpperCase()) {
    case "SUCCESS":
      return "success";
    case "FAILURE":
    case "TIMED_OUT":
    case "STARTUP_FAILURE":
    case "ACTION_REQUIRED":
      return "failure";
    case "NEUTRAL":
    case "SKIPPED":
    case "CANCELLED":
    case "STALE":
      return "neutral";
    default:
      break;
  }
  return str(status).toUpperCase() === "COMPLETED" ? "neutral" : "pending";
};

/** A commit status context's state (the older, pre-checks API spelling). */
export const statusContextState = (state: unknown): CheckState => {
  switch (str(state).toUpperCase()) {
    case "SUCCESS":
      return "success";
    case "FAILURE":
    case "ERROR":
      return "failure";
    case "PENDING":
    case "EXPECTED":
      return "pending";
    default:
      return "neutral";
  }
};

const mergeableState = (value: unknown): MergeableState => {
  switch (str(value).toUpperCase()) {
    case "MERGEABLE":
      return "mergeable";
    case "CONFLICTING":
      return "conflicting";
    default:
      return "unknown";
  }
};

const checksFromRollup = (
  commit: Record<string, unknown> | undefined
): ReadonlyArray<PullRequestCheck> => {
  const rollup = (commit as { statusCheckRollup?: unknown } | undefined)
    ?.statusCheckRollup;
  if (rollup === null || rollup === undefined) return [];
  return nodes((rollup as { contexts?: unknown }).contexts).flatMap(
    (context): Array<PullRequestCheck> => {
      if (context["__typename"] === "CheckRun") {
        return [
          {
            name: str(context["name"], "check"),
            state: checkRunState(context["status"], context["conclusion"]),
            url: str(context["detailsUrl"]),
          },
        ];
      }
      if (context["__typename"] === "StatusContext") {
        return [
          {
            name: str(context["context"], "status"),
            state: statusContextState(context["state"]),
            url: str(context["targetUrl"]),
          },
        ];
      }
      return [];
    }
  );
};

const reviewerLogin = (request: Record<string, unknown>): string => {
  const reviewer = request["requestedReviewer"] as Record<
    string,
    unknown
  > | null;
  if (reviewer === null || reviewer === undefined) return "";
  return str(reviewer["login"]) || str(reviewer["name"]);
};

const labelsOf = (node: Record<string, unknown>): Array<PullRequestLabel> =>
  nodes(node["labels"]).map((label) => ({
    name: str(label["name"]),
    color: str(label["color"]),
  }));

/** One `repository.pullRequests.nodes[]` entry. */
export const pullFromGraphql = (
  node: Record<string, unknown>
): PullRequestInfo => {
  const commit = nodes(node["commits"])[0]?.["commit"] as
    Record<string, unknown> | undefined;
  return {
    number: num(node["number"]),
    title: str(node["title"]),
    author: str((node["author"] as { login?: unknown } | null)?.login),
    baseRef: str(node["baseRefName"]),
    headRef: str(node["headRefName"]),
    headSha: str(node["headRefOid"]),
    url: str(node["url"]),
    updatedAt: str(node["updatedAt"]),
    createdAt: str(node["createdAt"]),
    body: str(node["body"]),
    draft: node["isDraft"] === true,
    fromFork: node["isCrossRepository"] === true,
    mergeable: mergeableState(node["mergeable"]),
    checks: checksFromRollup(commit),
    assignees: nodes(node["assignees"]).map((user) => str(user["login"])),
    reviewers: nodes(node["reviewRequests"])
      .map(reviewerLogin)
      .filter((login) => login.length > 0),
    labels: labelsOf(node),
    additions: num(node["additions"]),
    deletions: num(node["deletions"]),
    changedFiles: num(node["changedFiles"]),
  };
};

/** One `/repos/{owner}/{repo}/pulls` entry — everything GraphQL knows, minus. */
export const pullFromRest = (pr: Record<string, unknown>): PullRequestInfo => {
  const head = pr["head"] as Record<string, unknown> | undefined;
  const base = pr["base"] as Record<string, unknown> | undefined;
  return {
    ...unenrichedPull,
    number: num(pr["number"]),
    title: str(pr["title"]),
    author: str((pr["user"] as { login?: unknown } | null)?.login),
    baseRef: str(base?.["ref"]),
    headRef: str(head?.["ref"]),
    headSha: str(head?.["sha"]),
    url: str(pr["html_url"]),
    updatedAt: str(pr["updated_at"]),
    // The listing does carry these three, and they cost nothing to read.
    createdAt: str(pr["created_at"]),
    body: str(pr["body"]),
    draft: pr["draft"] === true,
    // Two repo ids, one comparison — the listing carries both sides' repo.
    fromFork:
      str((head?.["repo"] as { full_name?: unknown } | null)?.full_name) !==
      str((base?.["repo"] as { full_name?: unknown } | null)?.full_name),
    labels: Array.isArray(pr["labels"])
      ? (pr["labels"] as Array<Record<string, unknown>>).map((label) => ({
          name: str(label["name"]),
          color: str(label["color"]),
        }))
      : [],
    assignees: Array.isArray(pr["assignees"])
      ? (pr["assignees"] as Array<Record<string, unknown>>).map((user) =>
          str(user["login"])
        )
      : [],
  };
};

/** The whole GraphQL answer → the open pull requests it holds. */
export const pullsFromGraphql = (
  data: unknown
): ReadonlyArray<PullRequestInfo> => {
  const repository = (data as { repository?: unknown } | null)?.repository;
  return nodes((repository as { pullRequests?: unknown } | null)?.pullRequests)
    .map(pullFromGraphql)
    .filter((pull) => pull.number > 0);
};

/** How many open pull requests one listing asks for, either way of asking. */
export const PULLS_PER_PAGE = 50;

export const PULLS_QUERY = `
query Pulls($owner: String!, $repo: String!, $first: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(states: OPEN, first: $first, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number
        title
        body
        url
        isDraft
        isCrossRepository
        createdAt
        updatedAt
        additions
        deletions
        changedFiles
        mergeable
        baseRefName
        headRefName
        headRefOid
        author { login }
        labels(first: 10) { nodes { name color } }
        assignees(first: 10) { nodes { login } }
        reviewRequests(first: 10) {
          nodes { requestedReviewer { __typename ... on User { login } ... on Team { name } } }
        }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                contexts(first: 100) {
                  nodes {
                    __typename
                    ... on CheckRun { name status conclusion detailsUrl }
                    ... on StatusContext { context state targetUrl }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;
