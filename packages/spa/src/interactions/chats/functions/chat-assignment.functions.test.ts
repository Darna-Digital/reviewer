import { describe, expect, it } from "vitest";
import type { ChatModelCatalog } from "@reviewer/core/chats";
import type { ReviewComment } from "@reviewer/core/comments";
import type { VisualComment } from "@reviewer/core/visual-comments";
import {
  assignmentModel,
  buildChatAssignmentSettings,
  buildHandoffPrompt,
  buildHandoffTitle,
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
    expect(prompt).not.toContain("Style changes");
  });

  it("hands over the style changes tried on the element", () => {
    const prompt = buildVisualAssignmentPrompt([
      {
        id: "v-2",
        url: "http://localhost:3000/",
        selector: "header > h1",
        elementLabel: 'h1 "Tools"',
        body: "",
        author: "you",
        createdAt: "2026-01-01T00:00:00.000Z",
        screenshot: null,
        viewport: { width: 1280, height: 800 },
        styleChanges: [
          { property: "color", from: "rgb(0, 0, 0)", to: "#38bdf8" },
          { property: "font-size", from: "48px", to: "56px" },
        ],
      },
    ]);
    expect(prompt).toContain("Style changes:\n  color: rgb(0, 0, 0) → #38bdf8");
    expect(prompt).toContain("  font-size: 48px → 56px");
  });

  it("hands the code and the UI over as one review", () => {
    const review: ReadonlyArray<ReviewComment> = [
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
    ];
    const visual: ReadonlyArray<VisualComment> = [
      {
        id: "v-1",
        url: "http://localhost:3000/settings",
        selector: "#save",
        elementLabel: 'button#save "Save"',
        body: "Disabled until the form is dirty",
        author: "you",
        createdAt: "2026-01-01T00:00:00.000Z",
        screenshot: null,
        viewport: { width: 1280, height: 800 },
      },
    ];

    expect(buildHandoffTitle(1, 1)).toBe("Fix 2 review comments");
    const prompt = buildHandoffPrompt(review, visual);
    expect(prompt).toContain("src/a.ts:12 - Fix this");
    expect(prompt).toContain("Element: #save");

    // One kind on its own still reads as that kind, not as a combined review.
    expect(buildHandoffTitle(0, 3)).toBe("Fix 3 UI comments");
    expect(buildHandoffTitle(2, 0)).toBe("Fix 2 review comments");
    expect(buildHandoffPrompt(review, [])).toBe(
      buildReviewAssignmentPrompt(review)
    );
    expect(buildHandoffPrompt([], visual)).toBe(
      buildVisualAssignmentPrompt(visual)
    );
  });

  it("strips a provider @mention out of the instruction it carries", () => {
    expect(
      instructionWithoutChatProviderMention("please @claude fix", "claude")
    ).toBe("please fix");
  });
});
