/**
 * Thread store — the single reader/writer for the `thread` table.
 *
 * Like the chat store, it is framework-free because two callers share it: the
 * Effect repository (per-request CRUD) and the PTY socket, which runs outside
 * the Effect runtime and needs a thread's initial prompt and native session id
 * as a terminal attaches.
 */
import * as Schema from "effect/Schema";
import { Thread } from "@reviewer/core/threads";
import { documentTable } from "../db/documents.ts";

export const threads = documentTable<Thread>({
  table: "thread",
  sortColumn: "updated_at",
  direction: "desc",
  decode: Schema.decodeUnknownSync(Thread),
});

export const findThread = (repoPath: string, id: string): Thread | undefined =>
  threads.find(repoPath, id);

export const putThread = (repoPath: string, thread: Thread): void =>
  threads.put(repoPath, thread.id, thread.updatedAt, thread);

/**
 * Merge `patch` into a thread, preserving every other field. Best-effort: the
 * PTY socket calls it while a terminal is attaching and a missing thread is a
 * reason to carry on, not to fail the attach.
 */
export const patchThread = (
  repoPath: string,
  id: string,
  patch: Partial<Thread>
): void => {
  try {
    const existing = findThread(repoPath, id);
    if (existing === undefined) return;
    putThread(repoPath, { ...existing, ...patch });
  } catch {
    // best-effort
  }
};

/** The one-shot initial prompt stored on a thread, or "" if none. */
export const readThreadInitialPrompt = (
  repoPath: string,
  id: string
): string => {
  try {
    return findThread(repoPath, id)?.initialPrompt ?? "";
  } catch {
    return "";
  }
};

/** Clear a thread's initial prompt after it has been delivered. */
export const clearThreadInitialPrompt = (repoPath: string, id: string): void =>
  patchThread(repoPath, id, { initialPrompt: "" });

/** The agent's stored native session id for a thread, or null if none yet. */
export const readThreadAgentSessionId = (
  repoPath: string,
  id: string
): string | null => {
  try {
    return findThread(repoPath, id)?.agentSessionId ?? null;
  } catch {
    return null;
  }
};
