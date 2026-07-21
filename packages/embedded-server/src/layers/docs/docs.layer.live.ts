import * as Layer from "effect/Layer"
import { DocsRepository, DocsService, makeDocsService } from "@byconvo/core"
import { makeFileDocsRepository } from "./docs.repository.file.ts"

export const DocsLive = Layer.effect(DocsService)(makeDocsService).pipe(
  Layer.provide(Layer.effect(DocsRepository)(makeFileDocsRepository))
)
