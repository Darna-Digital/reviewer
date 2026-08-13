import * as Layer from "effect/Layer";
import {
  VisualCommentsRepository,
  VisualCommentsService,
  makeVisualCommentsService,
} from "@byconvo/core/visual-comments";
import { makeSqliteVisualCommentsRepository } from "./visual-comments.repository.sqlite.ts";

export const VisualCommentsLive = Layer.effect(VisualCommentsService)(
  makeVisualCommentsService
).pipe(
  Layer.provide(
    Layer.effect(VisualCommentsRepository)(makeSqliteVisualCommentsRepository)
  )
);
