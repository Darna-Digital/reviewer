import { describe, expect, it, vi } from "vitest";
import type { ChatModelCatalog } from "@reviewer/core/chats";
import { assignToChat } from "./assign-to-chat.adapter";

const catalog: ChatModelCatalog = {
  defaults: {
    provider: "claude",
    model: "claude-sonnet-4-8",
    effort: "high",
    access: "fullAccess",
  },
  providers: [
    {
      id: "claude",
      label: "Claude",
      models: [
        { id: "claude-sonnet-4-8", label: "Claude Sonnet" },
        { id: "claude-opus-4-8", label: "Claude Opus" },
      ],
    },
  ],
};

describe("assignToChat", () => {
  it("starts a new chat on the model the target picked, not the default", async () => {
    const startWithTitle = vi.fn().mockResolvedValue({ id: "chat-1" });
    const chatId = await assignToChat(
      { startWithTitle, send: vi.fn() },
      {
        target: { kind: "new", agent: "claude", model: "claude-opus-4-8" },
        catalog,
        place: { branch: "main" },
        title: "Fix this",
        prompt: "Address these review comments",
      }
    );

    expect(chatId).toBe("chat-1");
    expect(startWithTitle.mock.calls[0][0]).toMatchObject({
      provider: "claude",
      model: "claude-opus-4-8",
    });
  });
});
