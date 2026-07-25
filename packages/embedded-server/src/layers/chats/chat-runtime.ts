/**
 * Chat turn runtime — owns the live agent processes and the chat WebSocket.
 *
 * Like the PTY sessions and the Local Dev process manager, this lives outside
 * the Effect runtime: a turn is a long-lived child process whose stream must
 * keep flowing (and be persisted) whether or not any request — or any socket —
 * is around. The Effect service layer calls in through plain functions.
 *
 * One turn at a time per chat. A turn spawns the provider CLI (see
 * providers.ts), feeds the prompt through stdin, parses stdout NDJSON into
 * canonical events (claude-stream.ts), persists progress through the shared
 * store, and broadcasts wire events to every socket watching the chat:
 *
 *   server → client: { snapshot: Chat }                        // on connect
 *                    { event: { type: "turn-started", chat } }
 *                    { event: { type: "delta", messageId, text } }
 *                    { event: { type: "activity", activity } }
 *                    { event: { type: "turn-completed", turn, messageId, text } }
 *                    { error: string }                          // then close
 */
import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import type { IncomingMessage } from "node:http"
import type { WebSocket } from "ws"
import { recentAgentSessions } from "../terminal/agent-session-capture.ts"
import { saveDroppedImage } from "../terminal/dropped-image.ts"
import {
  getCurrentRepo,
  onCurrentRepoChange,
} from "../workspace/current-repo.ts"
import {
  chatTurnProgram,
  withAttachedImages,
  withHistory,
  type ChatTurnSession,
} from "./providers.ts"
import type {
  Chat,
  ChatActivity,
  ChatAttachment,
  ChatImageUpload,
  ChatMessage,
  ChatTurn,
  ChatWireEvent,
  StartTurnResult,
} from "@byconvo/core/chats"
import {
  appendActivity,
  appendPendingMessage,
  appendTurnStart,
  completeTurn,
  findChat,
  nextChatId,
  saveSessionId,
  saveStreamingText,
  settleStaleTurns,
  startPendingTurn,
} from "./store.ts"
import { CLAUDE_LOGIN_HINT, isClaudeAuthError } from "./claude-stream.ts"
import {
  createTurnParser,
  type TurnEvent,
  type TurnParser,
} from "./turn-parser.ts"

export const CHAT_STREAM_PATH = "/api/chats/stream"

interface LiveTurn {
  readonly chatId: string
  readonly turnId: string
  readonly assistantMessageId: string
  /** Captured at start so a mid-turn repo switch still persists correctly. */
  readonly repoPath: string
  readonly provider: Chat["provider"]
  /** Spawn time — the floor for scanning freshly-minted CLI session files. */
  readonly startedAtMs: number
  readonly child: ChildProcess
  readonly parser: TurnParser
  /** Result seen on the stream (settles the turn even if exit is unclean). */
  result: Extract<TurnEvent, { type: "result" }> | null
  stderr: string
  interrupted: boolean
  finalized: boolean
  /** Assistant text already written to disk, so a flush that would rewrite the
   * same 2 MB file with identical content is skipped. */
  flushedText: string
  flushTimer: ReturnType<typeof setTimeout> | null
}

const liveTurns = new Map<string, LiveTurn>()
/** Sockets watching a chat (with or without a running turn), by chat id. */
const watchers = new Map<string, Set<WebSocket>>()
/** Temp image paths for messages queued while a turn ran, by message id. The
 * decoded bytes aren't persisted, so we hold the paths until the next turn
 * consumes them (best-effort — lost on restart, leaving a text-only prompt). */
const pendingImagePaths = new Map<string, ReadonlyArray<string>>()

const send = (ws: WebSocket, message: unknown) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message))
}

const broadcast = (chatId: string, event: ChatWireEvent) => {
  const sockets = watchers.get(chatId)
  if (sockets === undefined) return
  for (const ws of sockets) send(ws, { event })
}

/** Whether each socket answered the last protocol ping. */
const socketAlive = new WeakMap<WebSocket, boolean>()
const HEARTBEAT_MS = 15000
let heartbeat: ReturnType<typeof setInterval> | null = null

