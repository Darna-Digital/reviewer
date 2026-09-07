import { describe, expect, it } from "vitest";
import { CHAT_MODEL_CATALOG } from "./chats.catalog.ts";
import {
  mergeDiscoveredModels,
  modelDiscoveryCommand,
  parseDiscoveredModels,
} from "./model-discovery.ts";
import type { ChatModel, ChatProviderKind } from "../schema/chats.schema.ts";

/**
 * Recorded from the real CLIs (claude 2.1.220, codex 0.145.0, opencode 1.18.5,
 * cursor-agent 2026.07.23) rather than written by hand, so a shape we never
 * actually saw can't pass.
 */
const CLAUDE_MODEL_OUTPUT = JSON.stringify({
  is_error: false,
  num_turns: 0,
  total_cost_usd: 0,
  subtype: "success",
  type: "result",
  result:
    "Current model: Sonnet 5 (default)\nUsage: /model <name>. Available: sonnet, opus, haiku, fable, best, sonnet[1m], opus[1m], fable[1m], opusplan, default, or a full model ID.",
});

const CODEX_MODELS_OUTPUT = JSON.stringify({
  models: [
    {
      slug: "gpt-5.6-sol",
      display_name: "GPT-5.6-Sol",
      description: "Latest frontier agentic coding model.",
      default_reasoning_level: "low",
      supported_reasoning_levels: [
        { effort: "low", description: "Fast responses" },
        { effort: "medium", description: "Balances speed and depth" },
        { effort: "high", description: "Greater depth" },
        { effort: "xhigh", description: "Extra high depth" },
        { effort: "max", description: "Maximum depth" },
        { effort: "ultra", description: "Beyond maximum" },
      ],
      visibility: "list",
    },
    {
      slug: "gpt-5.6-terra",
      display_name: "GPT-5.6-Terra",
      description: "Balanced agentic coding model for everyday work.",
      supported_reasoning_levels: [
        { effort: "low", description: "Fast responses" },
        { effort: "medium", description: "Balances speed and depth" },
        { effort: "high", description: "Greater depth" },
      ],
      visibility: "list",
    },
    { slug: "gpt-5.1-codex-mini", display_name: "Mini", visibility: "hide" },
  ],
});

/**
 * opencode brokers several vendors at once and prints them in runs — its own
 * hosted models, then each upstream provider the developer has credentials
 * for. Both are represented here.
 */
const OPENCODE_MODELS_OUTPUT = [
  "opencode/big-pickle",
  "{",
  `  "id": "big-pickle",`,
  `  "providerID": "opencode",`,
  `  "name": "Big Pickle",`,
  `  "status": "active"`,
  "}",
  "opencode/north-mini-code-free",
  "{",
  `  "id": "north-mini-code-free",`,
  `  "providerID": "opencode",`,
  `  "name": "North Mini Code (free)",`,
  `  "status": "active"`,
  "}",
  "amazon-bedrock/anthropic.claude-opus-5",
  "{",
  `  "id": "anthropic.claude-opus-5",`,
  `  "providerID": "amazon-bedrock",`,
  `  "name": "Claude Opus 5",`,
  `  "status": "active",`,
  `  "variants": {`,
  `    "high": { "thinking": { "type": "enabled", "budgetTokens": 16000 } },`,
  `    "max": { "thinking": { "type": "enabled", "budgetTokens": 31999 } }`,
  `  }`,
  "}",
  "",
].join("\n");

const CURSOR_LIST_MODELS_OUTPUT = [
  "Available models",
  "",
  "auto - Auto (default)",
  "gpt-5.3-codex - Codex 5.3",
  "composer-2.5 - Composer 2.5 (current)",
  "claude-opus-5-thinking-high - Opus 5 1M Thinking",
  "claude-fable-5-thinking-high - Fable 5 1M Thinking (NO ZDR)",
  "",
].join("\n");

