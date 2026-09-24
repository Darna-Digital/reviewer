import { describe, expect, it } from "vitest";
import type { ChatModelCatalog } from "@reviewer/core/chats";
import type { ReviewComment } from "@reviewer/core/comments";
import {
  assignmentModel,
  buildChatAssignmentSettings,
  buildReviewAssignmentPrompt,
  buildReviewAssignmentTitle,
  instructionWithoutChatProviderMention,
  isChatProviderKind,
  mentionedChatProvider,
  trailingAgentMention,
} from "./chat-assignment.functions";

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
      models: [{ id: "claude-opus-4-8", label: "Claude Opus" }],
    },
    {
      id: "codex",
      label: "Codex",
      models: [{ id: "gpt-5.5", label: "GPT-5.5" }],
    },
    {
      id: "opencode",
      label: "OpenCode",
      models: [{ id: "opencode/big-pickle", label: "Big Pickle" }],
    },
  ],
};

describe("chat assignment helpers", () => {
  it("detects assignable chat providers and @mentions", () => {
    expect(isChatProviderKind("claude")).toBe(true);
    expect(isChatProviderKind("terminal")).toBe(false);
    expect(trailingAgentMention("please @co")).toBe("co");
    expect(trailingAgentMention("please @codex now")).toBeNull();
    expect(mentionedChatProvider("please ask @Codex to fix this")).toBe(
      "codex"
    );
    expect(mentionedChatProvider("@terminal run ls")).toBeNull();
  });

  it("builds provider-specific chat settings from the catalog", () => {
    expect(buildChatAssignmentSettings("claude", catalog)).toEqual({
      provider: "claude",
      model: "claude-opus-4-8",
      effort: "high",
      access: "fullAccess",
    });
    expect(buildChatAssignmentSettings("codex", catalog)).toEqual({
      provider: "codex",
      model: "gpt-5.5",
      effort: "high",
      access: "fullAccess",
    });
  });

  it("runs a new chat on the model asked for, but only its own agent's", () => {
    expect(assignmentModel("codex", catalog, "gpt-5.5")).toBe("gpt-5.5");
    // Claude's model under Codex would be a model that CLI cannot run, so the
    // provider's own answer stands instead.
    expect(assignmentModel("codex", catalog, "claude-opus-4-8")).toBe(
      "gpt-5.5"
    );
    expect(assignmentModel("cursor", catalog, "gpt-5.5")).toBe("");
    expect(
      buildChatAssignmentSettings("opencode", catalog, "opencode/big-pickle")
        .model
    ).toBe("opencode/big-pickle");
  });

  it("builds review assignment title and prompt", () => {
    const comments: ReadonlyArray<ReviewComment> = [
      {
        id: "comment-1",
        filePath: "src/a.ts",
        side: "additions",
        lineNumber: 12,
        body: "Fix this",
        author: "local",
        createdAt: "2026-01-01T00:00:00.000Z",
        target: "worktree",
        source: "local",
      },
      {
        id: "comment-2",
        filePath: "src/b.ts",
        side: "additions",
        lineNumber: 5,
        body: "Rename that",
        author: "local",
        createdAt: "2026-01-01T00:00:00.000Z",
        target: "worktree",
        source: "local",
      },
    ];

    expect(buildReviewAssignmentTitle(comments)).toBe("Fix this (+1 more)");
    expect(buildReviewAssignmentTitle([comments[0]])).toBe("Fix this");
    expect(buildReviewAssignmentTitle([{ ...comments[0], body: "   " }])).toBe(
      "Fix 1 review comment"
    );
    expect(buildReviewAssignmentPrompt(comments)).toBe(
      [
        "Address these review comments in the codebase:",
        "",
        "src/a.ts:12 - Fix this",
        "src/b.ts:5 - Rename that",
      ].join("\n")
    );
  });

  it("strips a provider @mention out of the instruction it carries", () => {
    expect(
      instructionWithoutChatProviderMention("please @claude fix", "claude")
    ).toBe("please fix");
  });
});