/**
 * Keep the chat sockets honest in both directions.
 *
 * A dropped laptop lid or a killed tunnel leaves a half-open socket: neither
 * side sees a `close`, so the server keeps broadcasting into a void and the
 * client sits on a spinner it will never resolve — the reconnect path in
 * `useChatStream` only runs on a real `close`. The protocol ping reaps sockets
 * that stop answering here; the `{ping}` frame gives the browser (which cannot
 * observe protocol pongs) something to time out on and reconnect from.
 */
const startHeartbeat = (): void => {
  if (heartbeat !== null) return
  heartbeat = setInterval(() => {
    if (watchers.size === 0) {
      clearInterval(heartbeat ?? undefined)
      heartbeat = null
      return
    }
    for (const sockets of watchers.values()) {
      for (const ws of sockets) {
        if (socketAlive.get(ws) === false) {
          try {
            ws.terminate()
          } catch {
            // already gone
          }
          continue
        }
        socketAlive.set(ws, false)
        try {
          ws.ping()
        } catch {
          // already gone
        }
        send(ws, { ping: new Date().toISOString() })
      }
    }
  }, HEARTBEAT_MS)
  heartbeat.unref?.()
}

export const isTurnRunning = (chatId: string): boolean => liveTurns.has(chatId)

/** How often streamed text is checkpointed to disk while a turn runs. Often
 * enough that a crash costs a sentence, rare enough not to rewrite the store on
 * every token. Tool boundaries force a flush regardless. */
const TEXT_FLUSH_MS = 1500

const flushText = (live: LiveTurn): void => {
  if (live.flushTimer !== null) {
    clearTimeout(live.flushTimer)
    live.flushTimer = null
  }
  const text = live.parser.text()
  if (text === live.flushedText) return
  live.flushedText = text
  try {
    saveStreamingText(live.repoPath, live.chatId, live.assistantMessageId, text)
  } catch {
    // A checkpoint is best-effort; the turn's final write is what must land.
  }
}

const scheduleTextFlush = (live: LiveTurn): void => {
  if (live.flushTimer !== null) return
  live.flushTimer = setTimeout(() => {
    live.flushTimer = null
    if (!live.finalized) flushText(live)
  }, TEXT_FLUSH_MS)
}

const STALE_TURN_MESSAGE = "the server stopped while this turn was running"

/**
 * Settle every "running" turn in a repo that no live process backs, and push a
 * fresh snapshot to anyone watching. A crash, a kill, or a quit mid-turn leaves
 * that state on disk, where it makes the sidebar show a spinner forever and the
 * composer refuse to send. Repairing the whole repo in one pass — on boot, on
 * repo switch, and whenever the chat list is read — means a chat is fixed
 * whether or not the user ever reopens it.
 */
export const repairStaleTurns = (repoPath: string): void => {
  let repaired: ReadonlyArray<string> = []
  try {
    repaired = settleStaleTurns(
      repoPath,
      (chatId) => liveTurns.has(chatId),
      STALE_TURN_MESSAGE
    )
  } catch {
    // An unreadable store is surfaced by the request that reads it, not here.
    return
  }
  for (const chatId of repaired) broadcastChatSnapshot(repoPath, chatId)
}

onCurrentRepoChange((next) => {
  if (next !== null) repairStaleTurns(next)
})

// The desktop app kills this server when the window quits. `exit` only runs
// synchronous work, which is exactly enough to checkpoint the text each live
// turn had streamed; the turns themselves are settled by the boot-time sweep.
process.once("exit", () => {
  for (const live of liveTurns.values()) flushText(live)
})

/**
 * The chat as a client should first see it: the persisted state with the
 * in-flight assistant text merged in, and — after a server restart that
 * orphaned a "running" turn — that stale turn settled as interrupted.
 */
const snapshotChat = (repoPath: string, chat: Chat): Chat => {
  const live = liveTurns.get(chat.id)
  if (live !== undefined) {
    const text = live.parser.text()
    return {
      ...chat,
      messages: chat.messages.map((m) =>
        m.id === live.assistantMessageId ? { ...m, text } : m
      ),
    }
  }
  if (chat.latestTurn !== null && chat.latestTurn.state === "running") {
    const settled = completeTurn(repoPath, chat.id, {
      turnId: chat.latestTurn.id,
      assistantMessageId: chat.messages.findLast((m) => m.streaming)?.id ?? "",
      text: chat.messages.findLast((m) => m.streaming)?.text ?? "",
      state: "interrupted",
      errorMessage: "the server restarted while this turn was running",
      totalCostUsd: null,
      endedAt: new Date().toISOString(),
    })
    if (settled !== undefined) return settled
  }
  return chat
}

