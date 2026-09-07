/**
 * The LSP transport against a real subprocess speaking real framed JSON-RPC.
 *
 * The fake server is deliberately literal — it answers over stdio exactly as a
 * language server would, including pushing diagnostics and asking the client a
 * question back. Mocking the transport would have tested the mock; this catches
 * the failures that actually happen: a wrong Content-Length, an unanswered
 * server request that wedges the handshake, a `didOpen` the server never sees.
 */
import { Effect } from "effect";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connect, disposeConnections, languageIdOf } from "./lsp-client.ts";
import type { LspServerConfig } from "./lsp-config.ts";
import { pathToUri } from "./lsp-mapping.ts";
import { makeLspProvider } from "./lsp-provider.ts";

/**
 * A language server in one file: framed JSON-RPC over stdio, push diagnostics
 * on open, and one server-to-client request during startup.
 */
const FAKE_SERVER = String.raw`
let buffer = Buffer.alloc(0)
const send = (message) => {
  const body = Buffer.from(JSON.stringify(message), "utf8")
  process.stdout.write("Content-Length: " + body.length + "\r\n\r\n")
  process.stdout.write(body)
}
const RANGE = { start: { line: 0, character: 6 }, end: { line: 0, character: 14 } }
const OTHER = { start: { line: 4, character: 2 }, end: { line: 4, character: 10 } }
let root = ""

const handle = (message) => {
  const { id, method, params } = message
  if (method === "initialize") {
    root = params.rootUri
    send({ jsonrpc: "2.0", id, result: { capabilities: { hoverProvider: true, definitionProvider: true } } })
    // Ask the client something back; a client that ignores this wedges here.
    send({ jsonrpc: "2.0", id: 9001, method: "workspace/configuration", params: { items: [{ section: "fake" }] } })
    return
  }
  if (method === "textDocument/didOpen") {
    const uri = params.textDocument.uri
    const failing = params.textDocument.text.includes("BROKEN")
    send({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: {
        uri,
        diagnostics: failing
          ? [{ range: RANGE, severity: 2, code: "E1", source: "fake", message: "something is off", tags: [1] }]
          : [],
      },
    })
    return
  }
  if (method === "textDocument/hover") {
    send({ jsonrpc: "2.0", id, result: { range: RANGE, contents: { kind: "markdown", value: "**hovered**" } } })
    return
  }
  if (method === "textDocument/definition") {
    send({ jsonrpc: "2.0", id, result: [{ targetUri: root + "/src/a.txt", targetSelectionRange: RANGE, originSelectionRange: RANGE }] })
    return
  }
  if (method === "textDocument/references") {
    send({
      jsonrpc: "2.0",
      id,
      result: [
        { uri: root + "/src/a.txt", range: RANGE },
        { uri: root + "/src/b.txt", range: OTHER },
        { uri: "untitled:scratch", range: OTHER },
      ],
    })
    return
  }
  if (method === "shutdown") {
    send({ jsonrpc: "2.0", id, result: null })
    return
  }
  if (method === "exit") {
    process.exit(0)
  }
  if (id !== undefined) {
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: method + " is not supported" } })
  }
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  for (;;) {
    const headerEnd = buffer.indexOf("\r\n\r\n")
    if (headerEnd === -1) return
    const header = buffer.subarray(0, headerEnd).toString("ascii")
    const length = Number(/content-length: *(\d+)/i.exec(header)[1])
    const bodyStart = headerEnd + 4
    if (buffer.length < bodyStart + length) return
    const body = buffer.subarray(bodyStart, bodyStart + length).toString("utf8")
    buffer = buffer.subarray(bodyStart + length)
    handle(JSON.parse(body))
  }
})
`;

/**
 * A server that indexes before it can answer, the way ruby-lsp and
 * rust-analyzer do: it announces the work through `window/workDoneProgress`
 * a beat after the handshake, answers `textDocument/definition` with nothing
 * until that work ends, and answers properly afterwards.
 */
const INDEXING_SERVER = String.raw`
let buffer = Buffer.alloc(0)
const send = (message) => {
  const body = Buffer.from(JSON.stringify(message), "utf8")
  process.stdout.write("Content-Length: " + body.length + "\r\n\r\n")
  process.stdout.write(body)
}
const RANGE = { start: { line: 0, character: 6 }, end: { line: 0, character: 14 } }
let root = ""
let indexed = false

const handle = (message) => {
  const { id, method, params } = message
  if (method === "initialize") {
    root = params.rootUri
    send({ jsonrpc: "2.0", id, result: { capabilities: { definitionProvider: true } } })
    // A beat later, as a real server does: the client can already have asked.
    setTimeout(() => {
      send({ jsonrpc: "2.0", id: 9002, method: "window/workDoneProgress/create", params: { token: "indexing" } })
      send({ jsonrpc: "2.0", method: "$/progress", params: { token: "indexing", value: { kind: "begin", title: "indexing" } } })
    }, 20)
    setTimeout(() => {
      indexed = true
      send({ jsonrpc: "2.0", method: "$/progress", params: { token: "indexing", value: { kind: "end" } } })
    }, 250)
    return
  }
  if (method === "textDocument/definition") {
    send({
      jsonrpc: "2.0",
      id,
      result: indexed ? [{ uri: root + "/src/a.txt", range: RANGE }] : [],
    })
    return
  }
  if (method === "shutdown") {
    send({ jsonrpc: "2.0", id, result: null })
    return
  }
  if (method === "exit") process.exit(0)
  if (id !== undefined) send({ jsonrpc: "2.0", id, result: null })
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  for (;;) {
    const headerEnd = buffer.indexOf("\r\n\r\n")
    if (headerEnd === -1) return
    const header = buffer.subarray(0, headerEnd).toString("ascii")
    const length = Number(/content-length: *(\d+)/i.exec(header)[1])
    const bodyStart = headerEnd + 4
    if (buffer.length < bodyStart + length) return
    const body = buffer.subarray(bodyStart, bodyStart + length).toString("utf8")
    buffer = buffer.subarray(bodyStart + length)
    handle(JSON.parse(body))
  }
})
`;

