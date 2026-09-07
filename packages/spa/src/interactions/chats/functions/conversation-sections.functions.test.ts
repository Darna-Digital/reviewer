import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@reviewer/core/chats";
import { toConversationSections } from "./conversation-sections.functions";

let seq = 0;
const message = (input: Partial<ChatMessage>): ChatMessage => {
  seq += 1;
  return {
    id: `m-${seq}`,
    role: "user",
    text: "how do i deploy this?",
    turnId: `turn-${seq}`,
    streaming: false,
    createdAt: "2026-07-25T12:00:00.000Z",
    ...input,
  };
};

describe("toConversationSections", () => {
  it("makes one numbered section per user prompt, carrying its reply", () => {
    const sections = toConversationSections([
      message({ text: "first question" }),
      message({ role: "assistant", text: "an answer" }),
      message({ text: "second question" }),
    ]);
    expect(sections).toEqual([
      expect.objectContaining({
        index: 1,
        headline: "first question",
        reply: "an answer",
      }),
      expect.objectContaining({
        index: 2,
        headline: "second question",
        reply: "",
      }),
    ]);
  });

  it("flattens markdown out of the reply preview", () => {
    const [section] = toConversationSections([
      message({ text: "how?" }),
      message({
        role: "assistant",
        text: "## Steps\n\n- Run **pnpm build**\n- Read [the docs](https://x.dev)\n\n```sh\npnpm build\n```",
      }),
    ]);
    expect(section?.reply).toBe("Steps Run pnpm build Read the docs");
  });

  it("headlines a multi-line prompt with its first non-empty line", () => {
    const [section] = toConversationSections([
      message({ text: "\n  Fix the build  \n\ndetails follow" }),
    ]);
    expect(section?.headline).toBe("Fix the build");
    expect(section?.prompt).toBe("Fix the build  \n\ndetails follow");
  });

  it("clips a long headline at a word boundary", () => {
    const [section] = toConversationSections([
      message({ text: `${"deploy ".repeat(20)}now` }),
    ]);
    expect(section?.headline.endsWith("…")).toBe(true);
    expect(section?.headline.length).toBeLessThanOrEqual(73);
    expect(section?.headline).not.toContain(" …");
  });

  it("keeps an image-only prompt but drops an empty one", () => {
    const sections = toConversationSections([
      message({
        text: "   ",
        attachments: [
          { name: "shot.png", thumbnail: "data:image/png;base64," },
        ],
      }),
      message({ text: "" }),
    ]);
    expect(sections).toEqual([
      expect.objectContaining({ headline: "Question 1", attachmentCount: 1 }),
    ]);
  });
});