/**
 * Replay a fresh `{snapshot}` to every socket watching a chat. Called after an
 * out-of-band mutation (a settings/provider patch) so open composers reflect
 * the new state immediately instead of waiting for the next turn or reconnect.
 */
export const broadcastChatSnapshot = (
  repoPath: string,
  chatId: string
): void => {
  const sockets = watchers.get(chatId)
  if (sockets === undefined || sockets.size === 0) return
  const chat = findChat(repoPath, chatId)
  if (chat === undefined) return
  const snapshot = snapshotChat(repoPath, chat)
  for (const ws of sockets) send(ws, { snapshot })
}

const handleStreamEvent = (live: LiveTurn, event: TurnEvent): void => {
  switch (event.type) {
    case "session": {
      // Persist once confirmed by the CLI so a pre-init failure retries with
      // a fresh id instead of resuming a session that never existed.
      const chat = findChat(live.repoPath, live.chatId)
      if (chat !== undefined && chat.sessionId === null) {
        saveSessionId(live.repoPath, live.chatId, event.sessionId)
      }
      return
    }
    case "delta":
      broadcast(live.chatId, {
        type: "delta",
        messageId: live.assistantMessageId,
        text: event.text,
      })
      scheduleTextFlush(live)
      return
    case "activity": {
      const activity: ChatActivity = {
        id: nextChatId("a"),
        turnId: live.turnId,
        kind: event.kind,
        tone: event.tone,
        summary: event.summary,
        detail: event.detail,
        createdAt: new Date().toISOString(),
        ...(event.callId !== undefined ? { callId: event.callId } : {}),
        ...(event.label !== undefined ? { label: event.label } : {}),
      }
      // A tool boundary is a natural checkpoint: the text written before it is
      // complete, and the store is about to be rewritten for the activity anyway.
      flushText(live)
      appendActivity(live.repoPath, live.chatId, activity)
      broadcast(live.chatId, { type: "activity", activity })
      return
    }
    case "result":
      live.result = event
      return
  }
}

/**
 * opencode never reports its session id on stdout (and older codex versions
 * don't either) — recover it from the CLI's own session files, exactly like
 * the PTY threads do, so the next turn can `--session`/`resume` it.
 */
const captureMintedSession = (live: LiveTurn): void => {
  if (live.provider === "claude") return
  try {
    const chat = findChat(live.repoPath, live.chatId)
    if (chat === undefined || chat.sessionId !== null) return
    const found = recentAgentSessions(
      live.provider,
      live.repoPath,
      live.startedAtMs
    )
    if (found.length === 0) return
    const newest = found.reduce((a, b) => (b.mtimeMs > a.mtimeMs ? b : a))
    saveSessionId(live.repoPath, live.chatId, newest.id)
  } catch {
    // best-effort — an uncaptured session just means the next turn starts fresh
  }
}

const finalizeTurn = (live: LiveTurn, exitCode: number | null): void => {
  if (live.finalized) return
  live.finalized = true
  if (live.flushTimer !== null) {
    clearTimeout(live.flushTimer)
    live.flushTimer = null
  }
  liveTurns.delete(live.chatId)
  captureMintedSession(live)

  const state: ChatTurn["state"] = live.interrupted
    ? "interrupted"
    : live.result !== null
      ? live.result.state
      : exitCode === 0
        ? "completed"
        : "error"
  const stderrTail = live.stderr.trim().slice(-500)
  const rawError =
    state === "error"
      ? (live.result?.errorMessage ??
        (stderrTail.length > 0 ? stderrTail : `agent exited (${exitCode})`))
      : null
  // A logged-out Claude can also die with the login prompt on stderr (no
  // result line at all) — surface the same actionable hint either way.
  const errorMessage =
    rawError !== null &&
    live.provider === "claude" &&
    isClaudeAuthError(rawError)
      ? CLAUDE_LOGIN_HINT
      : rawError
  const endedAt = new Date().toISOString()
  const text = live.parser.text()

  const updated = completeTurn(live.repoPath, live.chatId, {
    turnId: live.turnId,
    assistantMessageId: live.assistantMessageId,
    text,
    state,
    errorMessage,
    totalCostUsd: live.result?.totalCostUsd ?? null,
    endedAt,
  })
  const turn =
    updated?.latestTurn ??
    ({
      id: live.turnId,
      state,
      startedAt: endedAt,
      endedAt,
      errorMessage,
      totalCostUsd: live.result?.totalCostUsd ?? null,
    } satisfies ChatTurn)
  broadcast(live.chatId, {
    type: "turn-completed",
    turn,
    messageId: live.assistantMessageId,
    text,
  })
  // Pick up anything the user queued while this turn was running.
  flushPending(live.repoPath, live.chatId)
}

