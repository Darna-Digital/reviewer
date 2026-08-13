/**
 * Chat store — the single reader/writer for the `chat`, `chat_message` and
 * `chat_activity` tables.
 *
 * Two very different callers share it, which is why it is framework-free: the
 * Effect repository (per-request CRUD) and the chat turn runtime, which runs
 * outside the Effect runtime (spawned processes + the chat WebSocket are wired
 * straight onto Node, like the PTY sessions) and must persist progress as a
 * turn streams. Keeping every mutation here means there is exactly one shape of
 * the data, whichever side writes.
 *
 * Chats are stored centrally rather than inside the repository they were
 * started in: each row carries its `repo_path`, so the sessions list can show
 * every project at once while a turn still runs its agent in the directory the
 * chat belongs to. Ids are unique across the whole database, which is why
 * nothing here takes a repository path to find a chat by id.
 *
 * The row-per-message shape is what a streaming turn wants. Persisting the
 * tokens seen so far used to rewrite the whole conversation; it is now an
 * `UPDATE` of one row, whatever the transcript weighs.
 */
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_CHAT_TITLE,
  titleFromPrompt,
  type Chat,
  type ChatActivity,
  type ChatAttachment,
  type ChatMessage,
  type ChatSummary,
  type ChatTurn,
} from "@byconvo/core/chats";
import {
  allRows,
  database,
  execute,
  oneRow,
  transact,
} from "../db/database.ts";
import { unknownOrigin, type Origin } from "../db/scope.ts";

export const nextChatId = (prefix: string): string =>
  `${prefix}-${randomUUID()}`;

// --- Row shapes -------------------------------------------------------------

interface ChatRow {
  readonly id: string;
  readonly repo_path: string;
  readonly title: string;
  readonly provider: string;
  readonly model: string;
  readonly effort: string;
  readonly access: string;
  readonly branch: string;
  readonly session_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly latest_turn: string | null;
  readonly repo_name: string | null;
  readonly project_path: string | null;
  readonly project_name: string | null;
}

interface MessageRow {
  readonly id: string;
  readonly role: string;
  readonly text: string;
  readonly turn_id: string;
  readonly streaming: number;
  readonly pending: number;
  readonly attachments: string | null;
  readonly created_at: string;
}

interface ActivityRow {
  readonly id: string;
  readonly turn_id: string;
  readonly kind: string;
  readonly tone: string;
  readonly summary: string;
  readonly detail: string | null;
  readonly call_id: string | null;
  readonly label: string | null;
  readonly created_at: string;
}

/** Every chat query needs the project labels, so they all start from here. */
const CHAT_COLUMNS = `
  SELECT chat.*, repo.name AS repo_name, repo.project_path,
         project.name AS project_name
  FROM chat
  LEFT JOIN repo ON repo.path = chat.repo_path
  LEFT JOIN project ON project.path = repo.project_path
`;

const originOf = (row: ChatRow): Origin =>
  row.project_path === null
    ? unknownOrigin(row.repo_path)
    : {
        projectPath: row.project_path,
        projectName: row.project_name ?? row.project_path,
        repoPath: row.repo_path,
        repoName: row.repo_name ?? row.repo_path,
      };

const toMessage = (row: MessageRow): ChatMessage => ({
  id: row.id,
  role: row.role as ChatMessage["role"],
  text: row.text,
  turnId: row.turn_id,
  streaming: row.streaming === 1,
  createdAt: row.created_at,
  ...(row.attachments === null
    ? {}
    : {
        attachments: JSON.parse(
          row.attachments
        ) as ReadonlyArray<ChatAttachment>,
      }),
  // Absent rather than false, so a settled message reads exactly as it did
  // before it was ever queued.
  ...(row.pending === 1 ? { pending: true } : {}),
});

const toActivity = (row: ActivityRow): ChatActivity => ({
  id: row.id,
  turnId: row.turn_id,
  kind: row.kind,
  tone: row.tone as ChatActivity["tone"],
  summary: row.summary,
  detail: row.detail,
  createdAt: row.created_at,
  ...(row.call_id === null ? {} : { callId: row.call_id }),
  ...(row.label === null ? {} : { label: row.label }),
});

