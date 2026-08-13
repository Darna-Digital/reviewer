import * as Layer from "effect/Layer";
import {
  ChatsRepository,
  ChatsService,
  makeChatsService,
} from "@byconvo/core/chats";
import { makeSqliteChatsRepository } from "./chats.repository.sqlite.ts";
import { liveLayer as chatRuntimeLive } from "./chats.runtime.service.ts";

export const ChatsLive = Layer.effect(ChatsService)(makeChatsService).pipe(
  Layer.provide(Layer.effect(ChatsRepository)(makeSqliteChatsRepository)),
  Layer.provide(chatRuntimeLive)
);
