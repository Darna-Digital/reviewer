/**
 * `comments` feature — submitting, deleting and replying to review comments.
 * Which store a comment lands in (local vs GitHub PR) and how a PR reply is
 * anchored to its parent line is real business logic, so it lives here behind
 * injected side effects (the API mutations).
 */
import type { AppMode } from "@/lib/api/types";
import type { CommentSide, ReviewComment } from "@reviewer/core/comments";
import type { PullRequestInfo } from "@reviewer/core/ports/git-provider";

export interface DraftLocation {
  readonly filePath: string;
  readonly side: CommentSide;
  readonly lineNumber: number;
  /**
   * What was already typed here, when the composer is being reopened rather
   * than started. A comment now appears the moment it is written and the
   * composer closes behind it, so the one case that needs this is the write
   * coming back refused — GitHub can, for ordinary reasons — where the words
   * have to come back with the composer instead of being lost with the request.
   */
  readonly body?: string;
}

export interface SubmitContext {
  readonly mode: AppMode;
  readonly selectedPull: PullRequestInfo | null;
  readonly targetKey: string;
}

export interface CommentsDependencies {
  data: Record<string, never>;
  sideEffects: {
    readonly addLocalComment: (input: {
      filePath: string;
      side: CommentSide;
      lineNumber: number;
      body: string;
      target: string;
    }) => Promise<ReviewComment>;
    readonly addPullComment: (
      pullNumber: number,
      input: {
        filePath: string;
        side: CommentSide;
        lineNumber: number;
        body: string;
      }
    ) => Promise<ReviewComment>;
    readonly updateLocalComment: (
      id: string,
      body: string
    ) => Promise<ReviewComment>;
    readonly deleteComment: (id: string) => Promise<void>;
    readonly deletePullComment: (
      pullNumber: number,
      commentId: number
    ) => Promise<void>;
    readonly replyPullComment: (
      pullNumber: number,
      commentId: number,
      body: string
    ) => Promise<ReviewComment>;
  };
}

export interface CommentsFunctions {
  /** Create a comment in the right store; returns the created comment. */
  readonly submit: (
    ctx: SubmitContext,
    location: DraftLocation,
    body: string
  ) => Promise<ReviewComment>;
  /** Update a local comment's body; returns the updated comment, or null if not local. */
  readonly update: (
    comment: ReviewComment,
    body: string
  ) => Promise<ReviewComment | null>;
  /**
   * Delete a comment from whichever store holds it — disk for a local one,
   * GitHub for one on the pull request being reviewed. Answers false when
   * nothing was removed: a GitHub comment reached with no pull request in hand
   * has no store to be deleted from.
   */
  readonly remove: (
    selectedPull: PullRequestInfo | null,
    comment: ReviewComment
  ) => Promise<boolean>;
  /** Reply to a GitHub PR comment, anchored to its parent's line. */
  readonly reply: (
    selectedPull: PullRequestInfo | null,
    comment: ReviewComment,
    body: string
  ) => Promise<ReviewComment | null>;
}
