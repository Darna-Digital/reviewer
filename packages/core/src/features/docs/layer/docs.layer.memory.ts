import * as Layer from "effect/Layer"
import { DocsRepository } from "../repository/docs.repository.ts"
import { makeMemoryDocsRepository } from "../repository/docs.repository.memory.ts"
import { DocsService, makeDocsService } from "../service/docs.service.ts"
import type { Doc } from "../schema/docs.schema.ts"

export const DocsMemory = (seed: ReadonlyArray<Doc> = []) =>
  Layer.effect(DocsService)(makeDocsService).pipe(
    Layer.provide(Layer.effect(DocsRepository)(makeMemoryDocsRepository(seed)))
  )
