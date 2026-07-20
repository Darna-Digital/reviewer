import * as Layer from "effect/Layer"
import { DocsRepository } from "./docs.repository.ts"
import { makeMemoryDocsRepository } from "./docs.repository.memory.ts"
import { DocsService, make } from "./docs.service.ts"

export const DocsMemory = (
  seed: ReadonlyArray<{
    id: string
    content: string
  }> = []
) =>
  Layer.effect(DocsService)(make).pipe(
    Layer.provide(Layer.effect(DocsRepository)(makeMemoryDocsRepository(seed)))
  )
