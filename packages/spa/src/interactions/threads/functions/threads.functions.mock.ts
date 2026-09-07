import type { AgentKind, Thread, ThreadEntry } from "@reviewer/core/threads";
import type { ThreadsDependencies } from "../interfaces/threads.interfaces";

const thread = (over: Partial<Thread> = {}): Thread => ({
  id: "t-1",
  title: "New session",
  agent: "terminal",
  branch: "main",
  initialPrompt: "",
  agentSessionId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  entries: [],
  ...over,
});

const entry = (over: Partial<ThreadEntry> = {}): ThreadEntry => ({
  id: "e-1",
  command: "echo hi",
  stdout: "hi",
  stderr: "",
  exitCode: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

/** Records calls so tests can assert how the functions orchestrate side effects. */
export function mockThreadsDependencies() {
  const calls = {
    create: [] as Array<{ title?: string; agent: AgentKind }>,
    run: [] as Array<{ id: string; command: string }>,
    rename: [] as Array<{ id: string; input: { title: string } }>,
    remove: [] as Array<string>,
  };

  const deps: ThreadsDependencies = {
    data: {},
    sideEffects: {
      create: async (input) => {
        calls.create.push(input);
        return thread({
          title: input.title ?? "New session",
          agent: input.agent,
        });
      },
      run: async (id, command) => {
        calls.run.push({ id, command });
        return entry({ command });
      },
      rename: async (id, input) => {
        calls.rename.push({ id, input });
        return thread({ id, title: input.title });
      },
      remove: async (id) => {
        calls.remove.push(id);
      },
    },
  };

  return { deps, calls };
}
