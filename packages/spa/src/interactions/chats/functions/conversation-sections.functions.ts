/**
 * Splits a thread into the sections the timeline's rail draws.
 *
 * A conversation has no headings of its own, so the questions the reader asked
 * stand in for them: every user prompt opens a section that runs until the next
 * one. A question alone rarely identifies a section from memory — what was said
 * back is the recognisable part — so each section also carries the opening of
 * the reply it got.
 *
 * Pure, so the headline rules stay testable without a rendered thread.
 */
import type { ChatMessage } from "@byconvo/core/chats"

export interface ConversationSection {
  /** The user message the section starts at — also its scroll anchor. */
  readonly id: string
  /** 1-based position, shown when a prompt has no usable headline. */
  readonly index: number
  readonly headline: string
  readonly prompt: string
  /** The start of the answer this question got, empty until one arrives. */
  readonly reply: string
  readonly attachmentCount: number
}

const HEADLINE_LIMIT = 72

/** Long pastes and system preambles arrive as one wall of text; the first
 * sentence-ish fragment is the only part that reads as a title. */
const toHeadline = (prompt: string): string => {
  const firstLine = prompt
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  if (firstLine === undefined) return ""
  if (firstLine.length <= HEADLINE_LIMIT) return firstLine
  const clipped = firstLine.slice(0, HEADLINE_LIMIT)
  const lastSpace = clipped.lastIndexOf(" ")
  return `${(lastSpace > HEADLINE_LIMIT / 2 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`
}

const REPLY_LIMIT = 320

/** The preview is a few lines of plain text, so markdown punctuation — fences,
 * bullets, emphasis, link targets — is noise that costs it a whole line. */
const toReplyPreview = (reply: string): string =>
  reply
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[#>]+|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, REPLY_LIMIT)

export function toConversationSections(
  messages: ReadonlyArray<ChatMessage>
): ConversationSection[] {
  const sections: ConversationSection[] = []
  let awaitingReply: number | null = null
  for (const message of messages) {
    if (message.role === "assistant") {
      if (awaitingReply === null) continue
      const section = sections[awaitingReply]
      if (section !== undefined) {
        sections[awaitingReply] = {
          ...section,
          reply: toReplyPreview(message.text),
        }
      }
      awaitingReply = null
      continue
    }
    const attachmentCount = message.attachments?.length ?? 0
    const prompt = message.text.trim()
    if (prompt.length === 0 && attachmentCount === 0) continue
    const index = sections.length + 1
    awaitingReply = sections.length
    sections.push({
      id: message.id,
      index,
      headline: toHeadline(prompt) || `Question ${index}`,
      prompt,
      reply: "",
      attachmentCount,
    })
  }
  return sections
}
