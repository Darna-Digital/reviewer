import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
  CommentsRepository,
  type CommentsRepo,
} from "../repository/comments.repository.ts";

export interface CommentsServiceShape extends CommentsRepo {}
export class CommentsService extends Context.Service<
  CommentsService,
  CommentsServiceShape
>()("CommentsService") {}
export const makeCommentsService = Effect.gen(function* () {
  const repo = yield* CommentsRepository;
  return CommentsService.of(repo);
});
