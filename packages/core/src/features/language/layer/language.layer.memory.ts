import * as Layer from "effect/Layer"
import {
  LanguageRepository,
  type LanguageRepo,
} from "../repository/language.repository.ts"
import {
  makeMemoryLanguageRepository,
  type MemoryLanguageSeed,
} from "../repository/language.repository.memory.ts"
import {
  LanguageService,
  makeLanguageService,
} from "../service/language.service.ts"

export const LanguageMemory = (
  seed: MemoryLanguageSeed = {}
): Layer.Layer<LanguageService> =>
  Layer.effect(LanguageService)(makeLanguageService).pipe(
    Layer.provide(
      Layer.effect(LanguageRepository)(makeMemoryLanguageRepository(seed))
    )
  )

/** Wrap a hand-built repository — used by tests that need failure behaviour. */
export const LanguageFrom = (
  repo: LanguageRepo
): Layer.Layer<LanguageService> =>
  Layer.effect(LanguageService)(makeLanguageService).pipe(
    Layer.provide(Layer.succeed(LanguageRepository)(repo))
  )
