import * as Layer from "effect/Layer"
import {
  GitMessageService,
  makeGitMessageService,
} from "../service/git-message.service.ts"

export const GitMessageMemory = () =>
  Layer.effect(GitMessageService)(makeGitMessageService)
