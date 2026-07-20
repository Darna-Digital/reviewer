import * as Layer from "effect/Layer"
import { GitMessageService, make } from "./git-message.service.ts"

export const GitMessageMemory = () => Layer.effect(GitMessageService)(make)
