import * as Layer from "effect/Layer";
import {
  LanguageRepository,
  LanguageService,
  makeLanguageService,
} from "@reviewer/core/language";
import { makeLiveLanguageRepository } from "./language.repository.live.ts";

export const LanguageLive = Layer.effect(LanguageService)(
  makeLanguageService
).pipe(
  Layer.provide(Layer.effect(LanguageRepository)(makeLiveLanguageRepository))
);
