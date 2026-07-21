import * as Layer from "effect/Layer"
import { ChatsRepository, ChatsService, make } from "@byconvo/core/chats"
import { makeFileChatsRepository } from "./chats.repository.file.ts"
import { liveLayer as chatRuntimeLive } from "./chats.runtime.service.ts"

export const ChatsLive = Layer.effect(ChatsService)(make).pipe(
  Layer.provide(Layer.effect(ChatsRepository)(makeFileChatsRepository)),
  Layer.provide(chatRuntimeLive)
)