const messagesOf = (chatId: string): ChatMessage[] =>
  allRows<MessageRow>(
    "SELECT * FROM chat_message WHERE chat_id = ? ORDER BY seq, rowid",
    chatId
  ).map(toMessage);

const activitiesOf = (chatId: string): ChatActivity[] =>
  allRows<ActivityRow>(
    "SELECT * FROM chat_activity WHERE chat_id = ? ORDER BY seq, rowid",
    chatId
  ).map(toActivity);

const toChat = (row: ChatRow): Chat => ({
  id: row.id,
  origin: originOf(row),
  title: row.title,
  provider: row.provider as Chat["provider"],
  model: row.model,
  effort: row.effort as Chat["effort"],
  access: row.access as Chat["access"],
  branch: row.branch,
  sessionId: row.session_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  messages: messagesOf(row.id),
  activities: activitiesOf(row.id),
  latestTurn:
    row.latest_turn === null ? null : (JSON.parse(row.latest_turn) as ChatTurn),
});

// --- Reads ------------------------------------------------------------------

export const findChat = (id: string): Chat | undefined => {
  const row = oneRow<ChatRow>(`${CHAT_COLUMNS} WHERE chat.id = ?`, id);
  return row === undefined ? undefined : toChat(row);
};

/**
 * Every chat in the database, newest first — the sessions list spans projects,
 * so this is deliberately not scoped to the open one.
 *
 * The counts and the preview line come out of SQL rather than out of a loaded
 * transcript: listing a hundred conversations must not mean reading a hundred
 * conversations.
 */
export const listChatSummaries = (): ReadonlyArray<ChatSummary> => {
  const rows = allRows<ChatRow>(
    `${CHAT_COLUMNS} ORDER BY chat.updated_at DESC`
  );
  const counts = allRows<{ chat_id: string; message_count: number }>(
    `SELECT chat_id, COUNT(*) AS message_count
     FROM chat_message GROUP BY chat_id`
  );
  const previews = allRows<{ chat_id: string; text: string }>(
    `SELECT m.chat_id, m.text FROM chat_message m
     JOIN (SELECT chat_id, MAX(seq) AS seq FROM chat_message GROUP BY chat_id) last
       ON last.chat_id = m.chat_id AND last.seq = m.seq`
  );
  const lastMessages = new Map(previews.map((row) => [row.chat_id, row.text]));
  const byChat = new Map(counts.map((row) => [row.chat_id, row]));
  return rows.map((row) => {
    const tally = byChat.get(row.id);
    const turn =
      row.latest_turn === null
        ? null
        : (JSON.parse(row.latest_turn) as ChatTurn);
    return {
      id: row.id,
      origin: originOf(row),
      title: row.title,
      provider: row.provider as ChatSummary["provider"],
      model: row.model,
      branch: row.branch,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: tally?.message_count ?? 0,
      lastMessage: lastMessages.get(row.id)?.slice(0, 120) ?? null,
      turnState: turn?.state ?? null,
    } satisfies ChatSummary;
  });
};

// --- Writes -----------------------------------------------------------------

export interface InsertChatInput {
  readonly id: string;
  readonly repoPath: string;
  readonly title: string;
  readonly provider: Chat["provider"];
  readonly model: string;
  readonly effort: Chat["effort"];
  readonly access: Chat["access"];
  readonly branch: string;
  readonly createdAt: string;
}

export const insertChat = (input: InsertChatInput): Chat => {
  database()
    .prepare(
      `INSERT INTO chat (id, repo_path, title, provider, model, effort, access,
                         branch, session_id, created_at, updated_at, latest_turn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`
    )
    .run(
      input.id,
      input.repoPath,
      input.title,
      input.provider,
      input.model,
      input.effort,
      input.access,
      input.branch,
      input.createdAt,
      input.createdAt
    );
  const created = findChat(input.id);
  if (created === undefined) {
    throw new Error(`chat ${input.id} vanished immediately after insert`);
  }
  return created;
};

export interface ChatSettingsPatch {
  readonly title: string;
  readonly provider: Chat["provider"];
  readonly model: string;
  readonly effort: Chat["effort"];
  readonly access: Chat["access"];
  readonly sessionId: string | null;
  readonly updatedAt: string;
}

