import * as Layer from "effect/Layer";
import { VisualCommentsRepository } from "../repository/visual-comments.repository.ts";
import { makeMemoryVisualCommentsRepository } from "../repository/visual-comments.repository.memory.ts";
import {
  VisualCommentsService,
  makeVisualCommentsService,
} from "../service/visual-comments.service.ts";
import type { VisualComment } from "../schema/visual-comments.schema.ts";

export const VisualCommentsMemory = (seed: ReadonlyArray<VisualComment> = []) =>
  Layer.effect(VisualCommentsService)(makeVisualCommentsService).pipe(
    Layer.provide(
      Layer.effect(VisualCommentsRepository)(
        makeMemoryVisualCommentsRepository(seed)
      )
    )
  );
