/**
 * Who a note written here is by: the repository's git identity, which is what
 * the server signs it with (`git-identity` there). Read up front so a draft
 * can wear its author's monogram, and an optimistic comment can carry the
 * name the server is about to file it under. "you" until the repo answers —
 * the same word the server falls back to.
 */
import { useRepo } from "@/lib/queries";

export const ANONYMOUS_AUTHOR = "you";

export const useCommentAuthor = (): string =>
  useRepo().data?.user ?? ANONYMOUS_AUTHOR;
