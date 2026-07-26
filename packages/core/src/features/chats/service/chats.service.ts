import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { NotFound } from "../../../shared.ts"
import { TerminalExec } from "../../../ports/terminal-exec.ts"
import { ChatBusy } from "../errors.ts"
import { CHAT_PROVIDER_KINDS } from "../functions/chats.catalog.ts"
import {
  mergeDiscoveredModels,
  modelDiscoveryCommand,
  parseDiscoveredModels,
} from "../functions/model-discovery.ts"
import {
  ChatsRepository,
  type ChatsFailure,
  type ChatsRepo,
} from "../repository/chats.repository.ts"
import { ChatRuntime } from "../runtime/chats.runtime.ts"
import type {
  Chat,
  ChatModel,
  ChatModelCatalog,
  ChatImageUpload,
  ChatProviderKind,
} from "../schema/chats.schema.ts"

/**
 * How long a discovered catalog is trusted. Long, because the answer only
 * changes when the developer upgrades a CLI, and every refresh costs four
 * subprocesses.
 */
const CATALOG_TTL_MS = 60 * 60 * 1000

/**
 * How long one CLI gets to answer. A model list is never worth making the
 * composer wait: past this the curated entries stand in, and the next refresh
 * tries again.
 */
const DISCOVERY_TIMEOUT_MS = 5000

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
  const terminal = yield* TerminalExec

  /**
   * Ask one CLI what it can run. Every failure — not installed, too slow, an
   * answer we don't recognise — is an empty list, which the merge reads as
   * "keep this provider's curated models".
   */
  const discoverProvider = (
    provider: ChatProviderKind
  ): Effect.Effect<ReadonlyArray<ChatModel>> =>
    terminal.run(modelDiscoveryCommand(provider)).pipe(
      Effect.map((result) =>
        result.exitCode === 0
          ? parseDiscoveredModels(provider, result.stdout)
          : []
      ),
      Effect.timeoutOrElse({
        duration: DISCOVERY_TIMEOUT_MS,
        orElse: () => Effect.succeed<ReadonlyArray<ChatModel>>([]),
      }),
      Effect.orElseSucceed(() => [] as ReadonlyArray<ChatModel>)
    )

  const discoverCatalog = Effect.map(
    Effect.forEach(CHAT_PROVIDER_KINDS, discoverProvider, {
      // The CLIs don't contend for anything, so the slowest one sets the pace
      // instead of the sum of all four.
      concurrency: "unbounded",
    }),
    (lists) =>
      mergeDiscoveredModels(
        new Map(CHAT_PROVIDER_KINDS.map((p, i) => [p, lists[i] ?? []]))
      )
  )

  /** The last catalog we built, and when. Per server process — a restart just
   * means one more round of discovery. */
  let cached: { catalog: ChatModelCatalog; atMs: number } | null = null

  const models: ChatsServiceShape["models"] = Effect.suspend(() => {
    const now = Date.now()
    if (cached !== null && now - cached.atMs < CATALOG_TTL_MS) {
      return Effect.succeed(cached.catalog)
    }
    return Effect.map(discoverCatalog, (catalog) => {
      cached = { catalog, atMs: now }
      return catalog
    })
  })
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
  // Reading the list is the one call every client makes on load, which makes it
  // the reliable place to settle turns a crash left "running" — the sidebar
  // then can't show a spinner for work that ended when the process died.
  const list: ChatsRepo["list"] = Effect.flatMap(
    runtime.repairStale,
    () => repo.list
  )
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
    list,
    update,
    remove,
    send,
    stop,
    models,
  })
})
