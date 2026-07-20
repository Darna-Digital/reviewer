import * as Layer from "effect/Layer"
import { DocsRepository, DocsService, make } from "@byconvo/core/docs"
import { makeFileDocsRepository } from "../repository/docs.repository.file.ts"

export const DocsLive = Layer.effect(DocsService)(make).pipe(
  Layer.provide(Layer.effect(DocsRepository)(makeFileDocsRepository))
)
