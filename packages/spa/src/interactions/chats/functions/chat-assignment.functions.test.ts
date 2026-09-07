import { describe, expect, it } from "vitest";
import type { ChatModelCatalog } from "@reviewer/core/chats";
import type { ReviewComment } from "@reviewer/core/comments";
import type { VisualComment } from "@reviewer/core/visual-comments";
import {
  buildChatAssignmentSettings,
  buildReviewAssignmentPrompt,
  buildReviewAssignmentTitle,
  buildVisualAssignmentPrompt,
  buildVisualAssignmentTitle,
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

    expect(buildReviewAssignmentTitle(comments.length)).toBe(
      "Fix 2 review comments"
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

  it("builds visual assignment content from the element each comment points at", () => {
    const comments: VisualComment[] = [
      {
        id: "v-1",
        url: "http://localhost:3000/settings",
        selector: "#save",
        elementLabel: 'button#save "Save"',
        body: "This should be disabled until the form is dirty",
        author: "you",
        createdAt: "2026-01-01T00:00:00.000Z",
        screenshot: null,
        viewport: { width: 1280, height: 800 },
      },
    ];

    expect(buildVisualAssignmentTitle(1)).toBe("Fix 1 UI comment");
    expect(buildVisualAssignmentTitle(3)).toBe("Fix 3 UI comments");

    const prompt = buildVisualAssignmentPrompt(comments);
    expect(prompt).toContain("http://localhost:3000/settings");
    expect(prompt).toContain('Element: #save (button#save "Save")');
    expect(prompt).toContain("Viewport: 1280×800");
    expect(prompt).toContain("disabled until the form is dirty");
    // The agent is pointed at the browser API rather than left to guess.
    expect(prompt).toContain("reviewer skill");
  });

  it("strips a provider @mention out of the instruction it carries", () => {
    expect(
      instructionWithoutChatProviderMention("please @claude fix", "claude")
    ).toBe("please fix");
  });
});
