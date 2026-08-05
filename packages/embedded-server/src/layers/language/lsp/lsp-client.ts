/**
 * A minimal, correct LSP client over stdio: spawn, initialise, keep documents
 * in sync, correlate requests, and stay usable after the server dies.
 *
 * Connections are cached per repository and server, because initialising a real
 * language server is the expensive part — rust-analyzer indexes a crate before
 * it answers anything. The first request pays for it; the rest are cheap.
 *
 * Document synchronisation is deliberately close/open rather than incremental.
 * A server may declare `TextDocumentSyncKind.Incremental`, in which case sending
 * whole-document changes is off-spec and strict servers reject it; closing and
 * reopening is valid under every sync kind, and a review tool changes documents
 * rarely enough that the extra work does not matter.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { encodeMessage, makeMessageDecoder } from "./lsp-codec.ts";
import type { LspServerConfig } from "./lsp-config.ts";
import { pathToUri } from "./lsp-mapping.ts";

/** How long any single request may take before it is abandoned. */
const REQUEST_TIMEOUT_MS = 15_000;
/** How long to wait for pushed diagnostics after a document opens. */
export const PUBLISH_TIMEOUT_MS = 3_000;
/** Grace period between `exit` and killing the process. */
const SHUTDOWN_GRACE_MS = 1_000;
/** Stderr kept for error messages, in lines. */
const STDERR_LINES = 20;

export class LspServerError extends Error {}

interface Pending {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timer: NodeJS.Timeout;
}

export interface LspConnection {
  readonly serverId: string;
  readonly capabilities: Record<string, unknown>;
  readonly request: (method: string, params: unknown) => Promise<unknown>;
  readonly notify: (method: string, params: unknown) => void;
  /**
   * Sync `text` for `absolutePath`. `changed` is false when the server already
   * holds this exact text, so the caller knows no fresh publish is coming.
   */
  readonly syncDocument: (
    absolutePath: string,
    text: string
  ) => { readonly uri: string; readonly changed: boolean };
  readonly diagnosticsFor: (uri: string) => ReadonlyArray<unknown>;
  /** Resolve when the server publishes diagnostics for `uri`, or on timeout. */
  readonly awaitDiagnostics: (
    uri: string,
    timeoutMs: number
  ) => Promise<ReadonlyArray<unknown>>;
  readonly dispose: () => Promise<void>;
  readonly alive: () => boolean;
}

const LANGUAGE_IDS: Readonly<Record<string, string>> = {
  ".c": "c",
  ".cc": "cpp",
  ".cjs": "javascript",
  ".cpp": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".cts": "typescript",
  ".go": "go",
  ".h": "c",
  ".hpp": "cpp",
  ".java": "java",
  ".js": "javascript",
  ".json": "json",
  ".jsx": "javascriptreact",
  ".kt": "kotlin",
  ".lua": "lua",
  ".mjs": "javascript",
  ".mts": "typescript",
  ".php": "php",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".scala": "scala",
  ".sh": "shellscript",
  ".swift": "swift",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".yaml": "yaml",
  ".yml": "yaml",
};

/** LSP `languageId` for a path — the extension itself when unmapped. */
export const languageIdOf = (path: string): string => {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "plaintext";
  const extension = path.slice(dot).toLowerCase();
  return LANGUAGE_IDS[extension] ?? extension.slice(1);
};

/** Capabilities we actually implement — claiming more invites unhandled calls. */
const clientCapabilities = {
  textDocument: {
    synchronization: { dynamicRegistration: false },
    publishDiagnostics: {
      relatedInformation: true,
      tagSupport: { valueSet: [1, 2] },
    },
    diagnostic: { dynamicRegistration: false },
    definition: { linkSupport: true },
    references: {},
    hover: { contentFormat: ["markdown", "plaintext"] },
  },
  workspace: { workspaceFolders: true, configuration: true },
  window: { workDoneProgress: true },
} as const;

