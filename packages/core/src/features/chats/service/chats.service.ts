import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { NotFound } from "../../../shared.ts";
import { TerminalExec } from "../../../ports/terminal-exec.ts";
import { ChatBusy } from "../errors.ts";
import { CHAT_PROVIDER_KINDS } from "../functions/chats.catalog.ts";
import {
  mergeDiscoveredModels,
  modelDiscoveryCommand,
  parseDiscoveredModels,
} from "../functions/model-discovery.ts";
import {
  ChatsRepository,
  type ChatsFailure,
  type ChatsRepo,
} from "../repository/chats.repository.ts";
import { ChatRuntime } from "../runtime/chats.runtime.ts";
import type {
  Chat,
  ChatModel,
  ChatModelCatalog,
  ChatImageUpload,
  ChatProviderKind,
} from "../schema/chats.schema.ts";

/**
 * How long a provider's model list is trusted. Long, because it only changes
 * when the developer upgrades that CLI, and every refresh costs a subprocess.
 */
const MODELS_TTL_MS = 60 * 60 * 1000;

/**
 * How long an *empty* answer is trusted, which is far shorter. An agent that
 * reported nothing is usually one that was still cold or lost the race with the
 * timeout, and remembering that for an hour turns a momentary miss into a rail
 * the developer can only fix by restarting byconvo.
 */
const EMPTY_MODELS_TTL_MS = 60 * 1000;

/**
 * How long one CLI gets to answer. Generous, because discovery reaches the CLI
 * through the developer's login shell — rc files and version managers run first
 * — and nothing waits on the result: until it lands, chats run on the agent's
 * own default model.
 */
const DISCOVERY_TIMEOUT_MS = 20_000;

export interface ChatsServiceShape extends ChatsRepo {
  readonly send: (
    id: string,
    text: string,
    images: ReadonlyArray<ChatImageUpload>
  ) => Effect.Effect<Chat, ChatsFailure>;
  readonly stop: (id: string) => Effect.Effect<
    {
      readonly ok: boolean;
    },
    ChatsFailure
  >;
  readonly models: Effect.Effect<ChatModelCatalog>;
}
export class ChatsService extends Context.Service<
  ChatsService,
  ChatsServiceShape
>()("ChatsService") {}
export const makeChatsService = Effect.gen(function* () {
  const repo = yield* ChatsRepository;
  const runtime = yield* ChatRuntime;
  const terminal = yield* TerminalExec;

  /**
   * Ask one CLI what it can run. Every failure — not installed, too slow, an
   * answer we don't recognise — is an empty list, so one broken agent can't
   * take the other rails down with it.
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
    );

  /** What each CLI last answered, and when. Per server process — a restart just
   * means one more round of discovery. */
  const answers = new Map<
    ChatProviderKind,
    { models: ReadonlyArray<ChatModel>; atMs: number }
  >();

  const remembered = (
    provider: ChatProviderKind,
    nowMs: number
  ): ReadonlyArray<ChatModel> | null => {
    const answer = answers.get(provider);
    if (answer === undefined) return null;
    const ttl = answer.models.length > 0 ? MODELS_TTL_MS : EMPTY_MODELS_TTL_MS;
    return nowMs - answer.atMs < ttl ? answer.models : null;
  };

  const modelsFor = (
    provider: ChatProviderKind,
    nowMs: number
  ): Effect.Effect<ReadonlyArray<ChatModel>> => {
    const answer = remembered(provider, nowMs);
    if (answer !== null) return Effect.succeed(answer);
    return Effect.map(discoverProvider(provider), (models) => {
      answers.set(provider, { models, atMs: nowMs });
      return models;
    });
  };

  const models: ChatsServiceShape["models"] = Effect.suspend(() => {
    const nowMs = Date.now();
    return Effect.map(
      Effect.forEach(CHAT_PROVIDER_KINDS, (p) => modelsFor(p, nowMs), {
        // The CLIs don't contend for anything, so the slowest one sets the pace
        // instead of the sum of all four.
        concurrency: "unbounded",
      }),
      (lists) =>
        mergeDiscoveredModels(
          new Map(CHAT_PROVIDER_KINDS.map((p, i) => [p, lists[i] ?? []]))
        )
    );
  });
  const send: ChatsServiceShape["send"] = (id, text, images) =>
    Effect.gen(function* () {
      const prompt = text.trim();
      const chat = yield* repo.get(id);
      if (prompt.length === 0 && images.length === 0) return chat;
      if (yield* runtime.isRunning(id)) {
        const queued = yield* runtime.queue(id, prompt, images);
        if (!queued.ok) {
          return yield* Effect.fail(
            new NotFound({ reason: `chat ${id} not found` })
          );
        }
        return yield* repo.get(id);
      }
      const result = yield* runtime.start(id, prompt, images);
      if (!result.ok) {
        return yield* Effect.fail(
          result.reason === "busy"
            ? new ChatBusy({ chatId: id })
            : new NotFound({ reason: `chat ${id} not found` })
        );
      }
      return yield* repo.get(id);
    });
  // Reading the list is the one call every client makes on load, which makes it
  // the reliable place to settle turns a crash left "running" — the sidebar
  // then can't show a spinner for work that ended when the process died.
  const list: ChatsRepo["list"] = (input) =>
    Effect.flatMap(runtime.repairStale, () => repo.list(input));
  const stop: ChatsServiceShape["stop"] = (id) =>
    Effect.gen(function* () {
      yield* repo.get(id);
      const ran = yield* runtime.stop(id);
      return { ok: ran };
    });
  const remove: ChatsServiceShape["remove"] = (id) =>
    Effect.flatMap(repo.remove(id), () => runtime.kill(id));
  const update: ChatsServiceShape["update"] = (id, input) =>
    Effect.tap(repo.update(id, input), () => runtime.broadcastSnapshot(id));
  return ChatsService.of({
    ...repo,
    list,
    update,
    remove,
    send,
    stop,
    models,
  });
});
