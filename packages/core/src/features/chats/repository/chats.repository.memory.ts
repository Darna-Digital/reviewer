import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import { NotFound } from "../../../shared.ts";
import type { Chat, ChatOrigin } from "../schema/chats.schema.ts";
import {
  DEFAULT_CHAT_TITLE,
  summarizeChat,
} from "../functions/chats.functions.ts";
import {
  byRecency,
  decodeChatCursor,
  encodeChatCursor,
  isAfterCursor,
  matchesChatFilters,
} from "../functions/chats.paging.ts";
import type {
  ChatsRepo,
  CreateChatInput,
  ListChatsInput,
  UpdateChatInput,
} from "./chats.repository.ts";

/** The single project an in-memory repository pretends to hold. */
export const MEMORY_CHAT_ORIGIN: ChatOrigin = {
  projectPath: "/memory",
  projectName: "memory",
  repoPath: "/memory",
  repoName: "memory",
};

export const makeMemoryChatsRepository = (seed: ReadonlyArray<Chat> = []) =>
  Effect.gen(function* () {
    const store = yield* Ref.make<ReadonlyArray<Chat>>([...seed]);
    let counter = 0;
    const nextId = (prefix: string) => {
      counter += 1;
      return `${prefix}-mem-${counter}`;
    };
    const now = () => "2026-01-01T00:00:00.000Z";
    const find = (chats: ReadonlyArray<Chat>, id: string) => {
      const chat = chats.find((c) => c.id === id);
      if (chat === undefined) {
        return Effect.fail(new NotFound({ reason: `chat ${id} not found` }));
      }
      return Effect.succeed(chat);
    };
    const summaries = Ref.get(store).pipe(
      Effect.map((chats) => chats.map(summarizeChat).sort(byRecency))
    );
    const repo: ChatsRepo = {
      list: (input: ListChatsInput) =>
        Effect.map(summaries, (all) => {
          const position = decodeChatCursor(input.cursor);
          const matching = all.filter(
            (chat) =>
              matchesChatFilters(chat, input) &&
              (position === null || isAfterCursor(chat, position))
          );
          const items = matching.slice(0, input.limit);
          const last = items[items.length - 1];
          return {
            items,
            nextCursor:
              last === undefined || matching.length <= input.limit
                ? null
                : encodeChatCursor(last),
          };
        }),
      projects: Effect.map(summaries, (all) => {
        const tallies = new Map<string, { name: string; count: number }>();
        for (const chat of all) {
          const seen = tallies.get(chat.origin.projectPath);
          tallies.set(chat.origin.projectPath, {
            name: chat.origin.projectName,
            count: (seen?.count ?? 0) + 1,
          });
        }
        return [...tallies]
          .map(([path, tally]) => ({ path, ...tally }))
          .sort(
            (a, b) =>
              a.name.localeCompare(b.name) || a.path.localeCompare(b.path)
          );
      }),
      get: (id) => Effect.flatMap(Ref.get(store), (chats) => find(chats, id)),
      create: (input: CreateChatInput) =>
        Effect.gen(function* () {
          const created: Chat = {
            id: nextId("c"),
            origin: MEMORY_CHAT_ORIGIN,
            title:
              input.title.trim().length > 0
                ? input.title.trim()
                : DEFAULT_CHAT_TITLE,
            provider: input.provider,
            model: input.model,
            effort: input.effort,
            access: input.access,
            branch: input.branch,
            sessionId: null,
            createdAt: now(),
            updatedAt: now(),
            seenAt: now(),
            messages: [],
            activities: [],
            latestTurn: null,
          };
          yield* Ref.update(store, (all) => [created, ...all]);
          return created;
        }),
      update: (id, input: UpdateChatInput) =>
        Effect.gen(function* () {
          const existing = yield* find(yield* Ref.get(store), id);
          const provider = input.provider ?? existing.provider;
          const providerChanged = provider !== existing.provider;
          const updated: Chat = {
            ...existing,
            title:
              input.title !== undefined && input.title.trim().length > 0
                ? input.title.trim()
                : existing.title,
            provider,
            model: input.model ?? (providerChanged ? "" : existing.model),
            effort: input.effort ?? existing.effort,
            access: input.access ?? existing.access,
            sessionId: providerChanged ? null : existing.sessionId,
            updatedAt: now(),
          };
          yield* Ref.update(store, (all) =>
            all.map((c) => (c.id === id ? updated : c))
          );
          return updated;
        }),
      remove: (id) =>
        Ref.update(store, (all) => all.filter((c) => c.id !== id)),
      markSeen: (id) =>
        Effect.gen(function* () {
          yield* find(yield* Ref.get(store), id);
          yield* Ref.update(store, (all) =>
            all.map((c) => (c.id === id ? { ...c, seenAt: now() } : c))
          );
        }),
    };
    return repo;
  });