const A_TXT = "const greeting = 1\n// BROKEN marker\n";
const B_TXT = "line0\nline1\nline2\nline3\n  greeting used here\n";

let root: string;
let config: LspServerConfig;

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "reviewer-lsp-"));
  writeFileSync(join(root, "server.mjs"), FAKE_SERVER);
  writeFileSync(join(root, "indexing.mjs"), INDEXING_SERVER);
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/a.txt"), A_TXT);
  writeFileSync(join(root, "src/b.txt"), B_TXT);
  config = {
    id: "fake",
    name: "Fake",
    patterns: [".txt"],
    command: process.execPath,
    args: [join(root, "server.mjs")],
    env: {},
    initializationOptions: null,
  };
});

afterEach(async () => {
  // Every test gets a fresh root, so cached connections would otherwise leak a
  // child process per test.
  await disposeConnections();
  rmSync(root, { recursive: true, force: true });
});

describe("languageIdOf", () => {
  it("maps known extensions", () => {
    expect(languageIdOf("src/main.rs")).toBe("rust");
    expect(languageIdOf("src/App.tsx")).toBe("typescriptreact");
    expect(languageIdOf("app/models/user.rb")).toBe("ruby");
    expect(languageIdOf("app/views/users/index.html.erb")).toBe("erb");
    expect(languageIdOf("lib/tasks/db.rake")).toBe("ruby");
  });
  it("names the files a language owns outright", () => {
    // No extension to go by, and a server told "plaintext" parses nothing.
    expect(languageIdOf("Gemfile")).toBe("ruby");
    expect(languageIdOf("api/Rakefile")).toBe("ruby");
    expect(languageIdOf("Makefile")).toBe("makefile");
  });
  it("falls back to the extension itself", () => {
    expect(languageIdOf("a.zig")).toBe("zig");
    expect(languageIdOf("LICENSE")).toBe("plaintext");
    // A dotfile has no extension, so it is not a ".gitignore" file type.
    expect(languageIdOf(".gitignore")).toBe("plaintext");
  });
});

describe("connect", () => {
  it("completes the handshake and exposes the server's capabilities", async () => {
    const connection = await connect(config, root);
    try {
      expect(connection.capabilities["hoverProvider"]).toBe(true);
      expect(connection.alive()).toBe(true);
    } finally {
      await connection.dispose();
    }
  });

  it("answers a server-to-client request so the session keeps working", async () => {
    const connection = await connect(config, root);
    try {
      // The server sends `workspace/configuration` right after initialize. If
      // the client left it unanswered a strict server would stall; this request
      // completing proves the conversation is still healthy.
      const hover = await connection.request("textDocument/hover", {
        textDocument: { uri: pathToUri(join(root, "src/a.txt")) },
        position: { line: 0, character: 8 },
      });
      expect(hover).toMatchObject({ contents: { value: "**hovered**" } });
    } finally {
      await connection.dispose();
    }
  });

  it("reports whether a document actually changed", async () => {
    const connection = await connect(config, root);
    try {
      const file = join(root, "src/a.txt");
      expect(connection.syncDocument(file, A_TXT).changed).toBe(true);
      expect(connection.syncDocument(file, A_TXT).changed).toBe(false);
      expect(connection.syncDocument(file, `${A_TXT}more\n`).changed).toBe(
        true
      );
    } finally {
      await connection.dispose();
    }
  });

  it("receives pushed diagnostics for an opened document", async () => {
    const connection = await connect(config, root);
    try {
      const { uri } = connection.syncDocument(join(root, "src/a.txt"), A_TXT);
      const published = await connection.awaitDiagnostics(uri, 3_000);
      expect(published).toHaveLength(1);
      expect(connection.diagnosticsFor(uri)).toHaveLength(1);
    } finally {
      await connection.dispose();
    }
  });

  it("surfaces a server error response as a failure", async () => {
    const connection = await connect(config, root);
    try {
      await expect(
        connection.request("textDocument/rename", {})
      ).rejects.toThrow(/not supported/);
    } finally {
      await connection.dispose();
    }
  });

  it("fails to start a command that does not exist", async () => {
    await expect(
      connect({ ...config, command: join(root, "missing-binary") }, root)
    ).rejects.toThrow();
  });

  it("is no longer alive after dispose", async () => {
    const connection = await connect(config, root);
    await connection.dispose();
    expect(connection.alive()).toBe(false);
  });
});

