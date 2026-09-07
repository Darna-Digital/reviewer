import { describe, expect, it } from "vitest";
import {
  chatTurnProgram,
  withAttachedImages,
  withHistory,
} from "./providers.ts";
import {
  CHAT_MODEL_CATALOG,
  CHAT_PROVIDER_KINDS,
  chatSessionOrigin,
} from "@reviewer/core/chats";
import type { Chat, ChatMessage } from "@reviewer/core/chats";

const msg = (
  role: ChatMessage["role"],
  text: string,
  streaming = false
): ChatMessage => ({
  id: `m-${role}-${text.slice(0, 4)}`,
  role,
  text,
  turnId: "turn-1",
  streaming,
  createdAt: "",
});

const chat = (overrides: Partial<Chat> = {}): Chat => ({
  id: "c-1",
  origin: {
    projectPath: "/repo",
    projectName: "repo",
    repoPath: "/repo",
    repoName: "repo",
  },
  title: "t",
  provider: "claude",
  model: "claude-opus-4-8",
  effort: "high",
  access: "fullAccess",
  branch: "main",
  sessionId: null,
  createdAt: "",
  updatedAt: "",
  seenAt: null,
  messages: [],
  activities: [],
  latestTurn: null,
  ...overrides,
});

const shellCommand = (p: { args: ReadonlyArray<string> }) =>
  p.args.at(-1) ?? "";

