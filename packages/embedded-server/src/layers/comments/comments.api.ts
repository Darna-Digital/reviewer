import * as Schema from "effect/Schema";
import {
  ReviewComment,
  CommentIdParam,
  CommentsRepoQuery,
  NewComment,
  UpdateComment,
} from "@reviewer/core/comments";
import {
  NoRepoSelected,
  NotFound,
  StorageError,
  Ok,
} from "@reviewer/core/shared";
import { InvalidRepo } from "@reviewer/core/workspace";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

// The repository types every operation with the same failure union
// (CommentsFailure), so each endpoint declares all three.
const storeError = [NoRepoSelected, NotFound, StorageError] as const;
// Reading and resolving can also name another repository (`?repo=`), which
// fails when the path is not inside one.
const scopedStoreError = [...storeError, InvalidRepo] as const;

export class CommentsApi extends HttpApiGroup.make("comments")
  .add(
    HttpApiEndpoint.get("list", "/comments", {
      query: CommentsRepoQuery,
      success: Schema.Array(ReviewComment),
      error: scopedStoreError,
    })
  )
  .add(
    HttpApiEndpoint.post("add", "/comments", {
      payload: NewComment,
      success: ReviewComment,
      error: storeError,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/comments/:id", {
      params: CommentIdParam,
      payload: UpdateComment,
      success: ReviewComment,
      error: storeError,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/comments/:id", {
      params: CommentIdParam,
      query: CommentsRepoQuery,
      success: Ok,
      error: scopedStoreError,
    })
  ) {}
