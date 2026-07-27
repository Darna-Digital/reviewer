import { describe, expect, it } from "vitest"
import { cursorChatIdFrom } from "./cursor-chat.ts"

const UUID = "3f2b1c8a-9d4e-4f6b-8a1c-77e0d2b5c913"

describe("cursorChatIdFrom", () => {
  it("finds nothing in empty or still-arriving output", () => {
    expect(cursorChatIdFrom("")).toBe(null)
    expect(cursorChatIdFrom("\n \n")).toBe(null)
  })

  it("reads a bare uuid", () => {
    expect(cursorChatIdFrom(`${UUID}\n`)).toBe(UUID)
  })

  it("finds the uuid behind a banner or a progress line", () => {
    expect(cursorChatIdFrom(`Creating chat…\nChat created: ${UUID}\n`)).toBe(
      UUID
    )
  })

  it("survives login-shell noise on stdout", () => {
    expect(cursorChatIdFrom(`nvm: version resolved\r\n${UUID}\r\n`)).toBe(UUID)
  })

  it("prefers the uuid over an unrelated bare-token line before it", () => {
    expect(cursorChatIdFrom(`workspace\n${UUID}\n`)).toBe(UUID)
  })

  it("accepts a bare opaque id once its line is terminated", () => {
    expect(cursorChatIdFrom("  chat_ab12cd34  \n")).toBe("chat_ab12cd34")
  })

  it("waits out a bare token that a chunk boundary may have cut in half", () => {
    // Half an id resumes nothing, so an unterminated last line is only trusted
    // once the process has stopped writing.
    expect(cursorChatIdFrom("chat_ab12")).toBe(null)
    expect(cursorChatIdFrom("chat_ab12cd34", { atEnd: true })).toBe(
      "chat_ab12cd34"
    )
  })

  it("never returns a truncated uuid, terminated or not", () => {
    const half = UUID.slice(0, 19)
    expect(cursorChatIdFrom(half)).toBe(null)
    expect(cursorChatIdFrom(`${half}\n`)).toBe(null)
    expect(cursorChatIdFrom(half, { atEnd: true })).toBe(null)
  })

  it("does not mistake prose for an id", () => {
    expect(cursorChatIdFrom("Created a new chat in this workspace.\n")).toBe(
      null
    )
    expect(
      cursorChatIdFrom("could not start cursor-agent — is it installed?\n")
    ).toBe(null)
  })

  it("does not mistake a too-short or too-long token for an id", () => {
    expect(cursorChatIdFrom("abc\n")).toBe(null)
    expect(cursorChatIdFrom(`${"a".repeat(65)}\n`)).toBe(null)
  })

  it("is stable as output accumulates chunk by chunk", () => {
    // The caller re-parses the whole buffer on every chunk; a partial uuid must
    // not resolve early, and the answer must not change once it has.
    const partial = UUID.slice(0, 20)
    expect(cursorChatIdFrom(`Chat created: ${partial}`)).toBe(null)
    expect(cursorChatIdFrom(`Chat created: ${UUID}`)).toBe(UUID)
    expect(cursorChatIdFrom(`Chat created: ${UUID}\nready\n`)).toBe(UUID)
  })
})