/** Decode each uploaded image to a temp file the CLI can read; keep only the
 * ones that saved. The lightweight thumbnail rides along on the message. */
const saveImages = (
  images: ReadonlyArray<ChatImageUpload>
): ReadonlyArray<{ image: ChatImageUpload; path: string }> =>
  images.flatMap((image) => {
    const path = saveDroppedImage(image.name, image.data)
    return path === null ? [] : [{ image, path }]
  })

const imageAttachments = (
  saved: ReadonlyArray<{ image: ChatImageUpload; path: string }>
): ReadonlyArray<ChatAttachment> =>
  saved.map(({ image }) => ({ name: image.name, thumbnail: image.thumbnail }))

/**
 * Spawn the agent for an already-persisted turn (assistant placeholder + turn
 * are in `started`) and stream its output. Shared by the two ways a turn
 * begins: an immediate send and the flush of messages queued during a turn.
 */
const launchTurn = (input: {
  repoPath: string
  chat: Chat
  started: Chat
  turnId: string
  assistantMessageId: string
  promptText: string
  imagePaths: ReadonlyArray<string>
  historyMessages?: ReadonlyArray<ChatMessage>
}): void => {
  const { repoPath, chat, started, turnId, assistantMessageId } = input
  // Claude lets us mint the session id up-front; codex/opencode mint their
  // own, so a fresh chat launches without one and the id is captured later.
  const session: ChatTurnSession =
    chat.provider === "claude"
      ? { id: chat.sessionId ?? randomUUID(), resume: chat.sessionId !== null }
      : { id: chat.sessionId, resume: chat.sessionId !== null }
  // Resuming a native session carries the history already; a fresh one (e.g.
  // just after switching the chat's agent) doesn't, so replay the transcript
  // into the prompt. The persisted user message keeps the raw text; the CLI
  // prompt gains the attached image paths so the agent can read them.
  const withImages = withAttachedImages(input.promptText, [...input.imagePaths])
  const prompt = session.resume
    ? withImages
    : withHistory(input.historyMessages ?? chat.messages, withImages)
  const program = chatTurnProgram(chat, prompt, session)

  const child = spawn(program.file, [...program.args], {
    cwd: repoPath,
    env: {
      ...process.env,
      ...program.env,
      BYCONVO_CHAT_ID: chat.id,
      BYCONVO_API: `http://localhost:${process.env["BYCONVO_PORT"] ?? 41811}`,
    },
    stdio: ["pipe", "pipe", "pipe"],
  })

  const live: LiveTurn = {
    chatId: chat.id,
    turnId,
    assistantMessageId,
    repoPath,
    provider: chat.provider,
    startedAtMs: Date.now(),
    child,
    parser: createTurnParser(chat.provider),
    result: null,
    stderr: "",
    interrupted: false,
    finalized: false,
    flushedText: "",
    flushTimer: null,
  }
  liveTurns.set(chat.id, live)
  broadcast(chat.id, { type: "turn-started", chat: started })

  child.stdin?.write(program.stdin)
  child.stdin?.end()

  let pending = ""
  child.stdout?.setEncoding("utf8")
  child.stdout?.on("data", (data: string) => {
    pending += data
    let newline = pending.indexOf("\n")
    while (newline !== -1) {
      const line = pending.slice(0, newline)
      pending = pending.slice(newline + 1)
      for (const event of live.parser.push(line)) {
        handleStreamEvent(live, event)
      }
      newline = pending.indexOf("\n")
    }
  })
  child.stderr?.setEncoding("utf8")
  child.stderr?.on("data", (data: string) => {
    // Keep a bounded tail — it becomes the error message on a dirty exit.
    live.stderr = (live.stderr + data).slice(-4000)
  })
  child.on("error", (error) => {
    live.stderr = `${live.stderr}\n${error.message}`
    finalizeTurn(live, null)
  })
  child.on("close", (code) => {
    // Flush a final unterminated line before settling.
    if (pending.length > 0) {
      for (const event of live.parser.push(pending)) {
        handleStreamEvent(live, event)
      }
      pending = ""
    }
    finalizeTurn(live, code)
  })
}