describe("a server that is still indexing", () => {
  const indexingConfig = (): LspServerConfig => ({
    ...config,
    id: "indexing",
    command: process.execPath,
    args: [join(root, "indexing.mjs")],
  });

  it("is waited for, so the first question is not answered from an empty index", async () => {
    const result = await run(
      makeLspProvider(indexingConfig()).definition({
        root,
        path: "src/a.txt",
        contents: null,
        position: { line: 0, character: 8 },
      })
    );
    // Without the wait this is the empty answer the server gives while it
    // works — the "go to definition does nothing if you are quick" bug.
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0]?.location.path).toBe("src/a.txt");
  });

  it("does not hold up a server that announces no work of its own", async () => {
    const started = Date.now();
    await run(
      makeLspProvider(config).definition({
        root,
        path: "src/a.txt",
        contents: null,
        position: { line: 0, character: 8 },
      })
    );
    // The grace period is a fifth of a second; the window it sits inside is
    // measured in seconds, and waiting it out would be the bug.
    expect(Date.now() - started).toBeLessThan(1_500);
  });
});

describe("makeLspProvider", () => {
  it("describes itself from the configuration", () => {
    const provider = makeLspProvider(config);
    expect(provider.id).toBe("lsp:fake");
    expect(provider.name).toBe("Fake");
    expect(provider.transport).toBe("lsp-stdio");
    expect(provider.patterns).toEqual([".txt"]);
  });

  it("reports the resolved binary", async () => {
    const availability = await run(makeLspProvider(config).probe(root));
    expect(availability.available).toBe(true);
    expect(availability.detail).toBe(process.execPath);
  });

  it("maps pushed diagnostics onto the port's shape", async () => {
    const diagnostics = await run(
      makeLspProvider(config).diagnostics({
        root,
        path: "src/a.txt",
        contents: null,
      })
    );
    expect(diagnostics).toEqual([
      {
        range: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 14 },
        },
        severity: "warning",
        code: "E1",
        source: "fake",
        message: "something is off",
        tags: ["unnecessary"],
        related: [],
      },
    ]);
  });

  it("returns no diagnostics for a clean buffer", async () => {
    const diagnostics = await run(
      makeLspProvider(config).diagnostics({
        root,
        path: "src/a.txt",
        contents: "all fine here\n",
      })
    );
    expect(diagnostics).toEqual([]);
  });

  it("resolves a definition to a repository-relative path", async () => {
    const result = await run(
      makeLspProvider(config).definition({
        root,
        path: "src/a.txt",
        contents: null,
        position: { line: 0, character: 8 },
      })
    );
    expect(result.providerId).toBe("lsp:fake");
    expect(result.targets).toHaveLength(1);
    expect(result.targets[0].location.path).toBe("src/a.txt");
    expect(result.targets[0].preview).toBe("const greeting = 1");
    // The server sent a LocationLink, so the origin span is known.
    expect(result.origin).toEqual({
      start: { line: 0, character: 6 },
      end: { line: 0, character: 14 },
    });
  });

  it("labels the declaration among the references and drops foreign URIs", async () => {
    const result = await run(
      makeLspProvider(config).references({
        root,
        path: "src/a.txt",
        contents: null,
        position: { line: 0, character: 8 },
      })
    );
    // The `untitled:` entry is not a file and cannot be opened.
    expect(result.references).toHaveLength(2);
    expect(result.references[0]).toMatchObject({
      kind: "definition",
      location: { path: "src/a.txt" },
    });
    expect(result.references[1]).toMatchObject({
      kind: "read",
      location: { path: "src/b.txt" },
      preview: "greeting used here",
    });
    expect(result.symbol).toBe("greeting");
  });

  it("returns hover markdown", async () => {
    const result = await run(
      makeLspProvider(config).hover({
        root,
        path: "src/a.txt",
        contents: null,
        position: { line: 0, character: 8 },
      })
    );
    expect(result.contents).toBe("**hovered**");
    expect(result.range).toEqual({
      start: { line: 0, character: 6 },
      end: { line: 0, character: 14 },
    });
  });

  it("stays quiet when the configured binary is missing", async () => {
    const missing = makeLspProvider({
      ...config,
      command: join(root, "not-installed"),
    });
    const availability = await run(missing.probe(root));
    expect(availability.available).toBe(false);
    expect(availability.detail).toContain("not found on PATH");

    const document = { root, path: "src/a.txt", contents: null };
    expect(await run(missing.diagnostics(document))).toEqual([]);
    expect(
      await run(
        missing.hover({ ...document, position: { line: 0, character: 0 } })
      )
    ).toEqual({ providerId: null, range: null, contents: "" });
  });
});
