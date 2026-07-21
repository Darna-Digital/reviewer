import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { NotFound } from "../../../shared.ts"
import { ChatBusy } from "../errors.ts"
import { CHAT_MODEL_CATALOG } from "../functions/chats.catalog.ts"
import {
  ChatsRepository,
  type ChatsFailure,
  type ChatsRepo,
} from "../repository/chats.repository.ts"
import { ChatRuntime } from "../runtime/chats.runtime.ts"
import type {
  Chat,
  ChatModelCatalog,
  ChatImageUpload,
} from "../schema/chats.schema.ts"

export interface ChatsServiceShape extends ChatsRepo {
  readonly send: (
    id: string,
    text: string,
    images: ReadonlyArray<ChatImageUpload>
  ) => Effect.Effect<Chat, ChatsFailure>
  readonly stop: (id: string) => Effect.Effect<
    {
      readonly ok: boolean
    },
    ChatsFailure
  >
  readonly models: Effect.Effect<ChatModelCatalog>
}
export class ChatsService extends Context.Service<
  ChatsService,
  ChatsServiceShape
>()("ChatsService") {}
export const makeChatsService = Effect.gen(function* () {
  const repo = yield* ChatsRepository
  const runtime = yield* ChatRuntime
  const send: ChatsServiceShape["send"] = (id, text, images) =>
    Effect.gen(function* () {
      const prompt = text.trim()
      const chat = yield* repo.get(id)
      if (prompt.length === 0 && images.length === 0) return chat
      if (yield* runtime.isRunning(id)) {
        const queued = yield* runtime.queue(id, prompt, images)
        if (!queued.ok) {
          return yield* Effect.fail(
            new NotFound({ reason: `chat ${id} not found` })
          )
        }
        return yield* repo.get(id)
      }
      const result = yield* runtime.start(id, prompt, images)
      if (!result.ok) {
        return yield* Effect.fail(
          result.reason === "busy"
            ? new ChatBusy({ chatId: id })
            : new NotFound({ reason: `chat ${id} not found` })
        )
      }
      return yield* repo.get(id)
    })
  const stop: ChatsServiceShape["stop"] = (id) =>
    Effect.gen(function* () {
      yield* repo.get(id)
      const ran = yield* runtime.stop(id)
      return { ok: ran }
    })
  const remove: ChatsServiceShape["remove"] = (id) =>
    Effect.flatMap(repo.remove(id), () => runtime.kill(id))
  const update: ChatsServiceShape["update"] = (id, input) =>
    Effect.tap(repo.update(id, input), () => runtime.broadcastSnapshot(id))
  return ChatsService.of({
    ...repo,
    update,
    remove,
    send,
    stop,
    models: Effect.succeed(CHAT_MODEL_CATALOG),
  })
})