/**
 * Start a turn: persist the user message + a streaming assistant placeholder,
 * spawn the agent, and stream. Returns synchronously once the process is
 * launched; progress flows over the chat WebSocket.
 */
export const startChatTurn = (
  repoPath: string,
  chatId: string,
  text: string,
  images: ReadonlyArray<ChatImageUpload> = []
): StartTurnResult => {
  if (liveTurns.has(chatId)) return { ok: false, reason: "busy" }
  const chat = findChat(repoPath, chatId)
  if (chat === undefined) return { ok: false, reason: "not-found" }

  const saved = saveImages(images)
  const attachments = imageAttachments(saved)
  const now = new Date().toISOString()
  const turnId = nextChatId("turn")
  const userMessage: ChatMessage = {
    id: nextChatId("m"),
    role: "user",
    text,
    turnId,
    streaming: false,
    createdAt: now,
    ...(attachments.length > 0 ? { attachments } : {}),
  }
  const assistantMessage: ChatMessage = {
    id: nextChatId("m"),
    role: "assistant",
    text: "",
    turnId,
    streaming: true,
    createdAt: now,
  }
  const turn: ChatTurn = {
    id: turnId,
    state: "running",
    startedAt: now,
    endedAt: null,
    errorMessage: null,
    totalCostUsd: null,
  }
  const started = appendTurnStart(repoPath, chatId, {
    turn,
    userMessage,
    assistantMessage,
  })
  if (started === undefined) return { ok: false, reason: "not-found" }

  launchTurn({
    repoPath,
    chat,
    started,
    turnId,
    assistantMessageId: assistantMessage.id,
    promptText: text,
    imagePaths: saved.map(({ path }) => path),
  })
  return { ok: true }
}

/**
 * Queue a message sent while a turn is running: persist it to the thread now
 * (marked pending, shown live) and let the current turn's completion pick it
 * up. No process is spawned here — flushPending() starts the follow-up turn.
 */
export const queueChatTurn = (
  repoPath: string,
  chatId: string,
  text: string,
  images: ReadonlyArray<ChatImageUpload> = []
): StartTurnResult => {
  const chat = findChat(repoPath, chatId)
  if (chat === undefined) return { ok: false, reason: "not-found" }

  const saved = saveImages(images)
  const attachments = imageAttachments(saved)
  const now = new Date().toISOString()
  // A distinct future turn id so this queued prompt never collides with the
  // live turn's activities before it's consumed.
  const userMessage: ChatMessage = {
    id: nextChatId("m"),
    role: "user",
    text,
    turnId: nextChatId("turn"),
    streaming: false,
    createdAt: now,
    pending: true,
    ...(attachments.length > 0 ? { attachments } : {}),
  }
  const updated = appendPendingMessage(repoPath, chatId, userMessage)
  if (updated === undefined) return { ok: false, reason: "not-found" }
  if (saved.length > 0) {
    pendingImagePaths.set(
      userMessage.id,
      saved.map(({ path }) => path)
    )
  }
  broadcast(chatId, { type: "message-appended", message: userMessage })
  // The turn this was queued behind can settle between the caller's isRunning
  // check and the write above — its flushPending would have run before this
  // message existed, leaving it pending with nothing to pick it up. Re-check
  // now that it is persisted; flushPending is a no-op if a turn is still live.
  flushPending(repoPath, chatId)
  return { ok: true }
}

/**
 * Start a follow-up turn from any messages queued during the turn that just
 * settled. A no-op when nothing is pending or a turn is (already) running.
 * Called when a turn finalizes and when a socket attaches (to recover pending
 * left by a server restart).
 */
