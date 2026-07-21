import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { ChatImageUpload } from "../schema/chats.schema.ts"

export interface StartTurnResult {
  readonly ok: boolean
  readonly reason?: "busy" | "not-found"
}
export interface ChatRuntimeShape {
  readonly isRunning: (chatId: string) => Effect.Effect<boolean>
  readonly start: (
    chatId: string,
    text: string,
    images: ReadonlyArray<ChatImageUpload>
  ) => Effect.Effect<StartTurnResult>
  readonly queue: (
    chatId: string,
    text: string,
    images: ReadonlyArray<ChatImageUpload>
  ) => Effect.Effect<StartTurnResult>
  readonly stop: (chatId: string) => Effect.Effect<boolean>
  readonly kill: (chatId: string) => Effect.Effect<void>
  readonly broadcastSnapshot: (chatId: string) => Effect.Effect<void>
}
export class ChatRuntime extends Context.Service<
  ChatRuntime,
  ChatRuntimeShape
>()("ChatRuntime") {}
export interface MemoryChatRuntime {
  readonly layer: Layer.Layer<ChatRuntime>
  readonly calls: {
    readonly start: Array<{
      chatId: string
      text: string
      images: ReadonlyArray<ChatImageUpload>
    }>
    readonly queue: Array<{
      chatId: string
      text: string
      images: ReadonlyArray<ChatImageUpload>
    }>
    readonly stop: string[]
    readonly kill: string[]
    readonly broadcastSnapshot: string[]
  }
  readonly state: {
    running: Set<string>
    startResult: StartTurnResult
  }
}
export const memoryChatRuntime = (): MemoryChatRuntime => {
  const calls: MemoryChatRuntime["calls"] = {
    start: [],
    queue: [],
    stop: [],
    kill: [],
    broadcastSnapshot: [],
  }
  const state: MemoryChatRuntime["state"] = {
    running: new Set(),
    startResult: { ok: true },
  }
  const layer = Layer.succeed(ChatRuntime)(
    ChatRuntime.of({
      isRunning: (chatId) => Effect.sync(() => state.running.has(chatId)),
      start: (chatId, text, images) =>
        Effect.sync(() => {
          calls.start.push({ chatId, text, images })
          return state.startResult
        }),
      queue: (chatId, text, images) =>
        Effect.sync(() => {
          calls.queue.push({ chatId, text, images })
          return state.startResult
        }),
      stop: (chatId) =>
        Effect.sync(() => {
          calls.stop.push(chatId)
          return state.running.delete(chatId)
        }),
      kill: (chatId) =>
        Effect.sync(() => {
          calls.kill.push(chatId)
          state.running.delete(chatId)
        }),
      broadcastSnapshot: (chatId) =>
        Effect.sync(() => {
          calls.broadcastSnapshot.push(chatId)
        }),
    })
  )
  return { layer, calls, state }
}
