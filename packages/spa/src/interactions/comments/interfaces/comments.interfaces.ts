/**
 * `comments` feature — submitting, deleting and replying to review comments.
 * Which store a comment lands in (this machine, or the pull/merge request being
 * reviewed) and how a reply is anchored to its parent line is real business
 * logic, so it lives here behind injected side effects (the API mutations).
 */
import type { AppMode } from "@/lib/api/types";
import type { CommentSide, ReviewComment } from "@byconvo/core/comments";
import type { PullRequestInfo } from "@byconvo/core/ports/git-provider";

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
    /** `commentId` is the forge's own id, as `remoteCommentId` reads it. */
    readonly deletePullComment: (
      pullNumber: number,
      commentId: string
    ) => Promise<void>;
    readonly replyPullComment: (
      pullNumber: number,
      commentId: string,
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
   * Delete a comment from whichever store holds it — disk for a local one, the
   * forge for one on the request being reviewed. Answers false when nothing was
   * removed: a forge comment reached with no request in hand has no store to be
   * deleted from.
   */
  readonly remove: (
    selectedPull: PullRequestInfo | null,
    comment: ReviewComment
  ) => Promise<boolean>;
  /** Reply to a comment on a request, anchored to its parent's line. */
  readonly reply: (
    selectedPull: PullRequestInfo | null,
    comment: ReviewComment,
    body: string
  ) => Promise<ReviewComment | null>;
}