export const updateChatSettings = (
  id: string,
  patch: ChatSettingsPatch
): Chat | undefined => {
  database()
    .prepare(
      `UPDATE chat SET title = ?, provider = ?, model = ?, effort = ?,
                       access = ?, session_id = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      patch.title,
      patch.provider,
      patch.model,
      patch.effort,
      patch.access,
      patch.sessionId,
      patch.updatedAt,
      id
    );
  return findChat(id);
};

export const removeChat = (id: string): void => {
  // The message and activity rows go with it (ON DELETE CASCADE).
  execute("DELETE FROM chat WHERE id = ?", id);
};

const chatExists = (db: DatabaseSync, id: string): boolean =>
  db.prepare("SELECT 1 FROM chat WHERE id = ?").get(id) !== undefined;

const nextSeq = (db: DatabaseSync, table: string, chatId: string): number => {
  const row = db
    .prepare(
      `SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM ${table} WHERE chat_id = ?`
    )
    .get(chatId) as unknown as { seq: number };
  return row.seq;
};

const insertMessage = (
  db: DatabaseSync,
  chatId: string,
  message: ChatMessage
): void => {
  db.prepare(
    `INSERT INTO chat_message
       (id, chat_id, seq, role, text, turn_id, streaming, pending, attachments, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    message.id,
    chatId,
    nextSeq(db, "chat_message", chatId),
    message.role,
    message.text,
    message.turnId,
    message.streaming ? 1 : 0,
    message.pending === true ? 1 : 0,
    message.attachments === undefined
      ? null
      : JSON.stringify(message.attachments),
    message.createdAt
  );
};

const setLatestTurn = (
  db: DatabaseSync,
  chatId: string,
  turn: ChatTurn | null
): void => {
  db.prepare("UPDATE chat SET latest_turn = ? WHERE id = ?").run(
    turn === null ? null : JSON.stringify(turn),
    chatId
  );
};

const touch = (db: DatabaseSync, chatId: string, at: string): void => {
  db.prepare("UPDATE chat SET updated_at = ? WHERE id = ?").run(at, chatId);
};

// --- Turn-progress mutations (used by the runtime while a turn streams) -----

const titleFromFirstPrompt = (current: string, prompt: string): string => {
  if (current !== DEFAULT_CHAT_TITLE) return current;
  const seeded = titleFromPrompt(prompt);
  return seeded.length > 0 ? seeded : current;
};

/**
 * Every turn mutation runs through here: a write is dropped when the chat is
 * gone (deleted mid-turn — never resurrected), and the chat is re-read once,
 * afterwards, so callers see the state they just produced.
 */
const mutate = (
  chatId: string,
  write: (db: DatabaseSync) => void
): Chat | undefined =>
  transact((db) => {
    if (!chatExists(db, chatId)) return undefined;
    write(db);
    return findChat(chatId);
  });

export const appendTurnStart = (
  chatId: string,
  input: {
    readonly turn: ChatTurn;
    readonly userMessage: ChatMessage;
    readonly assistantMessage: ChatMessage;
  }
): Chat | undefined =>
  mutate(chatId, (db) => {
    const row = db
      .prepare("SELECT title FROM chat WHERE id = ?")
      .get(chatId) as unknown as { title: string };
    db.prepare("UPDATE chat SET title = ?, updated_at = ? WHERE id = ?").run(
      titleFromFirstPrompt(row.title, input.userMessage.text),
      input.turn.startedAt,
      chatId
    );
    insertMessage(db, chatId, input.userMessage);
    insertMessage(db, chatId, input.assistantMessage);
    setLatestTurn(db, chatId, input.turn);
  });

/** Append a user message queued while a turn was running. It shows in the
 * timeline immediately (marked pending) and is picked up by the next turn. */
export const appendPendingMessage = (
  chatId: string,
  userMessage: ChatMessage
): Chat | undefined =>
  mutate(chatId, (db) => {
    insertMessage(db, chatId, userMessage);
    touch(db, chatId, userMessage.createdAt);
  });

/** Start a turn that consumes already-persisted pending messages: attach them
 * to the new turn (clearing their pending flag) and add the streaming assistant
 * placeholder. No new user message is created — the prompts already exist. */
export const startPendingTurn = (
  chatId: string,
  input: {
    readonly turn: ChatTurn;
    readonly assistantMessage: ChatMessage;
    readonly consumeIds: ReadonlyArray<string>;
  }
): Chat | undefined =>
  mutate(chatId, (db) => {
    const consume = db.prepare(
      "UPDATE chat_message SET pending = 0, turn_id = ? WHERE chat_id = ? AND id = ?"
    );
    for (const id of input.consumeIds) consume.run(input.turn.id, chatId, id);
    insertMessage(db, chatId, input.assistantMessage);
    setLatestTurn(db, chatId, input.turn);
    touch(db, chatId, input.turn.startedAt);
  });

export const appendActivity = (
  chatId: string,
  activity: ChatActivity
): Chat | undefined =>
  mutate(chatId, (db) => {
    db.prepare(
      `INSERT INTO chat_activity
         (id, chat_id, seq, turn_id, kind, tone, summary, detail, call_id, label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      activity.id,
      chatId,
      nextSeq(db, "chat_activity", chatId),
      activity.turnId,
      activity.kind,
      activity.tone,
      activity.summary,
      activity.detail,
      activity.callId ?? null,
      activity.label ?? null,
      activity.createdAt
    );
    touch(db, chatId, activity.createdAt);
  });

/**
 * Until this lands, the reply exists only in the parser's closure — a crash
 * loses every token the user already watched arrive. One row, one column: the
 * checkpoint costs the same whether the transcript is a line or a megabyte.
 */
export const saveStreamingText = (
  chatId: string,
  messageId: string,
  text: string
): void => {
  execute(
    "UPDATE chat_message SET text = ? WHERE chat_id = ? AND id = ?",
    text,
    chatId,
    messageId
  );
};

export const saveSessionId = (chatId: string, sessionId: string): void => {
  execute("UPDATE chat SET session_id = ? WHERE id = ?", sessionId, chatId);
};

/** Settle a turn: final assistant text, streaming off, turn state persisted. */
export const completeTurn = (
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
  mutate(chatId, (db) => {
    db.prepare(
      "UPDATE chat_message SET text = ?, streaming = 0 WHERE chat_id = ? AND id = ?"
    ).run(input.text, chatId, input.assistantMessageId);
    const row = db
      .prepare("SELECT latest_turn FROM chat WHERE id = ?")
      .get(chatId) as unknown as { latest_turn: string | null };
    const turn =
      row.latest_turn === null
        ? null
        : (JSON.parse(row.latest_turn) as ChatTurn);
    if (turn !== null && turn.id === input.turnId) {
      setLatestTurn(db, chatId, {
        ...turn,
        state: input.state,
        endedAt: input.endedAt,
        errorMessage: input.errorMessage,
        totalCostUsd: input.totalCostUsd,
      });
    }
    touch(db, chatId, input.endedAt);
  });

/**
 * Whatever text was flushed stays as the reply; the turn becomes `interrupted`
 * so the sidebar, the composer and the Stop button stop believing work is in
 * flight. One pass over the whole database repairs chats the user never
 * reopens — in any project, not only the open one.
 */
export const settleStaleTurns = (
  isLive: (chatId: string) => boolean,
  errorMessage: string
): ReadonlyArray<string> => {
  const db = database();
  const running = allRows<{ id: string; latest_turn: string }>(
    "SELECT id, latest_turn FROM chat WHERE latest_turn IS NOT NULL"
  )
    .filter(
      (row) => (JSON.parse(row.latest_turn) as ChatTurn).state === "running"
    )
    .filter((row) => !isLive(row.id));
  if (running.length === 0) return [];
  const endedAt = new Date().toISOString();
  transact(() => {
    const stopStreaming = db.prepare(
      "UPDATE chat_message SET streaming = 0 WHERE chat_id = ? AND streaming = 1"
    );
    for (const row of running) {
      stopStreaming.run(row.id);
      setLatestTurn(db, row.id, {
        ...(JSON.parse(row.latest_turn) as ChatTurn),
        state: "interrupted",
        endedAt,
        errorMessage,
      });
    }
  });
  return running.map((row) => row.id);
};
