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
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import * as Schema from "effect/Schema"
import {
  Chat,
  type ChatActivity,
  type ChatMessage,
  type ChatTurn,
  DEFAULT_CHAT_TITLE,
  titleFromPrompt,
} from "@byconvo/core/chats"

const ChatsFile = Schema.Array(Chat)
const decodeChatsFile = Schema.decodeUnknownSync(ChatsFile)

const chatsPath = (repoPath: string) => `${repoPath}/.byconvo/chats.json`

// Module-scoped so ids stay unique across per-request repository instances.
let counter = 0
export const nextChatId = (prefix: string): string => {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}`
}

export const readChats = (repoPath: string): ReadonlyArray<Chat> => {
  try {
    const raw = readFileSync(chatsPath(repoPath), "utf8")
    return decodeChatsFile(JSON.parse(raw))
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return []
    }
    throw error
  }
}

/**
 * Write the whole file atomically. A turn rewrites this file on every activity
 * and every text flush, so a crash mid-write is not a rare case — and a torn
 * `chats.json` fails `decodeChatsFile` for *every* chat, not just the one being
 * written. Writing a sibling temp file and renaming it makes the swap atomic on
 * POSIX, so a reader only ever sees a complete file.
 */
export const writeChats = (
  repoPath: string,
  chats: ReadonlyArray<Chat>
): void => {
  mkdirSync(`${repoPath}/.byconvo`, { recursive: true })
  const target = chatsPath(repoPath)
  const temp = `${target}.${process.pid}.tmp`
  try {
    writeFileSync(temp, `${JSON.stringify(chats, null, 2)}\n`)
    renameSync(temp, target)
  } catch (error) {
    rmSync(temp, { force: true })
    throw error
  }
}

export const findChat = (repoPath: string, id: string): Chat | undefined =>
  readChats(repoPath).find((c) => c.id === id)

/** Apply `patch` to one chat and persist; returns the updated chat or
 * undefined when the id is gone (e.g. deleted mid-turn — the write is
 * dropped, never resurrected). */
export const patchChat = (
  repoPath: string,
  id: string,
  patch: (chat: Chat) => Chat
): Chat | undefined => {
  const chats = readChats(repoPath)
  const existing = chats.find((c) => c.id === id)
  if (existing === undefined) return undefined
  const updated = patch(existing)
  writeChats(
    repoPath,
    chats.map((c) => (c.id === id ? updated : c))
  )
  return updated
}

// --- Turn-progress mutations (used by the runtime while a turn streams) -----

export const appendTurnStart = (
  repoPath: string,
  chatId: string,
  input: {
    readonly turn: ChatTurn
    readonly userMessage: ChatMessage
    readonly assistantMessage: ChatMessage
  }
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({
    ...chat,
    // Name the chat after its first prompt (like t3code's title seed).
    title:
      chat.title === DEFAULT_CHAT_TITLE &&
      titleFromPrompt(input.userMessage.text).length > 0
        ? titleFromPrompt(input.userMessage.text)
        : chat.title,
    updatedAt: input.turn.startedAt,
    messages: [...chat.messages, input.userMessage, input.assistantMessage],
    latestTurn: input.turn,
  }))

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
  }))

/** Start a turn that consumes already-persisted pending messages: attach them
 * to the new turn (clearing their pending flag) and add the streaming assistant
 * placeholder. No new user message is created — the prompts already exist. */
export const startPendingTurn = (
  repoPath: string,
  chatId: string,
  input: {
    readonly turn: ChatTurn
    readonly assistantMessage: ChatMessage
    readonly consumeIds: ReadonlyArray<string>
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
  }))

export const appendActivity = (
  repoPath: string,
  chatId: string,
  activity: ChatActivity
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({
    ...chat,
    updatedAt: activity.createdAt,
    activities: [...chat.activities, activity],
  }))

/** Persist the assistant text streamed so far, leaving the message streaming.
 * Without this the reply only exists in the parser's closure, so a crash or a
 * kill mid-turn loses every token the user already watched arrive. */
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
  }))

/**
 * Settle every turn the file still calls "running" that no live process backs —
 * the residue of a server crash, a kill, or a quit mid-turn. Whatever text had
 * been flushed stays as the reply; the turn becomes `interrupted` so the
 * sidebar, the composer and the Stop button stop believing work is in flight.
 *
 * Runs over the whole file in one pass (and one write) rather than per-chat on
 * socket attach, so a chat the user never reopens is repaired too.
 */
export const settleStaleTurns = (
  repoPath: string,
  isLive: (chatId: string) => boolean,
  errorMessage: string
): ReadonlyArray<string> => {
  const chats = readChats(repoPath)
  const stale = chats.filter(
    (c) => c.latestTurn?.state === "running" && !isLive(c.id)
  )
  if (stale.length === 0) return []
  const endedAt = new Date().toISOString()
  const staleIds = new Set(stale.map((c) => c.id))
  writeChats(
    repoPath,
    chats.map((chat) =>
      staleIds.has(chat.id) && chat.latestTurn !== null
        ? {
            ...chat,
            // Every orphaned placeholder settles, not just the last one — two
            // can pile up when a crash is followed by another turn starting.
            messages: chat.messages.map((m) =>
              m.streaming ? { ...m, streaming: false } : m
            ),
            latestTurn: {
              ...chat.latestTurn,
              state: "interrupted" as const,
              endedAt,
              errorMessage,
            },
          }
        : chat
    )
  )
  return [...staleIds]
}

export const saveSessionId = (
  repoPath: string,
  chatId: string,
  sessionId: string
): Chat | undefined =>
  patchChat(repoPath, chatId, (chat) => ({ ...chat, sessionId }))

/** Settle a turn: final assistant text, streaming off, turn state persisted. */
export const completeTurn = (
  repoPath: string,
  chatId: string,
  input: {
    readonly turnId: string
    readonly assistantMessageId: string
    readonly text: string
    readonly state: ChatTurn["state"]
    readonly errorMessage: string | null
    readonly totalCostUsd: number | null
    readonly endedAt: string
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
  }))
