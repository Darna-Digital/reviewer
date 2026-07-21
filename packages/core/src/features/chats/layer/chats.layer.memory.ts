import * as Layer from "effect/Layer"
import { ChatsRepository } from "../repository/chats.repository.ts"
import { makeMemoryChatsRepository } from "../repository/chats.repository.memory.ts"
import { memoryChatRuntime } from "../runtime/chats.runtime.ts"
import { ChatsService, makeChatsService } from "../service/chats.service.ts"
import type { Chat } from "../schema/chats.schema.ts"

export const ChatsMemory = (seed: ReadonlyArray<Chat> = []) => {
  const runtime = memoryChatRuntime()
  const layer = Layer.effect(ChatsService)(makeChatsService).pipe(
    Layer.provide(
      Layer.effect(ChatsRepository)(makeMemoryChatsRepository(seed))
    ),
    Layer.provide(runtime.layer)
  )
  return { layer, runtime }
}
