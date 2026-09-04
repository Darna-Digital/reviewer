import { remoteCommentId } from "@byconvo/core/comments";
import type {
  CommentsDependencies,
  CommentsFunctions,
} from "../interfaces/comments.interfaces";

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
    const commentId = remoteCommentId(comment);
    if (selectedPull === null || commentId === null) return false;
    await d.sideEffects.deletePullComment(selectedPull.number, commentId);
    return true;
  };

  const reply: CommentsFunctions["reply"] = async (
    selectedPull,
    comment,
    body
  ) => {
    const commentId = remoteCommentId(comment);
    if (selectedPull === null || commentId === null) return null;
    const created = await d.sideEffects.replyPullComment(
      selectedPull.number,
      commentId,
      body
    );
    // Anchor the reply to the parent's line so it lands in the same thread even
    // when the forge reports no position for an outdated diff.
    return {
      ...created,
      filePath: comment.filePath,
      side: comment.side,
      lineNumber: comment.lineNumber,
    };
  };

  return { submit, update, remove, reply };
}
