import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { CommentSide } from "../features/comments/schema/comments.schema.ts";
import type { ReviewComment } from "../features/comments/schema/comments.schema.ts";

export class GitProviderError extends Schema.TaggedErrorClass<GitProviderError>()(
  "GitProviderError",
  { reason: Schema.String, status: Schema.optionalKey(Schema.Number) },
  { httpApiStatus: 502 }
) {
  override get message(): string {
    return this.reason;
  }
}

/**
 * How one CI check came back. GitHub spells this several ways — a check run has
 * a status and a conclusion, a commit status has a state — and the review UI
 * only ever asks one question of it: is this thing still running, did it pass,
 * or is it in the way. So they are all folded onto the same four words here,
 * once, at the edge.
 */
export const CheckState = Schema.Literals([
  "success",
  "failure",
  "pending",
  "neutral",
]);
export type CheckState = typeof CheckState.Type;

export const PullRequestCheck = Schema.Struct({
  name: Schema.String,
  state: CheckState,
  /** Where the run is on GitHub, or "" when it published no page. */
  url: Schema.String,
});
export type PullRequestCheck = typeof PullRequestCheck.Type;

/**
 * Whether the pull request can be merged as it stands. "unknown" is a real
 * answer and not a gap in ours: GitHub computes mergeability lazily, so a pull
 * request nobody has asked about recently genuinely does not know yet.
 */
export const MergeableState = Schema.Literals([
  "mergeable",
  "conflicting",
  "unknown",
]);
export type MergeableState = typeof MergeableState.Type;

export const PullRequestLabel = Schema.Struct({
  name: Schema.String,
  /** Six hex digits, no leading "#" — GitHub's own spelling. */
  color: Schema.String,
});
export type PullRequestLabel = typeof PullRequestLabel.Type;

export const PullRequestInfo = Schema.Struct({
  number: Schema.Number,
  title: Schema.String,
  author: Schema.String,
  baseRef: Schema.String,
  headRef: Schema.String,
  headSha: Schema.String,
  url: Schema.String,
  updatedAt: Schema.String,
  createdAt: Schema.String,
  /** The pull request's description, as markdown. "" when it has none. */
  body: Schema.String,
  draft: Schema.Boolean,
  /** Opened from a fork, so its head branch is not one of ours to check out. */
  fromFork: Schema.Boolean,
  mergeable: MergeableState,
  /** Every check on the head commit. Empty when the repo runs no CI. */
  checks: Schema.Array(PullRequestCheck),
  assignees: Schema.Array(Schema.String),
  /** Logins (and team names) review has been requested from. */
  reviewers: Schema.Array(Schema.String),
  labels: Schema.Array(PullRequestLabel),
  additions: Schema.Number,
  deletions: Schema.Number,
  changedFiles: Schema.Number,
});
export type PullRequestInfo = typeof PullRequestInfo.Type;

/**
 * The parts of a pull request the plain REST listing does not carry — CI,
 * mergeability, the description, who is on it. Held apart so a provider that
 * cannot answer them (no token, so no GraphQL) still lists pull requests, and
 * so every caller building one for a test says the interesting half only.
 */
export const unenrichedPull = {
  createdAt: "",
  body: "",
  draft: false,
  fromFork: false,
  mergeable: "unknown",
  checks: [],
  assignees: [],
  reviewers: [],
  labels: [],
  additions: 0,
  deletions: 0,
  changedFiles: 0,
} as const satisfies Omit<
  PullRequestInfo,
  | "number"
  | "title"
  | "author"
  | "baseRef"
  | "headRef"
  | "headSha"
  | "url"
  | "updatedAt"
>;

/**
 * How a pull request's commits land on its base branch. GitHub's three, under
 * its own names — a repository may have any of them turned off, and refuses
 * the call rather than quietly substituting another.
 */
export const MergeMethod = Schema.Literals(["merge", "squash", "rebase"]);
export type MergeMethod = typeof MergeMethod.Type;

export const MergePullRequest = Schema.Struct({ method: MergeMethod });
export type MergePullRequest = typeof MergePullRequest.Type;

export const MergeResult = Schema.Struct({
  /** The commit the merge produced. */
  sha: Schema.String,
  /** GitHub's own wording for what happened, shown as the confirmation. */
  message: Schema.String,
});
export type MergeResult = typeof MergeResult.Type;

/**
 * The outcome of closing a pull request without merging it. Only the sentence
 * to show for it: GitHub answers a close with the whole pull request, and the
 * one thing in it worth carrying back is whether it is shut — which a refusal
 * says by failing rather than by a field the caller has to remember to read.
 */
export const CloseResult = Schema.Struct({ message: Schema.String });
export type CloseResult = typeof CloseResult.Type;

/**
 * Who the provider is signed in as, and how. The token is found rather than
 * entered — the environment's `GITHUB_TOKEN`/`GH_TOKEN`, else the `gh` CLI's
 * own login — so a settings screen has nothing to edit here, only to say which
 * of the two is in use, or that neither is, and what to run to change that.
 */
export const GitHubAuthSource = Schema.Literals(["env", "gh"]);
export type GitHubAuthSource = typeof GitHubAuthSource.Type;