const flushPending = (repoPath: string, chatId: string): void => {
  if (liveTurns.has(chatId)) return
  const chat = findChat(repoPath, chatId)
  if (chat === undefined) return
  const queued = chat.messages.filter(
    (m) => m.role === "user" && m.pending === true
  )
  if (queued.length === 0) return

  // Combine the queued prompts into one follow-up turn (the bubbles stay
  // separate in the timeline; the agent sees them together).
  const promptText = queued
    .map((m) => m.text)
    .join("\n\n")
    .trim()
  const imagePaths = queued.flatMap((m) => pendingImagePaths.get(m.id) ?? [])
  const consumeIds = queued.map((m) => m.id)

  const now = new Date().toISOString()
  const turnId = nextChatId("turn")
  const assistantMessage: ChatMessage = {
    id: nextChatId("m"),
    role: "assistant",
    text: "",
    turnId,
    streaming: true,
    createdAt: now,
  }
  const turn: ChatTurn = {
    id: turnId,
    state: "running",
    startedAt: now,
    endedAt: null,
    errorMessage: null,
    totalCostUsd: null,
  }
  const started = startPendingTurn(repoPath, chatId, {
    turn,
    assistantMessage,
    consumeIds,
  })
  if (started === undefined) return
  for (const id of consumeIds) pendingImagePaths.delete(id)

  launchTurn({
    repoPath,
    chat,
    started,
    turnId,
    assistantMessageId: assistantMessage.id,
    promptText,
    imagePaths,
    historyMessages: chat.messages.filter(
      (m) => !(m.role === "user" && m.pending === true)
    ),
  })
}

/**
 * Interrupt a running turn. Returns false when nothing was running — in which
 * case a chat the store still calls "running" is stale, so Stop doubles as the
 * user's escape hatch and repairs it instead of doing nothing.
 */
export const stopChatTurn = (chatId: string): boolean => {
  const live = liveTurns.get(chatId)
  if (live === undefined) {
    const repoPath = getCurrentRepo()
    if (repoPath !== null) repairStaleTurns(repoPath)
    return false
  }
  live.interrupted = true
  try {
    live.child.kill("SIGTERM")
  } catch {
    // already gone
  }
  const hard = setTimeout(() => {
    try {
      live.child.kill("SIGKILL")
    } catch {
      // already gone
    }
  }, 3000)
  live.child.once("close", () => clearTimeout(hard))
  return true
}

/** Tear down everything for a deleted chat: process and sockets. */
export const killChatRuntime = (chatId: string): void => {
  stopChatTurn(chatId)
  const sockets = watchers.get(chatId)
  if (sockets !== undefined) {
    watchers.delete(chatId)
    for (const ws of sockets) {
      try {
        ws.close()
      } catch {
        // already gone
      }
    }
  }
}

/**
 * Attach a chat-stream WebSocket (routed here by the upgrade dispatcher in
 * pty-socket.ts). Sends the snapshot, then live events until either side
 * closes. Read-only: mutations go through the REST API.
 */
export const startChatStream = (
  ws: WebSocket,
  request: IncomingMessage
): void => {
  const url = new URL(request.url ?? "", "http://localhost")
  const chatId = url.searchParams.get("chat") ?? ""
  const repoPath = getCurrentRepo()
  if (chatId.length === 0 || repoPath === null) {
    send(ws, { error: "no chat selected or no repository open" })
    ws.close()
    return
  }
  repairStaleTurns(repoPath)
  let chat: Chat | undefined
  try {
    chat = findChat(repoPath, chatId)
  } catch {
    chat = undefined
  }
  if (chat === undefined) {
    send(ws, { error: `chat ${chatId} not found` })
    ws.close()
    return
  }

  send(ws, { snapshot: snapshotChat(repoPath, chat) })
  const sockets = watchers.get(chatId) ?? new Set<WebSocket>()
  sockets.add(ws)
  watchers.set(chatId, sockets)
  socketAlive.set(ws, true)
  ws.on("pong", () => socketAlive.set(ws, true))
  ws.on("close", () => {
    sockets.delete(ws)
    if (sockets.size === 0) watchers.delete(chatId)
  })
  startHeartbeat()
  // A restart can leave queued messages with no turn to pick them up (the
  // in-flight turn was settled as interrupted on snapshot). Start them now.
  flushPending(repoPath, chatId)
}

/** Test seam: reset all in-memory runtime state. */
export const resetChatRuntime = (): void => {
  for (const chatId of [...liveTurns.keys()]) stopChatTurn(chatId)
  liveTurns.clear()
  watchers.clear()
  pendingImagePaths.clear()
  if (heartbeat !== null) {
    clearInterval(heartbeat)
    heartbeat = null
  }
}
