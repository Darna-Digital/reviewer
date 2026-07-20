import * as Layer from "effect/Layer"
import { GitMessageService, make } from "../service/git-message.service.ts"

export const GitMessageMemory = () => Layer.effect(GitMessageService)(make)
