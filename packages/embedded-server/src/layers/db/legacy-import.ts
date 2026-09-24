/**
 * One-time import of the `.reviewer/*.json` files reviewer used to write.
 *
 * It runs per git root, on every project open, and does nothing at all once a
 * root has been imported — the `legacy_import` table records which features
 * have been taken across, so a folder holding five repositories imports each of
 * them exactly once, whichever order the user opens them in.
 *
 * The JSON files are left where they are. They cost nothing, and an import is a
 * far less alarming thing to run when the thing it read is still on disk.
 *
 * Everything here is best-effort by design: an unreadable or half-written file
 * from an older reviewer is a reason for that feature to start empty, not for
 * the project to fail to open. A feature that failed stays unmarked and is
 * retried next time, which is what you want if the file was mid-write.
 */
import { readFileSync } from "node:fs";
import * as Schema from "effect/Schema";
import {
  ChatAccess,
  ChatActivity,
  ChatEffort,
  ChatMessage,
  ChatProviderKind,
  ChatTurn,
} from "@reviewer/core/chats";
import { ReviewComment } from "@reviewer/core/comments";
import {
  decodeStoredDevCommand,
  type DevCommand,
} from "@reviewer/core/local-dev";
import { Thread } from "@reviewer/core/threads";
import { database, transact } from "./database.ts";
import { documentTable } from "./documents.ts";

/**
 * A chat as `chats.json` held it. Deliberately not the current `Chat`: that one
 * now carries the project a chat belongs to, which is exactly the thing a file
 * inside a repository never had to say. The repository the file was found in is
 * where it comes from here.
 */
const LegacyChat = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  provider: ChatProviderKind,
  model: Schema.String,
  effort: ChatEffort,
  access: ChatAccess,
  branch: Schema.String,
  sessionId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  messages: Schema.Array(ChatMessage),
  activities: Schema.Array(ChatActivity),
  latestTurn: Schema.NullOr(ChatTurn),
});

const decodeChats = Schema.decodeUnknownSync(Schema.Array(LegacyChat));
const decodeComments = Schema.decodeUnknownSync(Schema.Array(ReviewComment));
const decodeThreads = Schema.decodeUnknownSync(Schema.Array(Thread));
const decodeDevCommands = (raw: unknown): ReadonlyArray<DevCommand> =>
  Schema.decodeUnknownSync(Schema.Array(Schema.Unknown))(raw).map(
    decodeStoredDevCommand
  );

/** Parse a `.reviewer` file, or null when it isn't there. */
const readJson = (path: string): unknown | null => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const imported = (repoPath: string, feature: string): boolean =>
  database()
    .prepare("SELECT 1 FROM legacy_import WHERE repo_path = ? AND feature = ?")
    .get(repoPath, feature) !== undefined;

const markImported = (repoPath: string, feature: string): void => {
  database()
    .prepare(
      `INSERT INTO legacy_import (repo_path, feature, imported_at) VALUES (?, ?, ?)
       ON CONFLICT (repo_path, feature) DO NOTHING`
    )
    .run(repoPath, feature, new Date().toISOString());
};

/**
 * Run one feature's import once. `take` returns false when there was nothing to
 * import — which still counts as done, so an empty repository isn't re-checked
 * on every open.
 */
const once = (repoPath: string, feature: string, take: () => void): boolean => {
  if (imported(repoPath, feature)) return false;
  try {
    transact(() => {
      take();
      markImported(repoPath, feature);
    });
    return true;
  } catch (error) {
    // Left unmarked on purpose: a file that was mid-write when we read it
    // deserves another attempt, and a permanently broken one costs one read.
    console.warn(
      `reviewer: could not import ${feature} from ${repoPath}/.reviewer —`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
};

const comments = documentTable<ReviewComment>({
  table: "comment",
  sortColumn: "created_at",
  direction: "asc",
  decode: Schema.decodeUnknownSync(ReviewComment),
});
const threads = documentTable<Thread>({
  table: "thread",
  sortColumn: "updated_at",
  direction: "desc",
  decode: Schema.decodeUnknownSync(Thread),
});
const devCommands = documentTable<DevCommand>({
  table: "dev_command",
  sortColumn: "created_at",
  direction: "asc",
  decode: decodeStoredDevCommand,
});

const importChats = (repoPath: string): void => {
  const raw = readJson(`${repoPath}/.reviewer/chats.json`);
  if (raw === null) return;
  const db = database();
  const insertChat = db.prepare(
    `INSERT INTO chat (id, repo_path, title, provider, model, effort, access,
                       branch, session_id, created_at, updated_at, latest_turn)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`
  );
  const insertMessage = db.prepare(
    `INSERT INTO chat_message
       (id, chat_id, seq, role, text, turn_id, streaming, pending, attachments, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`
  );
  const insertActivity = db.prepare(
    `INSERT INTO chat_activity
       (id, chat_id, seq, turn_id, kind, tone, summary, detail, call_id, label, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`
  );
  for (const chat of decodeChats(raw)) {
    insertChat.run(
      chat.id,
      repoPath,
      chat.title,
      chat.provider,
      chat.model,
      chat.effort,
      chat.access,
      chat.branch,
      chat.sessionId,
      chat.createdAt,
      chat.updatedAt,
      chat.latestTurn === null ? null : JSON.stringify(chat.latestTurn)
    );
    // The array's order was the conversation's order; `seq` is what preserves
    // it now that the messages are rows.
    chat.messages.forEach((message, index) => {
      insertMessage.run(
        message.id,
        chat.id,
        index + 1,
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
    });
    chat.activities.forEach((activity, index) => {
      insertActivity.run(
        activity.id,
        chat.id,
        index + 1,
        activity.turnId,
        activity.kind,
        activity.tone,
        activity.summary,
        activity.detail,
        activity.callId ?? null,
        activity.label ?? null,
        activity.createdAt
      );
    });
  }
};

/**
 * Take everything one git root still keeps in `.reviewer/*.json` into the
 * database. Returns the features that were imported this time (empty once the
 * root is up to date), which is only used for logging.
 */
export const importLegacyJson = (repoPath: string): ReadonlyArray<string> => {
  const done: string[] = [];
  const run = (feature: string, take: () => void) => {
    if (once(repoPath, feature, take)) done.push(feature);
  };

  run("chats", () => importChats(repoPath));
  run("comments", () => {
    const raw = readJson(`${repoPath}/.reviewer/comments.json`);
    if (raw === null) return;
    for (const comment of decodeComments(raw)) {
      comments.put(repoPath, comment.id, comment.createdAt, comment);
    }
  });
  run("threads", () => {
    const raw = readJson(`${repoPath}/.reviewer/threads.json`);
    if (raw === null) return;
    // Fields added after the file was first written have defaults, exactly as
    // the file store applied them on read.
    const normalized = Array.isArray(raw)
      ? raw.map((thread) =>
          thread !== null && typeof thread === "object"
            ? { branch: "", initialPrompt: "", agentSessionId: null, ...thread }
            : thread
        )
      : raw;
    for (const thread of decodeThreads(normalized)) {
      threads.put(repoPath, thread.id, thread.updatedAt, thread);
    }
  });
  run("dev-commands", () => {
    const raw = readJson(`${repoPath}/.reviewer/dev-commands.json`);
    if (raw === null) return;
    for (const command of decodeDevCommands(raw)) {
      devCommands.put(repoPath, command.id, command.createdAt, command);
    }
  });

  return done;
};
