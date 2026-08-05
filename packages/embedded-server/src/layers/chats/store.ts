/**
 * Plain-fs chat store — the single reader/writer for `.byconvo/chats.json`.
 *
 * Two very different callers share it, which is why it is framework-free:
 * the Effect repository (per-request CRUD) and the chat turn runtime, which
 * runs outside the Effect runtime (spawned processes + the chat WebSocket are
 * wired straight onto Node, like the PTY sessions) and must persist progress
 * as a turn streams. Keeping every mutation here means there is exactly one
 * shape of the file, whichever side writes.
 */
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import * as Schema from "effect/Schema";
import {
  Chat,
  type ChatActivity,
  type ChatMessage,
  type ChatTurn,
  DEFAULT_CHAT_TITLE,
  titleFromPrompt,
} from "@byconvo/core/chats";

const ChatsFile = Schema.Array(Chat);
const decodeChatsFile = Schema.decodeUnknownSync(ChatsFile);

const chatsPath = (repoPath: string) => `${repoPath}/.byconvo/chats.json`;

export const nextChatId = (prefix: string): string =>
  `${prefix}-${randomUUID()}`;

export const readChats = (repoPath: string): ReadonlyArray<Chat> => {
  try {
    const raw = readFileSync(chatsPath(repoPath), "utf8");
    return decodeChatsFile(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

/**
 * A torn `chats.json` fails to decode for *every* chat, and a streaming turn
 * rewrites this file constantly — so readers only ever see a whole file:
 * written beside the target, then swapped in by an atomic rename.
 */
export const writeChats = (
  repoPath: string,
  chats: ReadonlyArray<Chat>
): void => {
  mkdirSync(`${repoPath}/.byconvo`, { recursive: true });
  const target = chatsPath(repoPath);
  const beside = `${target}.${process.pid}.tmp`;
  try {
    writeFileSync(beside, `${JSON.stringify(chats, null, 2)}\n`);
    renameSync(beside, target);
  } catch (error) {
    rmSync(beside, { force: true });
    throw error;
  }
};

export const findChat = (repoPath: string, id: string): Chat | undefined =>
  readChats(repoPath).find((c) => c.id === id);

/** Apply `patch` to one chat and persist; returns the updated chat or
 * undefined when the id is gone (e.g. deleted mid-turn — the write is
 * dropped, never resurrected). */
export const patchChat = (
  repoPath: string,
  id: string,
  patch: (chat: Chat) => Chat
): Chat | undefined => {
  const chats = readChats(repoPath);
  const existing = chats.find((c) => c.id === id);
  if (existing === undefined) return undefined;
  const updated = patch(existing);
  writeChats(
    repoPath,
    chats.map((c) => (c.id === id ? updated : c))
  );
  return updated;
};

// --- Turn-progress mutations (used by the runtime while a turn streams) -----

const titleFromFirstPrompt = (current: string, prompt: string): string => {
  if (current !== DEFAULT_CHAT_TITLE) return current;
  const seeded = titleFromPrompt(prompt);
  return seeded.length > 0 ? seeded : current;
};

export const appendTurnStart = (
  repoPath: string,
  chatId: string,
  input: {
    readonly turn: ChatTurn;
    readonly userMessage: ChatMessage;
    readonly assistantMessage: ChatMessage;
  }
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({
    ...chat,
    title: titleFromFirstPrompt(chat.title, input.userMessage.text),
    updatedAt: input.turn.startedAt,
    messages: [...chat.messages, input.userMessage, input.assistantMessage],
    latestTurn: input.turn,
  }));

/** Append a user message queued while a turn was running. It shows in the
 * timeline immediately (marked pending) and is picked up by the next turn. */
export const appendPendingMessage = (
  repoPath: string,
  chatId: string,
  userMessage: ChatMessage
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({
    ...chat,
    updatedAt: userMessage.createdAt,
    messages: [...chat.messages, userMessage],
  }));

/** Start a turn that consumes already-persisted pending messages: attach them
 * to the new turn (clearing their pending flag) and add the streaming assistant
 * placeholder. No new user message is created — the prompts already exist. */
export const startPendingTurn = (
  repoPath: string,
  chatId: string,
  input: {
    readonly turn: ChatTurn;
    readonly assistantMessage: ChatMessage;
    readonly consumeIds: ReadonlyArray<string>;
  }
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({
    ...chat,
    updatedAt: input.turn.startedAt,
    messages: [
      ...chat.messages.map((m) =>
        input.consumeIds.includes(m.id)
          ? { ...m, pending: false, turnId: input.turn.id }
          : m
      ),
      input.assistantMessage,
    ],
    latestTurn: input.turn,
  }));

export const appendActivity = (
  repoPath: string,
  chatId: string,
  activity: ChatActivity
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({
    ...chat,
    updatedAt: activity.createdAt,
    activities: [...chat.activities, activity],
  }));

/** Until this lands, the reply exists only in the parser's closure — a crash
 * loses every token the user already watched arrive. */
export const saveStreamingText = (
  repoPath: string,
  chatId: string,
  messageId: string,
  text: string
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({
    ...chat,
    messages: chat.messages.map((m) =>
      m.id === messageId ? { ...m, text } : m
    ),
  }));

const asInterrupted = (
  chat: Chat,
  endedAt: string,
  errorMessage: string
): Chat =>
  chat.latestTurn === null
    ? chat
    : {
        ...chat,
        messages: chat.messages.map((message) =>
          message.streaming ? { ...message, streaming: false } : message
        ),
        latestTurn: {
          ...chat.latestTurn,
          state: "interrupted" as const,
          endedAt,
          errorMessage,
        },
      };

/**
 * Whatever text was flushed stays as the reply; the turn becomes `interrupted`
 * so the sidebar, the composer and the Stop button stop believing work is in
 * flight. One pass over the whole file repairs chats the user never reopens.
 */
export const settleStaleTurns = (
  repoPath: string,
  isLive: (chatId: string) => boolean,
  errorMessage: string
): ReadonlyArray<string> => {
  const chats = readChats(repoPath);
  const staleIds = new Set(
    chats
      .filter(
        (chat) => chat.latestTurn?.state === "running" && !isLive(chat.id)
      )
      .map((chat) => chat.id)
  );
  if (staleIds.size === 0) return [];
  const endedAt = new Date().toISOString();
  writeChats(
    repoPath,
    chats.map((chat) =>
      staleIds.has(chat.id) ? asInterrupted(chat, endedAt, errorMessage) : chat
    )
  );
  return [...staleIds];
};

export const saveSessionId = (
  repoPath: string,
  chatId: string,
  sessionId: string
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({ ...chat, sessionId }));

/** Settle a turn: final assistant text, streaming off, turn state persisted. */
export const completeTurn = (
  repoPath: string,
  chatId: string,
  input: {
    readonly turnId: string;
    readonly assistantMessageId: string;
    readonly text: string;
    readonly state: ChatTurn["state"];
    readonly errorMessage: string | null;
    readonly totalCostUsd: number | null;
    readonly endedAt: string;
  }
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({
    ...chat,
    updatedAt: input.endedAt,
    messages: chat.messages.map((m) =>
      m.id === input.assistantMessageId
        ? { ...m, text: input.text, streaming: false }
        : m
    ),
    latestTurn:
      chat.latestTurn !== null && chat.latestTurn.id === input.turnId
        ? {
            ...chat.latestTurn,
            state: input.state,
            endedAt: input.endedAt,
            errorMessage: input.errorMessage,
            totalCostUsd: input.totalCostUsd,
          }
        : chat.latestTurn,
  }));
