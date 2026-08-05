import * as Layer from "effect/Layer";
import {
  ChatsRepository,
  ChatsService,
  makeChatsService,
} from "@byconvo/core/chats";
import { makeFileChatsRepository } from "./chats.repository.file.ts";
import { liveLayer as chatRuntimeLive } from "./chats.runtime.service.ts";

export const ChatsLive = Layer.effect(ChatsService)(makeChatsService).pipe(
  Layer.provide(Layer.effect(ChatsRepository)(makeFileChatsRepository)),
  Layer.provide(chatRuntimeLive)
);
