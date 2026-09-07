/**
 * SQLite-backed terminal-thread store — threads (with their run history) are
 * scoped to the repository they were started in, and commands run through
 * TerminalExec scoped to that repo.
 */
import * as Effect from "effect/Effect";
import { NotFound } from "@reviewer/core/shared";
import { inRepo } from "../db/db.service.ts";
import { TerminalExec } from "../terminal/terminal-exec.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import {
  agentCommand,
  agentDefaultTitle,
  type CreateThreadInput,
  type RenameThreadInput,
  type Thread,
  type ThreadEntry,
  type ThreadsRepo,
} from "@reviewer/core/threads";
import { findThread, putThread, threads } from "./store.ts";

const summarize = (thread: Thread) => ({
  id: thread.id,
  title: thread.title,
  agent: thread.agent,
  branch: thread.branch,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
  entryCount: thread.entries.length,
  lastCommand:
    thread.entries.length > 0
      ? thread.entries[thread.entries.length - 1].command
      : null,
});

/** A short title from a command — the first token. */
const titleFromCommand = (command: string) => {
  const trimmed = command.trim();
  const first = trimmed.split(/\s+/)[0] ?? "";
  return first.length > 0 ? first.slice(0, 60) : "terminal";
};

const DEFAULT_TITLE = "New session";

// Module-scoped so ids stay unique across per-request repository instances.
let counter = 0;
const nextId = (prefix: string) => {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
};

export const makeSqliteThreadsRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;
  const terminal = yield* TerminalExec;
  const withRepo = inRepo(ctx);

  const requireThread = (repoPath: string, id: string): Thread => {
    const thread = findThread(repoPath, id);
    if (thread === undefined) {
      throw new NotFound({ reason: `thread ${id} not found` });
    }
    return thread;
  };

  const list: ThreadsRepo["list"] = withRepo((repoPath) =>
    threads.list(repoPath).map(summarize)
  );

  const get: ThreadsRepo["get"] = (id) =>
    withRepo((repoPath) => requireThread(repoPath, id));

  const create: ThreadsRepo["create"] = (input: CreateThreadInput) =>
    withRepo((repoPath) => {
      const now = new Date().toISOString();
      const created: Thread = {
        id: nextId("t"),
        title:
          input.title.trim().length > 0
            ? input.title.trim()
            : agentDefaultTitle(input.agent),
        agent: input.agent,
        branch: input.branch,
        initialPrompt: input.initialPrompt,
        agentSessionId: null,
        createdAt: now,
        updatedAt: now,
        entries: [],
      };
      putThread(repoPath, created);
      return created;
    });

  const rename: ThreadsRepo["rename"] = (id, input: RenameThreadInput) =>
    withRepo((repoPath) => {
      const existing = requireThread(repoPath, id);
      const updated: Thread = {
        ...existing,
        title:
          input.title.trim().length > 0 ? input.title.trim() : existing.title,
        branch: input.branch === undefined ? existing.branch : input.branch,
        updatedAt: new Date().toISOString(),
      };
      putThread(repoPath, updated);
      return updated;
    });

  const remove: ThreadsRepo["remove"] = (id) =>
    withRepo((repoPath) => threads.remove(repoPath, id));

  const run: ThreadsRepo["run"] = (id, input) =>
    Effect.gen(function* () {
      // Fetch first (fails NotFound before spawning) and to read the agent.
      const thread = yield* withRepo((repoPath) => requireThread(repoPath, id));
      const result = yield* terminal.run(agentCommand(thread.agent, input));
      return yield* withRepo((repoPath) => {
        const existing = requireThread(repoPath, id);
        const entry: ThreadEntry = {
          id: nextId("e"),
          // Store what the user typed (the prompt / command), not the wrapped
          // agent invocation, so the history reads back naturally.
          command: input,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          createdAt: new Date().toISOString(),
        };
        putThread(repoPath, {
          ...existing,
          // Reflect what's running in the title.
          title:
            existing.title === DEFAULT_TITLE
              ? titleFromCommand(input)
              : existing.title,
          updatedAt: entry.createdAt,
          entries: [...existing.entries, entry],
        });
        return entry;
      });
    });

  return { list, get, create, rename, remove, run } satisfies ThreadsRepo;
});
