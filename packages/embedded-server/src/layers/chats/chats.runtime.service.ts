import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ChatRuntime } from "@reviewer/core/chats";
import {
  broadcastChatSnapshot,
  isTurnRunning,
  killChatRuntime,
  queueChatTurn,
  repairStaleTurns,
  startChatTurn,
  stopChatTurn,
} from "./chat-runtime.ts";

/**
 * Nothing here asks which repository is selected: chats are stored centrally
 * and each one knows the root its agent runs in, so a turn started from the
 * sessions list works whichever project the user is looking at.
 */
export const liveLayer: Layer.Layer<ChatRuntime> = Layer.succeed(ChatRuntime)(
  ChatRuntime.of({
    isRunning: (chatId) => Effect.sync(() => isTurnRunning(chatId)),
    start: (chatId, text, images) =>
      Effect.sync(() => startChatTurn(chatId, text, images)),
    queue: (chatId, text, images) =>
      Effect.sync(() => queueChatTurn(chatId, text, images)),
    stop: (chatId) => Effect.sync(() => stopChatTurn(chatId)),
    kill: (chatId) => Effect.sync(() => killChatRuntime(chatId)),
    broadcastSnapshot: (chatId) =>
      Effect.sync(() => broadcastChatSnapshot(chatId)),
    repairStale: Effect.sync(repairStaleTurns),
  })
);
