import * as Layer from "effect/Layer";
import {
  VisualCommentsRepository,
  VisualCommentsService,
  makeVisualCommentsService,
} from "@byconvo/core/visual-comments";
import { makeFileVisualCommentsRepository } from "./visual-comments.repository.file.ts";

export const VisualCommentsLive = Layer.effect(VisualCommentsService)(
  makeVisualCommentsService
).pipe(
  Layer.provide(
    Layer.effect(VisualCommentsRepository)(makeFileVisualCommentsRepository)
  )
);
