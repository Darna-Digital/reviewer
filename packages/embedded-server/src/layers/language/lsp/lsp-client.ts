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
import { loginEnvironment } from "../../shell/login-environment.ts";
import { encodeMessage, makeMessageDecoder } from "./lsp-codec.ts";
import type { LspServerConfig } from "./lsp-config.ts";
import { pathToUri } from "./lsp-mapping.ts";

/** How long any single request may take before it is abandoned. */
const REQUEST_TIMEOUT_MS = 15_000;
/** How long to wait for pushed diagnostics after a document opens. */
export const PUBLISH_TIMEOUT_MS = 3_000;
/**
 * How long a freshly started server's work is waited on before it is asked
 * anything.
 *
 * A language server that is still building its index answers "nothing found"
 * rather than waiting — ruby-lsp does, and so does every server that indexes in
 * the background — so a go-to-definition in the first second of a file being
 * open silently fails and has to be repeated. Servers announce that work
 * through `window/workDoneProgress`, so the window is only ever paid where a
 * server said it had something to do, and only until it stops saying so or this
 * runs out. It is measured from the connection, not from the request: once a
 * server is warm, nothing waits for anything again.
 */
const WARMUP_MS = 2_500;
/**
 * How long a fresh server is given to say it has work to do. It announces that
 * in the moments after `initialize` is answered — a beat later than the client
 * can ask its first question — so a server that has said nothing yet is waited
 * on this long before it is taken at its word.
 */
const ANNOUNCE_MS = 200;
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
  /**
   * Wait, briefly, for work the server announced when it started — see
   * {@link WARMUP_MS}. Resolves at once for a server that announced none, and
   * for every request once the connection is warm.
   */
  readonly warmup: () => Promise<void>;
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
  ".erb": "erb",
  ".gemspec": "ruby",
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
  ".rake": "ruby",
  ".rb": "ruby",
  ".rs": "rust",
  ".ru": "ruby",
  ".scala": "scala",
  ".sh": "shellscript",
  ".swift": "swift",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".yaml": "yaml",
  ".yml": "yaml",
};

/** Files a language owns outright, which carry no extension to go by. */
const BASENAME_LANGUAGE_IDS: Readonly<Record<string, string>> = {
  dockerfile: "dockerfile",
  gemfile: "ruby",
  makefile: "makefile",
  rakefile: "ruby",
};

/** LSP `languageId` for a path — the extension itself when unmapped. */
export const languageIdOf = (path: string): string => {
  const name = path.slice(
    Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1
  );
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return BASENAME_LANGUAGE_IDS[name.toLowerCase()] ?? "plaintext";
  const extension = name.slice(dot).toLowerCase();
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
      // The developer's environment, not this process's: finding `ruby-lsp` is
      // only half of it — the server itself then runs `ruby`, and `bundle exec`
      // needs the version manager that put both of them there.
      env: { ...process.env, ...loginEnvironment(), ...config.env },
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
  /** Work-done progress the server has begun and not yet ended. */
  const working = new Set<string>();
  /** Woken whenever that set changes, so a warm-up can stop waiting. */
  const progressWaiters = new Set<() => void>();
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
    working.clear();
    for (const waiter of progressWaiters) waiter();
    progressWaiters.clear();
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

  /** Note that the server has begun, or finished, a piece of announced work. */
  const trackProgress = (params: unknown, begun: boolean) => {
    if (typeof params !== "object" || params === null) return;
    const token = (params as { token?: unknown }).token;
    if (typeof token !== "string" && typeof token !== "number") return;
    const key = String(token);
    const before = working.size;
    if (begun) working.add(key);
    else working.delete(key);
    if (working.size === before) return;
    for (const waiter of progressWaiters) waiter();
    progressWaiters.clear();
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

  /** The window a fresh connection's answers are waited for; see {@link WARMUP_MS}. */
  let warmUntil = 0;

  /** Resolve when the announced work changes, or after `ms`. */
  const progressChanged = (ms: number) =>
    new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        progressWaiters.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      timer.unref?.();
      progressWaiters.add(finish);
    });

  const warmup = async (): Promise<void> => {
    if (working.size === 0) {
      const grace = Math.min(ANNOUNCE_MS, warmUntil - Date.now());
      if (grace <= 0) return;
      await progressChanged(grace);
      // Still nothing announced: the server has nothing to wait for.
      if (working.size === 0) return;
    }
    while (alive && working.size > 0) {
      const remaining = warmUntil - Date.now();
      if (remaining <= 0) return;
      await progressChanged(remaining);
    }
  };

  const handle = (message: unknown) => {
    if (typeof message !== "object" || message === null) return;
    const record = message as Record<string, unknown>;
    const id = record["id"];
    const method = record["method"];

    if (typeof method === "string") {
      if (id !== undefined) {
        // A server asks before it reports; the token is what the reports carry.
        if (method === "window/workDoneProgress/create") {
          trackProgress(record["params"], true);
        }
        respondToServer(id, method);
        return;
      }
      if (method === "$/progress") {
        const params = record["params"];
        const value =
          typeof params === "object" && params !== null
            ? (params as { value?: unknown }).value
            : undefined;
        const kind =
          typeof value === "object" && value !== null
            ? (value as { kind?: unknown }).kind
            : undefined;
        // "report" says the same work is still going, which is already known.
        if (kind === "begin") trackProgress(params, true);
        else if (kind === "end") trackProgress(params, false);
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
    clientInfo: { name: "reviewer" },
    rootUri: pathToUri(root),
    workspaceFolders: [{ uri: pathToUri(root), name: "workspace" }],
    capabilities: clientCapabilities,
    initializationOptions: config.initializationOptions ?? null,
  })) as { capabilities?: unknown } | null;

  notify("initialized", {});
  // From here, not from the spawn: a server that spends a second setting itself
  // up before answering `initialize` has not started its real work yet.
  warmUntil = Date.now() + WARMUP_MS;

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
    warmup,
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
