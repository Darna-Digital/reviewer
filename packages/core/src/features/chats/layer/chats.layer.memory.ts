import * as Layer from "effect/Layer"
import { memoryLayer as terminalMemory } from "../../../ports/terminal-exec.ts"
import type { TerminalExec } from "../../../ports/terminal-exec.ts"
import { ChatsRepository } from "../repository/chats.repository.ts"
import { makeMemoryChatsRepository } from "../repository/chats.repository.memory.ts"
import { memoryChatRuntime } from "../runtime/chats.runtime.ts"
import { ChatsService, makeChatsService } from "../service/chats.service.ts"
import type { Chat } from "../schema/chats.schema.ts"

/**
 * `terminal` stands in for the agent CLIs the model catalog is discovered from
 * (see chats.service.ts). The default echoes the command back, which parses as
 * no models at all — so tests see the curated catalog unless they say otherwise.
 */
export const ChatsMemory = (
  seed: ReadonlyArray<Chat> = [],
  terminal: Layer.Layer<TerminalExec> = terminalMemory()
) => {
  const runtime = memoryChatRuntime()
  const layer = Layer.effect(ChatsService)(makeChatsService).pipe(
    Layer.provide(
      Layer.effect(ChatsRepository)(makeMemoryChatsRepository(seed))
    ),
    Layer.provide(runtime.layer),
    Layer.provide(terminal)
  )
  return { layer, runtime }
}