const ids = (models: ReadonlyArray<ChatModel>) => models.map((m) => m.id);

describe("modelDiscoveryCommand", () => {
  it("pipes the prompt in rather than leaving a CLI on an open stdin", () => {
    expect(modelDiscoveryCommand("claude")).toBe(
      `printf '%s' '/model' | claude -p --output-format json`
    );
  });

  it("asks the others for their machine-readable catalogs", () => {
    expect(modelDiscoveryCommand("codex")).toBe("codex debug models");
    // Unscoped: every vendor opencode can broker, not just its own models.
    expect(modelDiscoveryCommand("opencode")).toBe("opencode models --verbose");
    // Never `/model` in print mode: cursor-agent has no local slash commands,
    // so that would spend a billed turn and still answer in prose — and it
    // refuses to start at all in a directory the developer hasn't trusted.
    expect(modelDiscoveryCommand("cursor")).toBe("cursor-agent --list-models");
    expect(modelDiscoveryCommand("cursor")).not.toContain("/model");
  });
});

describe("parseDiscoveredModels", () => {
  it("reads claude's aliases out of its /model sentence", () => {
    const models = parseDiscoveredModels("claude", CLAUDE_MODEL_OUTPUT);
    expect(ids(models)).toEqual([
      "sonnet",
      "opus",
      "haiku",
      "fable",
      "best",
      "sonnet[1m]",
      "opus[1m]",
      "fable[1m]",
      "opusplan",
      "default",
    ]);
    // The sentence's closing clause names no model.
    expect(ids(models)).not.toContain("or a full model ID");
    expect(models[0]).toEqual({ id: "sonnet", label: "Sonnet" });
  });

  it("reads the same sentence when it arrives as plain text", () => {
    const models = parseDiscoveredModels(
      "claude",
      "Usage: /model <name>. Available: opus, haiku, or a full model ID."
    );
    expect(ids(models)).toEqual(["opus", "haiku"]);
  });

  it("reads cursor's `id - Label` lines", () => {
    const models = parseDiscoveredModels("cursor", CURSOR_LIST_MODELS_OUTPUT);
    expect(ids(models)).toEqual([
      "auto",
      "gpt-5.3-codex",
      "composer-2.5",
      "claude-opus-5-thinking-high",
      "claude-fable-5-thinking-high",
    ]);
    // The heading is not a model, and neither is the blank line under it.
    expect(ids(models)).not.toContain("Available");
  });

  it("drops cursor's active markers but keeps the rest of a label", () => {
    const models = parseDiscoveredModels("cursor", CURSOR_LIST_MODELS_OUTPUT);
    expect(models.map((m) => m.label)).toEqual([
      "Auto",
      "Codex 5.3",
      "Composer 2.5",
      "Opus 5 1M Thinking",
      // Not a marker of what's selected — part of the model's name.
      "Fable 5 1M Thinking (NO ZDR)",
    ]);
  });

  it("keeps only the models codex lists in its own picker", () => {
    const models = parseDiscoveredModels("codex", CODEX_MODELS_OUTPUT);
    expect(ids(models)).toEqual(["gpt-5.6-sol", "gpt-5.6-terra"]);
    expect(models.map((m) => m.label)).toEqual([
      "GPT-5.6-Sol",
      "GPT-5.6-Terra",
    ]);
  });

  it("reads the reasoning levels codex reports per model", () => {
    // The point of reading them: two models in the same catalog stop at
    // different levels, so one list for the agent would be wrong for both.
    const models = parseDiscoveredModels("codex", CODEX_MODELS_OUTPUT);
    expect(models[0]?.efforts).toEqual([
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
      "ultra",
    ]);
    expect(models[1]?.efforts).toEqual(["low", "medium", "high"]);
  });

  it("reads opencode's variants as the levels its models take", () => {
    const models = parseDiscoveredModels("opencode", OPENCODE_MODELS_OUTPUT);
    expect(models[2]?.efforts).toEqual(["high", "max"]);
    // A model that named no variants says nothing about effort — which is not
    // the same as saying it does none.
    expect(models[0]?.efforts).toBeUndefined();
  });

  it("reads opencode's qualified ids, not the bare ids in its objects", () => {
    const models = parseDiscoveredModels("opencode", OPENCODE_MODELS_OUTPUT);
    // `--model` wants `opencode/big-pickle`; the object only holds `big-pickle`.
    expect(ids(models)).toEqual([
      "opencode/big-pickle",
      "opencode/north-mini-code-free",
      "amazon-bedrock/anthropic.claude-opus-5",
    ]);
  });

  it("groups opencode's models by the vendor brokering them", () => {
    const models = parseDiscoveredModels("opencode", OPENCODE_MODELS_OUTPUT);
    expect(models.map((m) => m.group)).toEqual([
      "Opencode",
      "Opencode",
      "Amazon Bedrock",
    ]);
    expect(models[2]).toEqual({
      id: "amazon-bedrock/anthropic.claude-opus-5",
      label: "Claude Opus 5",
      group: "Amazon Bedrock",
      efforts: ["high", "max"],
    });
  });

  it("keeps ids whose shape isn't a plain slug", () => {
    // Bedrock versions its models with a colon and github-models nests another
    // segment; both are real ids a tighter pattern would silently drop.
    const awkward = [
      "amazon-bedrock/amazon.nova-lite-v1:0",
      "{",
      `  "id": "amazon.nova-lite-v1:0",`,
      `  "providerID": "amazon-bedrock",`,
      `  "name": "Nova Lite",`,
      `  "status": "active"`,
      "}",
      "github-models/ai21-labs/ai21-jamba-1.5-large",
      "{",
      `  "id": "ai21-labs/ai21-jamba-1.5-large",`,
      `  "providerID": "github-models",`,
      `  "name": "AI21 Jamba 1.5 Large",`,
      `  "status": "active"`,
      "}",
      "",
    ].join("\n");
    expect(ids(parseDiscoveredModels("opencode", awkward))).toEqual([
      "amazon-bedrock/amazon.nova-lite-v1:0",
      "github-models/ai21-labs/ai21-jamba-1.5-large",
    ]);
  });

  it("leaves models ungrouped for agents that only run their own", () => {
    for (const output of [CLAUDE_MODEL_OUTPUT, CODEX_MODELS_OUTPUT] as const) {
      const provider = output === CODEX_MODELS_OUTPUT ? "codex" : "claude";
      for (const model of parseDiscoveredModels(provider, output)) {
        expect(model.group).toBeUndefined();
      }
    }
  });

  it("skips a model opencode has retired", () => {
    const retired = OPENCODE_MODELS_OUTPUT.replace(
      `"status": "active"`,
      `"status": "deprecated"`
    );
    expect(ids(parseDiscoveredModels("opencode", retired))).toEqual([
      "opencode/north-mini-code-free",
      "amazon-bedrock/anthropic.claude-opus-5",
    ]);
  });

  // Discovery runs through a login+interactive shell, so anything the
  // developer's rc files print lands on stdout ahead of the payload. This is
  // not hypothetical: it was `nvm\n` on the machine these fixtures came from.
  describe("with rc-file noise on stdout", () => {
    const noisy = (output: string) => `nvm\n${output}`;

    it("still reads codex's catalog", () => {
      expect(
        ids(parseDiscoveredModels("codex", noisy(CODEX_MODELS_OUTPUT)))
      ).toEqual(["gpt-5.6-sol", "gpt-5.6-terra"]);
    });

    it("still reads claude's aliases", () => {
      const models = parseDiscoveredModels(
        "claude",
        noisy(CLAUDE_MODEL_OUTPUT)
      );
      expect(ids(models)).toContain("opus");
      expect(ids(models)).toHaveLength(10);
    });

    it("still reads opencode's models, and never as the noise line", () => {
      const models = parseDiscoveredModels(
        "opencode",
        noisy(OPENCODE_MODELS_OUTPUT)
      );
      expect(ids(models)).toEqual([
        "opencode/big-pickle",
        "opencode/north-mini-code-free",
        "amazon-bedrock/anthropic.claude-opus-5",
      ]);
      expect(ids(models)).not.toContain("nvm");
    });
  });

  it("returns nothing rather than guessing when output is unrecognisable", () => {
    for (const provider of [
      "claude",
      "codex",
      "opencode",
      "cursor",
    ] as const satisfies ReadonlyArray<ChatProviderKind>) {
      expect(parseDiscoveredModels(provider, "")).toEqual([]);
      expect(
        parseDiscoveredModels(provider, "command not found: nope\n")
      ).toEqual([]);
      expect(parseDiscoveredModels(provider, "{ not json")).toEqual([]);
    }
  });

  it("drops anything that doesn't look like a model id", () => {
    const models = parseDiscoveredModels(
      "claude",
      "Available: opus, a model you should pick, sonnet"
    );
    expect(ids(models)).toEqual(["opus", "sonnet"]);
  });
});

