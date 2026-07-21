import * as Layer from "effect/Layer"
import { GitMessageService, makeGitMessageService } from "@byconvo/core"

// GitExec and TerminalExec are global singletons (InfraLive), so the live
// service needs no extra wiring of its own.
export const GitMessageLive = Layer.effect(GitMessageService)(
  makeGitMessageService
)
