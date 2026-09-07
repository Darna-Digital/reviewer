import type { ReviewComment } from "@reviewer/core/comments";
import type {
  CommentsDependencies,
  CommentsFunctions,
} from "../interfaces/comments.interfaces";

/** GitHub's own id for a comment we hold as `gh-<id>`, or null for any other. */
const githubCommentId = (comment: ReviewComment): number | null => {
  if (comment.source !== "github") return null;
  const id = Number(comment.id.replace(/^gh-/, ""));
  return Number.isInteger(id) ? id : null;
};

export function createCommentsFunctions(
  d: CommentsDependencies
): CommentsFunctions {
  const submit: CommentsFunctions["submit"] = async (ctx, location, body) => {
    if (ctx.mode === "review" && ctx.selectedPull !== null) {
      return d.sideEffects.addPullComment(ctx.selectedPull.number, {
        filePath: location.filePath,
        side: location.side,
        lineNumber: location.lineNumber,
        body,
      });
    }
    return d.sideEffects.addLocalComment({
      filePath: location.filePath,
      side: location.side,
      lineNumber: location.lineNumber,
      body,
      target: ctx.targetKey,
    });
  };

  const update: CommentsFunctions["update"] = async (comment, body) => {
    if (comment.source !== "local") return null;
    return d.sideEffects.updateLocalComment(comment.id, body);
  };

  const remove: CommentsFunctions["remove"] = async (selectedPull, comment) => {
    if (comment.source === "local") {
      await d.sideEffects.deleteComment(comment.id);
      return true;
    }
    const commentId = githubCommentId(comment);
    if (selectedPull === null || commentId === null) return false;
    await d.sideEffects.deletePullComment(selectedPull.number, commentId);
    return true;
  };

  const reply: CommentsFunctions["reply"] = async (
    selectedPull,
    comment,
    body
  ) => {
    const commentId = githubCommentId(comment);
    if (selectedPull === null || commentId === null) return null;
    const created = await d.sideEffects.replyPullComment(
      selectedPull.number,
      commentId,
      body
    );
    // Anchor the reply to the parent's line so it lands in the same thread even
    // when GitHub reports a null position for an outdated diff.
    return {
      ...created,
      filePath: comment.filePath,
      side: comment.side,
      lineNumber: comment.lineNumber,
    };
  };

  return { submit, update, remove, reply };
}
