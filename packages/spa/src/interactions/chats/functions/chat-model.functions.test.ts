import { describe, expect, it } from "vitest";
import type { ChatModelCatalog } from "@byconvo/core/chats";
import { preferredChatModel } from "./chat-model.functions";

const catalog: ChatModelCatalog = {
  defaults: {
    provider: "claude",
    model: "claude-opus-4-8",
    effort: "high",
    access: "fullAccess",
  },
  providers: [
    {
      id: "claude",
      label: "Claude",
      models: [
        { id: "claude-fable-5", label: "Fable" },
        { id: "claude-opus-4-8", label: "Claude Opus" },
      ],
    },
    {
      id: "codex",
      label: "Codex",
      models: [{ id: "gpt-5.5", label: "GPT-5.5" }],
    },
  ],
};

describe("preferredChatModel", () => {
  it("picks the first favorite in catalog order", () => {
    expect(preferredChatModel(catalog, ["gpt-5.5", "claude-opus-4-8"])).toEqual(
      expect.objectContaining({ id: "claude-opus-4-8", provider: "claude" })
    );
    expect(preferredChatModel(catalog, ["gpt-5.5"])).toEqual(
      expect.objectContaining({ id: "gpt-5.5", provider: "codex" })
    );
  });

  it("falls back to the first model when no favorite is available", () => {
    expect(preferredChatModel(catalog, [])).toEqual(
      expect.objectContaining({ id: "claude-fable-5", provider: "claude" })
    );
    expect(preferredChatModel(catalog, ["retired-model"])).toEqual(
      expect.objectContaining({ id: "claude-fable-5", provider: "claude" })
    );
  });

  it("returns undefined without a catalog", () => {
    expect(preferredChatModel(undefined, ["gpt-5.5"])).toBeUndefined();
  });
});