export const connect = async (
  config: LspServerConfig,
  root: string
): Promise<LspConnection> => {
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(config.command, [...config.args], {
      cwd: root,
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    throw new LspServerError(
      `could not start "${config.command}": ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const pending = new Map<number, Pending>();
  const diagnostics = new Map<string, ReadonlyArray<unknown>>();
  const publishWaiters = new Map<
    string,
    Set<(items: ReadonlyArray<unknown>) => void>
  >();
  const openDocuments = new Map<string, { version: number; text: string }>();
  const stderr: Array<string> = [];
  const decoder = makeMessageDecoder();

  let nextId = 0;
  let alive = true;
  let exitReason: string | null = null;

  const failAll = (error: Error) => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
    for (const waiters of publishWaiters.values()) {
      for (const waiter of waiters) waiter([]);
    }
    publishWaiters.clear();
  };

  const send = (message: unknown) => {
    if (!alive)
      throw new LspServerError(exitReason ?? `${config.id} is not running`);
    child.stdin.write(encodeMessage(message));
  };

  const request = (method: string, params: unknown): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new LspServerError(`${config.id} did not answer ${method} in time`)
        );
      }, REQUEST_TIMEOUT_MS);
      // Node keeps the process alive for a pending timer; this one is a
      // watchdog, not work.
      timer.unref?.();
      pending.set(id, { resolve, reject, timer });
      try {
        send({ jsonrpc: "2.0", id, method, params });
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(
          error instanceof Error ? error : new LspServerError(String(error))
        );
      }
    });

  const notify = (method: string, params: unknown) => {
    if (!alive) return;
    send({ jsonrpc: "2.0", method, params });
  };

  /** Answer the few server-to-client requests a client must not ignore. */
  const respondToServer = (id: unknown, method: string) => {
    // `workspace/configuration` expects one entry per requested section; an
    // empty object means "no overrides", which every server accepts.
    const result =
      method === "workspace/configuration"
        ? [{}]
        : method === "client/registerCapability" ||
            method === "client/unregisterCapability" ||
            method === "window/workDoneProgress/create"
          ? null
          : undefined;
    if (result === undefined) {
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `${method} is not supported` },
      });
      return;
    }
    send({ jsonrpc: "2.0", id, result });
  };

  const handle = (message: unknown) => {
    if (typeof message !== "object" || message === null) return;
    const record = message as Record<string, unknown>;
    const id = record["id"];
    const method = record["method"];

    if (typeof method === "string") {
      if (id !== undefined) {
        respondToServer(id, method);
        return;
      }
      if (method === "textDocument/publishDiagnostics") {
        const params = record["params"];
        if (typeof params !== "object" || params === null) return;
        const { uri, diagnostics: items } = params as {
          uri?: unknown;
          diagnostics?: unknown;
        };
        if (typeof uri !== "string") return;
        const list = Array.isArray(items) ? items : [];
        diagnostics.set(uri, list);
        const waiters = publishWaiters.get(uri);
        if (waiters !== undefined) {
          publishWaiters.delete(uri);
          for (const waiter of waiters) waiter(list);
        }
      }
      return;
    }

    if (typeof id !== "number") return;
    const entry = pending.get(id);
    if (entry === undefined) return;
    pending.delete(id);
    clearTimeout(entry.timer);
    const error = record["error"];
    if (error !== undefined) {
      const reason =
        typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : JSON.stringify(error);
      entry.reject(new LspServerError(`${config.id}: ${reason}`));
      return;
    }
    entry.resolve(record["result"]);
  };

  child.stdout.on("data", (chunk: Buffer) => {
    for (const message of decoder.push(chunk).messages) handle(message);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr.push(...chunk.toString("utf8").split("\n"));
    if (stderr.length > STDERR_LINES)
      stderr.splice(0, stderr.length - STDERR_LINES);
  });
  child.on("error", (error) => {
    alive = false;
    exitReason = `${config.command} failed to start: ${error.message}`;
    failAll(new LspServerError(exitReason));
  });
  child.on("exit", (code, signal) => {
    alive = false;
    const tail = stderr.join("\n").trim();
    exitReason = `${config.id} exited (${signal ?? code})${tail.length > 0 ? `: ${tail}` : ""}`;
    failAll(new LspServerError(exitReason));
  });

  const initializeResult = (await request("initialize", {
    processId: process.pid,
    clientInfo: { name: "byconvo" },
    rootUri: pathToUri(root),
    workspaceFolders: [{ uri: pathToUri(root), name: "workspace" }],
    capabilities: clientCapabilities,
    initializationOptions: config.initializationOptions ?? null,
  })) as { capabilities?: unknown } | null;

  notify("initialized", {});

  const capabilities =
    initializeResult !== null &&
    typeof initializeResult === "object" &&
    typeof initializeResult.capabilities === "object" &&
    initializeResult.capabilities !== null
      ? (initializeResult.capabilities as Record<string, unknown>)
      : {};

  const syncDocument = (absolutePath: string, text: string) => {
    const uri = pathToUri(absolutePath);
    const open = openDocuments.get(uri);
    if (open !== undefined && open.text === text)
      return { uri, changed: false };
    if (open !== undefined) {
      notify("textDocument/didClose", { textDocument: { uri } });
    }
    const version = (open?.version ?? 0) + 1;
    openDocuments.set(uri, { version, text });
    notify("textDocument/didOpen", {
      textDocument: {
        uri,
        languageId: languageIdOf(absolutePath),
        version,
        text,
      },
    });
    return { uri, changed: true };
  };

  const awaitDiagnostics = (uri: string, timeoutMs: number) =>
    new Promise<ReadonlyArray<unknown>>((resolve) => {
      let settled = false;
      const finish = (items: ReadonlyArray<unknown>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        waiters.delete(finish);
        resolve(items);
      };
      const timer = setTimeout(
        () => finish(diagnostics.get(uri) ?? []),
        timeoutMs
      );
      timer.unref?.();
      const waiters = publishWaiters.get(uri) ?? new Set();
      publishWaiters.set(uri, waiters);
      waiters.add(finish);
    });

  const dispose = async () => {
    if (!alive) return;
    try {
      await request("shutdown", null);
      notify("exit", null);
    } catch {
      // A server that will not shut down cleanly gets killed below.
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, SHUTDOWN_GRACE_MS);
      timer.unref?.();
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    alive = false;
  };

  return {
    serverId: config.id,
    capabilities,
    request,
    notify,
    syncDocument,
    diagnosticsFor: (uri) => diagnostics.get(uri) ?? [],
    awaitDiagnostics,
    dispose,
    alive: () => alive,
  };
};

interface CacheEntry {
  readonly key: string;
  connection: Promise<LspConnection> | null;
}

const connections = new Map<string, CacheEntry>();

/**
 * The live connection for a server in a repository, started on first use.
 * A server that died since the last request is started again rather than
 * failing every request until a restart.
 */
export const connectionFor = async (
  config: LspServerConfig,
  root: string
): Promise<LspConnection> => {
  const key = `${root} ${config.id}`;
  const entry = connections.get(key) ?? { key, connection: null };
  connections.set(key, entry);

  if (entry.connection !== null) {
    try {
      const existing = await entry.connection;
      if (existing.alive()) return existing;
    } catch {
      // Fall through and start a fresh one.
    }
  }

  const started = connect(config, root);
  entry.connection = started;
  try {
    return await started;
  } catch (error) {
    entry.connection = null;
    throw error;
  }
};

/** Shut every language server down — called when the process is going away. */
export const disposeConnections = async (): Promise<void> => {
  const entries = [...connections.values()];
  connections.clear();
  await Promise.all(
    entries.map(async (entry) => {
      try {
        const connection = await entry.connection;
        await connection?.dispose();
      } catch {
        // Already gone.
      }
    })
  );
};
