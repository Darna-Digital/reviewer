import * as Layer from "effect/Layer"
import { ChatsRepository } from "./chats.repository.ts"
import { makeMemoryChatsRepository } from "./chats.repository.memory.ts"
import { memoryChatRuntime } from "./chats.runtime.ts"
import { ChatsService, make } from "./chats.service.ts"
import type { Chat } from "./chats.schema.ts"

export const ChatsMemory = (seed: ReadonlyArray<Chat> = []) => {
  const runtime = memoryChatRuntime()
  const layer = Layer.effect(ChatsService)(make).pipe(
    Layer.provide(
      Layer.effect(ChatsRepository)(makeMemoryChatsRepository(seed))
    ),
    Layer.provide(runtime.layer)
  )
  return { layer, runtime }
}