export const GitHubAuth = Schema.Struct({
  /** The login the token belongs to; null when there is no token. */
  login: Schema.NullOr(Schema.String),
  /** The profile's display name, where the account has one. */
  name: Schema.NullOr(Schema.String),
  avatarUrl: Schema.NullOr(Schema.String),
  source: Schema.NullOr(GitHubAuthSource),
});
export type GitHubAuth = typeof GitHubAuth.Type;

/**
 * Where a sign-in stands. The flow is GitHub's device flow, run by the `gh`
 * CLI so the token lands where `gh` keeps it and every later request finds
 * it: `waiting` carries the one-time code the person types on GitHub's
 * device page, `done` says the CLI has the token, and `failed` says why it
 * has not — the CLI missing, the code expired, the flow cancelled.
 */
export const GitHubLoginPhase = Schema.Literals([
  "idle",
  "waiting",
  "done",
  "failed",
]);
export type GitHubLoginPhase = typeof GitHubLoginPhase.Type;

export const GitHubLoginState = Schema.Struct({
  phase: GitHubLoginPhase,
  /** The one-time code, and the page to type it on — while `waiting`. */
  code: Schema.NullOr(Schema.String),
  url: Schema.NullOr(Schema.String),
  /** Why the sign-in stopped — while `failed`. */
  reason: Schema.NullOr(Schema.String),
});
export type GitHubLoginState = typeof GitHubLoginState.Type;

export const PullNumberParam = Schema.Struct({ number: Schema.String });
export const PullCommentParams = Schema.Struct({
  number: Schema.String,
  commentId: Schema.String,
});

export const PrComment = Schema.Struct({
  filePath: Schema.String,
  side: CommentSide,
  lineNumber: Schema.Number,
  body: Schema.String,
});
export type PrComment = typeof PrComment.Type;

export const PrReply = Schema.Struct({ body: Schema.String });
export type PrReply = typeof PrReply.Type;

export interface PrCommentInput {
  readonly pullNumber: number;
  readonly filePath: string;
  readonly side: "deletions" | "additions";
  readonly lineNumber: number;
  readonly body: string;
}
/**
 * One comment already on a pull request. GitHub identifies a review comment
 * repo-wide rather than within its pull request, so the number here is what the
 * caller is looking at rather than something the provider needs to find it.
 */
export interface PrCommentRef {
  readonly pullNumber: number;
  readonly commentId: number;
}
export interface PrReplyInput extends PrCommentRef {
  readonly body: string;
}

export interface GitProviderShape {
  /** Who requests go out as. Never needs a repository: the login is the user's. */
  readonly auth: Effect.Effect<GitHubAuth, GitProviderError>;
  readonly pulls: Effect.Effect<
    ReadonlyArray<PullRequestInfo>,
    GitProviderError
  >;
  readonly pullDiff: (
    pullNumber: number
  ) => Effect.Effect<string, GitProviderError>;
  readonly pullComments: (
    pullNumber: number
  ) => Effect.Effect<ReadonlyArray<ReviewComment>, GitProviderError>;
  readonly createPullComment: (
    input: PrCommentInput
  ) => Effect.Effect<ReviewComment, GitProviderError>;
  readonly replyToPullComment: (
    input: PrReplyInput
  ) => Effect.Effect<ReviewComment, GitProviderError>;
  readonly deletePullComment: (
    input: PrCommentRef
  ) => Effect.Effect<void, GitProviderError>;
  readonly mergePull: (
    pullNumber: number,
    method: MergeMethod
  ) => Effect.Effect<MergeResult, GitProviderError>;
  readonly closePull: (
    pullNumber: number
  ) => Effect.Effect<CloseResult, GitProviderError>;
}

export class GitProvider extends Context.Service<
  GitProvider,
  GitProviderShape
>()("GitProvider") {}

export interface GitProviderSeed {
  readonly auth?: GitHubAuth;
  readonly pulls?: ReadonlyArray<PullRequestInfo>;
  readonly comments?: ReadonlyArray<ReviewComment>;
  readonly diff?: string;
}

export const GitProviderMemory = (
  seed: GitProviderSeed = {}
): Layer.Layer<GitProvider> =>
  Layer.succeed(GitProvider)(
    GitProvider.of({
      auth: Effect.succeed(
        seed.auth ?? { login: null, name: null, avatarUrl: null, source: null }
      ),
      pulls: Effect.succeed(seed.pulls ?? []),
      pullDiff: () => Effect.succeed(seed.diff ?? ""),
      pullComments: () => Effect.succeed(seed.comments ?? []),
      createPullComment: (input) =>
        Effect.succeed({
          id: "gh-new",
          filePath: input.filePath,
          side: input.side,
          lineNumber: input.lineNumber,
          body: input.body,
          author: "tester",
          createdAt: "2026-01-01T00:00:00.000Z",
          target: `pr-${input.pullNumber}`,
          source: "github",
        }),
      mergePull: (pullNumber) =>
        Effect.succeed({
          sha: "merged1",
          message: `Pull Request successfully merged (#${pullNumber})`,
        }),
      closePull: (pullNumber) =>
        Effect.succeed({ message: `Closed #${pullNumber}` }),
      deletePullComment: () => Effect.void,
      replyToPullComment: (input) =>
        Effect.succeed({
          id: "gh-reply",
          filePath: "",
          side: "additions",
          lineNumber: 0,
          body: input.body,
          author: "tester",
          createdAt: "2026-01-01T00:00:00.000Z",
          target: `pr-${input.pullNumber}`,
          source: "github",
        }),
    })
  );