describe("mergeDiscoveredModels", () => {
  const catalog = CHAT_MODEL_CATALOG;
  const modelsFor = (c: typeof catalog, id: ChatProviderKind) =>
    c.providers.find((p) => p.id === id)?.models ?? [];

  it("ships no models of its own to fall back on", () => {
    // The picker is empty until the CLIs answer — by design. A list written
    // down here would start going stale the day it was written.
    expect(catalog.providers.flatMap((p) => p.models)).toEqual([]);
    expect(catalog.defaults.model).toBe("");
  });

  it("offers nothing for a provider whose CLI said nothing", () => {
    const merged = mergeDiscoveredModels(new Map());
    expect(merged).toEqual(catalog);
    expect(merged.providers.flatMap((p) => p.models)).toEqual([]);
  });

  it("carries exactly what each CLI reported, per provider", () => {
    const merged = mergeDiscoveredModels(
      new Map([
        ["codex", parseDiscoveredModels("codex", CODEX_MODELS_OUTPUT)],
        [
          "opencode",
          parseDiscoveredModels("opencode", OPENCODE_MODELS_OUTPUT),
        ] as const,
      ] as ReadonlyArray<readonly [ChatProviderKind, ReadonlyArray<ChatModel>]>)
    );
    expect(ids(modelsFor(merged, "codex"))).toEqual([
      "gpt-5.6-sol",
      "gpt-5.6-terra",
    ]);
    expect(ids(modelsFor(merged, "opencode"))).toEqual([
      "opencode/big-pickle",
      "opencode/north-mini-code-free",
      "amazon-bedrock/anthropic.claude-opus-5",
    ]);
    // One rail, several vendors — the grouping is what separates them.
    expect(new Set(modelsFor(merged, "opencode").map((m) => m.group))).toEqual(
      new Set(["Opencode", "Amazon Bedrock"])
    );
    // The CLI that wasn't installed contributes nothing, and nothing stands in.
    expect(modelsFor(merged, "cursor")).toEqual([]);
  });

  it("keeps the labels the CLIs gave, not ones derived from ids", () => {
    const merged = mergeDiscoveredModels(
      new Map([
        ["opencode", parseDiscoveredModels("opencode", OPENCODE_MODELS_OUTPUT)],
      ])
    );
    expect(modelsFor(merged, "opencode")[0]?.label).toBe("Big Pickle");
  });

  it("leaves the provider rail intact even with no models anywhere", () => {
    // The providers are the agents reviewer can drive — that set is ours, and
    // an agent that isn't installed should still be visible (and empty).
    const merged = mergeDiscoveredModels(new Map());
    expect(merged.providers.map((p) => p.id)).toEqual([
      "claude",
      "codex",
      "opencode",
      "cursor",
    ]);
  });
});
