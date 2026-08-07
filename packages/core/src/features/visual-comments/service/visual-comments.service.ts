import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import {
  VisualCommentsRepository,
  type VisualCommentsRepo,
} from "../repository/visual-comments.repository.ts";

export interface VisualCommentsServiceShape extends VisualCommentsRepo {}
export class VisualCommentsService extends Context.Service<
  VisualCommentsService,
  VisualCommentsServiceShape
>()("VisualCommentsService") {}
export const makeVisualCommentsService = Effect.gen(function* () {
  const repo = yield* VisualCommentsRepository;
  return VisualCommentsService.of(repo);
});