describe("chatTurnProgram", () => {
  it("claude: streams json, skips permissions on full access, mints session", () => {
    const p = chatTurnProgram(chat(), "hi", { id: "sid-1", resume: false });
    const cmd = shellCommand(p);
    expect(cmd).toContain("exec 'claude' '-p' '--output-format' 'stream-json'");
    expect(cmd).toContain("'--include-partial-messages'");
    expect(cmd).toContain("'--model' 'claude-opus-4-8'");
    expect(cmd).toContain("'--dangerously-skip-permissions'");
    expect(cmd).toContain("'--session-id' 'sid-1'");
    expect(p.env["MAX_THINKING_TOKENS"]).toBe("31999");
    expect(p.stdin).toBe("hi");
  });

  it("claude: resumes a known session and gates edits on acceptEdits", () => {
    const p = chatTurnProgram(chat({ access: "acceptEdits" }), "hi", {
      id: "sid-1",
      resume: true,
    });
    const cmd = shellCommand(p);
    expect(cmd).toContain("'--permission-mode' 'acceptEdits'");
    expect(cmd).not.toContain("--dangerously-skip-permissions");
    expect(cmd).toContain("'--resume' 'sid-1'");
  });

  it("codex: exec --json with effort config, sandbox flag and stdin prompt", () => {
    const p = chatTurnProgram(
      chat({ provider: "codex", model: "gpt-5.5", effort: "medium" }),
      "do it",
      { id: null, resume: false }
    );
    const cmd = shellCommand(p);
    expect(cmd).toContain("exec 'codex' 'exec' '--json'");
    expect(cmd).toContain(`'model_reasoning_effort="medium"'`);
    expect(cmd).toContain("'--model' 'gpt-5.5'");
    expect(cmd).toContain("'--dangerously-bypass-approvals-and-sandbox'");
    expect(
      cmd.endsWith(
        "'-' || { echo \"could not start codex — is it installed and on your PATH?\" >&2; exit 127; }"
      )
    ).toBe(true);
  });

  it("codex: resume subcommand when a captured session exists", () => {
    const p = chatTurnProgram(
      chat({ provider: "codex", model: "gpt-5.5", access: "supervised" }),
      "again",
      { id: "th-7", resume: true }
    );
    const cmd = shellCommand(p);
    expect(cmd).toContain("'exec' 'resume' 'th-7'");
    expect(cmd).not.toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("opencode: run with model, resuming a captured session", () => {
    const p = chatTurnProgram(
      chat({ provider: "opencode", model: "opencode/big-pickle" }),
      "hello",
      { id: "ses_1", resume: true }
    );
    const cmd = shellCommand(p);
    expect(cmd).toContain(
      "exec 'opencode' 'run' '--model' 'opencode/big-pickle'"
    );
    expect(cmd).toContain("'--session' 'ses_1'");
  });

  it("codex: leaves the effort out when the chat has none", () => {
    // Nothing to send is not "send low": a codex model whose levels were never
    // read runs at its own default.
    const p = chatTurnProgram(
      chat({ provider: "codex", model: "gpt-5.5", effort: "" }),
      "do it",
      { id: null, resume: false }
    );
    expect(shellCommand(p)).not.toContain("model_reasoning_effort");
  });

  it("claude: spends no thinking budget on a level it has no mapping for", () => {
    const p = chatTurnProgram(chat({ effort: "xhigh" }), "hi", {
      id: null,
      resume: false,
    });
    expect(p.env["MAX_THINKING_TOKENS"]).toBeUndefined();
  });

  it("opencode: passes the model's own variant and approves on full access", () => {
    const p = chatTurnProgram(
      chat({
        provider: "opencode",
        model: "opencode/claude-opus-4-8",
        effort: "xhigh",
      }),
      "hello",
      { id: "ses_1", resume: true }
    );
    const cmd = shellCommand(p);
    expect(cmd).toContain("'--variant' 'xhigh'");
    expect(cmd).toContain("'--auto'");
    expect(cmd).toContain("'--session' 'ses_1'");
  });

  it("opencode: leaves permissions to the developer's config below full access", () => {
    // opencode has one switch, so auto-accept edits is not a tier it can be
    // asked for — it runs as supervised does, on the config.
    const p = chatTurnProgram(
      chat({
        provider: "opencode",
        model: "opencode/big-pickle",
        effort: "",
        access: "acceptEdits",
      }),
      "hello",
      { id: null, resume: false }
    );
    const cmd = shellCommand(p);
    expect(cmd).not.toContain("--auto");
    expect(cmd).not.toContain("--variant");
  });

  it("cursor: streams partial json, forces edits, prompt on stdin", () => {
    const p = chatTurnProgram(
      chat({ provider: "cursor", model: "composer-2.5" }),
      "ship it",
      { id: null, resume: false }
    );
    const cmd = shellCommand(p);
    expect(cmd).toContain(
      "exec 'cursor-agent' '-p' '--output-format' 'stream-json'"
    );
    expect(cmd).toContain("'--stream-partial-output'");
    expect(cmd).toContain("'--model' 'composer-2.5'");
    expect(cmd).toContain("'--force'");
    expect(cmd).not.toContain("--resume");
    expect(p.stdin).toBe("ship it");
  });

  it("cursor: resumes an announced session", () => {
    const p = chatTurnProgram(
      chat({ provider: "cursor", model: "composer-2.5" }),
      "what would you do?",
      { id: "s-42", resume: true }
    );
    expect(shellCommand(p)).toContain("'--resume' 's-42'");
  });

  it("cursor: supervised access never passes --force", () => {
    const p = chatTurnProgram(
      chat({ provider: "cursor", model: "composer-2.5", access: "supervised" }),
      "look around",
      { id: null, resume: false }
    );
    expect(shellCommand(p)).not.toContain("--force");
  });
});

describe("withHistory", () => {
  it("returns the prompt unchanged when there is no prior history", () => {
    expect(withHistory([], "hello")).toBe("hello");
  });

  it("prepends a transcript of prior messages for a fresh agent", () => {
    const out = withHistory(
      [msg("user", "add a button"), msg("assistant", "done, added it")],
      "now make it blue"
    );
    expect(out).toContain("<conversation_history>");
    expect(out).toContain("User: add a button");
    expect(out).toContain("Assistant: done, added it");
    // The new prompt is last, after the history block.
    expect(out.indexOf("now make it blue")).toBeGreaterThan(
      out.indexOf("</conversation_history>")
    );
  });

  it("skips blank/streaming placeholder messages", () => {
    const out = withHistory(
      [msg("user", "hi"), msg("assistant", "   ", true)],
      "next"
    );
    expect(out).toContain("User: hi");
    expect(out).not.toContain("Assistant:");
  });
});

describe("withAttachedImages", () => {
  it("returns the prompt unchanged when there are no images", () => {
    expect(withAttachedImages("look at this", [])).toBe("look at this");
  });

  it("appends image reference lines after the prompt", () => {
    const out = withAttachedImages("compare these", [
      "/tmp/a.png",
      "/tmp/b.jpg",
    ]);
    expect(out).toBe(
      "compare these\n\n[Attached image: /tmp/a.png]\n[Attached image: /tmp/b.jpg]"
    );
  });

  it("uses only the reference lines for an image-only (blank) prompt", () => {
    expect(withAttachedImages("   ", ["/tmp/a.png"])).toBe(
      "[Attached image: /tmp/a.png]"
    );
  });
});

describe("CHAT_MODEL_CATALOG", () => {
  it("covers every provider", () => {
    expect(CHAT_MODEL_CATALOG.providers.map((p) => p.id)).toEqual([
      ...CHAT_PROVIDER_KINDS,
    ]);
  });

  it("names no models — they come from the CLIs at runtime", () => {
    expect(CHAT_MODEL_CATALOG.providers.flatMap((p) => p.models)).toEqual([]);
  });

  it("defaults to no model, which every provider builds a valid turn from", () => {
    // An empty model must mean "let the CLI decide", not an empty `--model`.
    expect(CHAT_MODEL_CATALOG.defaults.model).toBe("");
    for (const provider of CHAT_PROVIDER_KINDS) {
      const program = chatTurnProgram(chat({ provider, model: "" }), "hi", {
        id: null,
        resume: false,
      });
      expect(shellCommand(program)).not.toContain("--model");
    }
  });
});

describe("chatSessionOrigin", () => {
  it("marks only the agents that let us choose the id as minted", () => {
    expect(chatSessionOrigin("claude")).toBe("minted");
    expect(chatSessionOrigin("cursor")).toBe("announced");
    expect(chatSessionOrigin("codex")).toBe("discovered");
    expect(chatSessionOrigin("opencode")).toBe("discovered");
  });
});
