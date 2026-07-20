import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ChatRuntime } from "@byconvo/core/chats"
import { getCurrentRepo } from "../../../layers/workspace/current-repo.ts"
import {
  broadcastChatSnapshot,
  isTurnRunning,
  killChatRuntime,
  queueChatTurn,
  startChatTurn,
  stopChatTurn,
} from "./chat-runtime.ts"

export const liveLayer: Layer.Layer<ChatRuntime> = Layer.succeed(ChatRuntime)(
  ChatRuntime.of({
    isRunning: (chatId) => Effect.sync(() => isTurnRunning(chatId)),
    start: (chatId, text, images) =>
      Effect.sync(() => {
        const repoPath = getCurrentRepo()
        if (repoPath === null) return { ok: false, reason: "not-found" }
        return startChatTurn(repoPath, chatId, text, images)
      }),
    queue: (chatId, text, images) =>
      Effect.sync(() => {
        const repoPath = getCurrentRepo()
        if (repoPath === null) return { ok: false, reason: "not-found" }
        return queueChatTurn(repoPath, chatId, text, images)
      }),
    stop: (chatId) => Effect.sync(() => stopChatTurn(chatId)),
    kill: (chatId) => Effect.sync(() => killChatRuntime(chatId)),
    broadcastSnapshot: (chatId) =>
      Effect.sync(() => {
        const repoPath = getCurrentRepo()
        if (repoPath !== null) broadcastChatSnapshot(repoPath, chatId)
      }),
  })
)
