/**
 * The cache edits behind a comment that appears the moment you write it.
 *
 * Leaving a review comment used to be: POST, wait, invalidate, refetch every
 * comment in the repository, re-render. Two round-trips and a full reload of
 * the list before the sentence you just typed showed up on the line you typed
 * it against — for a write to a local database that essentially cannot fail.
 *
 * So the list is edited first and the server is told after. These are the
 * edits, kept pure and separate from the mutation that performs them, so the
 * fiddly parts — where a new comment sorts, what happens when the server hands
 * back a different id than the one we invented, putting the list back when the
 * write genuinely fails — are testable without a query client or a server.
 *
 * Only local comments get this treatment. A GitHub comment is a real network
 * write to somebody else's system, with its own failure modes and its own id;
 * pretending it has landed would be a lie often enough to matter.
 */
import type { ReviewComment } from "@byconvo/core/comments";

/**
 * The id an optimistic comment carries until the server names it. Prefixed so
 * it can never collide with a real one, and so anything downstream can tell
 * that this comment is not yet acknowledged.
 */
export const optimisticId = (seq: number): string => `pending-${seq}`;

/** Whether `id` belongs to a comment the server has not confirmed yet. */
export const isOptimisticId = (id: string): boolean =>
  id.startsWith("pending-");

/** The comment to show immediately for a submission that has just been made. */
export const optimisticComment = (input: {
  id: string;
  filePath: string;
  side: ReviewComment["side"];
  lineNumber: number;
  body: string;
  target: string;
  author: string;
  createdAt: string;
}): ReviewComment => ({ ...input, source: "local" });

/** `comment` appended to `list` — where the thread it joins expects it. */
export const withComment = (
  list: ReadonlyArray<ReviewComment>,
  comment: ReviewComment
): ReadonlyArray<ReviewComment> => [...list, comment];

/**
 * `list` with the optimistic `pendingId` replaced by what the server actually
 * stored — in place, so a thread does not reorder as it is confirmed. Appends
 * when the placeholder is gone (a refetch landed in between and already
 * dropped it), which keeps the confirmed comment rather than losing it.
 */
export const withConfirmed = (
  list: ReadonlyArray<ReviewComment>,
  pendingId: string,
  saved: ReviewComment
): ReadonlyArray<ReviewComment> =>
  list.some((comment) => comment.id === pendingId)
    ? list.map((comment) => (comment.id === pendingId ? saved : comment))
    : [...list, saved];

/** `list` without `id` — the immediate half of a delete, and the undo of a
 * failed submit. */
export const withoutComment = (
  list: ReadonlyArray<ReviewComment>,
  id: string
): ReadonlyArray<ReviewComment> => list.filter((comment) => comment.id !== id);

/** `list` with `id`'s body replaced — the immediate half of an edit. */
export const withEditedBody = (
  list: ReadonlyArray<ReviewComment>,
  id: string,
  body: string
): ReadonlyArray<ReviewComment> =>
  list.map((comment) => (comment.id === id ? { ...comment, body } : comment));
