import * as Layer from "effect/Layer";
import {
  CommentsRepository,
  CommentsService,
  makeCommentsService,
} from "@reviewer/core/comments";
import { makeSqliteCommentsRepository } from "./comments.repository.sqlite.ts";

export const CommentsLive = Layer.effect(CommentsService)(
  makeCommentsService
).pipe(
  Layer.provide(Layer.effect(CommentsRepository)(makeSqliteCommentsRepository))
);
