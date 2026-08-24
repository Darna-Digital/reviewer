import * as Layer from "effect/Layer";
import {
  FormattingRepository,
  FormattingService,
  makeFormattingService,
} from "@byconvo/core/formatting";
import { makeLivePrettierRepository } from "./formatting.repository.live.ts";

export const FormattingLive = Layer.effect(FormattingService)(
  makeFormattingService
).pipe(
  Layer.provide(Layer.effect(FormattingRepository)(makeLivePrettierRepository))
);
