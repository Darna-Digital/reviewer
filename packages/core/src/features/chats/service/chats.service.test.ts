import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { ChatsMemory } from "../layer/chats.layer.memory.ts"
import { CHAT_MODEL_CATALOG } from "../functions/chats.catalog.ts"
import type { Chat } from "../schema/chats.schema.ts"
import { ChatsService } from "./chats.service.ts"

const newChat = {
  title: "",
  provider: "claude",
  model: "claude-opus-4-8",
  effort: "high",
  access: "fullAccess",
  mode: "build",
  branch: "main",
} as const
describe("ChatsService", () => {
  it.effect("create stamps an id + default title and lists it back", () => {
    const { layer } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const created = yield* chats.create(newChat)
      expect(created.id).not.toBe("")
      expect(created.title).toBe("New thread")
      expect(created.sessionId).toBeNull()
      const all = yield* chats.list
      expect(all.map((c) => c.id)).toContain(created.id)
    }).pipe(Effect.provide(layer))
  })
  it.effect("send trims the prompt and hands the turn to the runtime", () => {
    const { layer, runtime } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const created = yield* chats.create(newChat)
      yield* chats.send(created.id, "  explain this repo  ", [])
      expect(runtime.calls.start).toEqual([
        { chatId: created.id, text: "explain this repo", images: [] },
      ])
    }).pipe(Effect.provide(layer))
  })
  it.effect("send with a blank prompt is a no-op returning the chat", () => {
    const { layer, runtime } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const created = yield* chats.create(newChat)
      const result = yield* chats.send(created.id, "   ", [])
      expect(result.id).toBe(created.id)
      expect(runtime.calls.start).toHaveLength(0)
    }).pipe(Effect.provide(layer))
  })
  it.effect(
    "send with only an image (blank prompt) still starts a turn",
    () => {
      const { layer, runtime } = ChatsMemory()
      const image = {
        name: "shot.png",
        data: "aGVsbG8=",
        thumbnail: "data:image/png;base64,abc",
      }
      return Effect.gen(function* () {
        const chats = yield* ChatsService
        const created = yield* chats.create(newChat)
        yield* chats.send(created.id, "   ", [image])
        expect(runtime.calls.start).toEqual([
          { chatId: created.id, text: "", images: [image] },
        ])
      }).pipe(Effect.provide(layer))
    }
  )
  it.effect("send while a turn is running queues the message", () => {
    const { layer, runtime } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const created = yield* chats.create(newChat)
      runtime.state.running.add(created.id)
      const result = yield* chats.send(created.id, "  again  ", [])
      expect(result.id).toBe(created.id)
      expect(runtime.calls.start).toHaveLength(0)
      expect(runtime.calls.queue).toEqual([
        { chatId: created.id, text: "again", images: [] },
      ])
    }).pipe(Effect.provide(layer))
  })
  it.effect("send surfaces a runtime busy race as ChatBusy", () => {
    const { layer, runtime } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const created = yield* chats.create(newChat)
      runtime.state.startResult = { ok: false, reason: "busy" }
      const failure = yield* Effect.flip(chats.send(created.id, "go", []))
      expect(failure._tag).toBe("ChatBusy")
    }).pipe(Effect.provide(layer))
  })
  it.effect("send to an unknown chat fails with NotFound", () => {
    const { layer } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const failure = yield* Effect.flip(chats.send("nope", "hello", []))
      expect(failure._tag).toBe("NotFound")
    }).pipe(Effect.provide(layer))
  })
  it.effect("stop interrupts through the runtime", () => {
    const { layer, runtime } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const created = yield* chats.create(newChat)
      runtime.state.running.add(created.id)
      const result = yield* chats.stop(created.id)
      expect(result.ok).toBe(true)
      expect(runtime.calls.stop).toEqual([created.id])
    }).pipe(Effect.provide(layer))
  })
  it.effect("update patches settings without touching the title", () => {
    const { layer } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const created = yield* chats.create({ ...newChat, title: "My chat" })
      const updated = yield* chats.update(created.id, {
        model: "claude-fable-5",
        effort: "low",
        mode: "plan",
      })
      expect(updated.title).toBe("My chat")
      expect(updated.model).toBe("claude-fable-5")
      expect(updated.effort).toBe("low")
      expect(updated.mode).toBe("plan")
      expect(updated.access).toBe("fullAccess")
    }).pipe(Effect.provide(layer))
  })
  it.effect(
    "switching provider clears the native session and broadcasts a snapshot",
    () => {
      const seeded: Chat = {
        id: "c-seed-1",
        title: "My chat",
        provider: "claude",
        model: "claude-opus-4-8",
        effort: "high",
        access: "fullAccess",
        mode: "build",
        branch: "main",
        sessionId: "claude-session-abc",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        messages: [],
        activities: [],
        latestTurn: null,
      }
      const { layer, runtime } = ChatsMemory([seeded])
      return Effect.gen(function* () {
        const chats = yield* ChatsService
        const updated = yield* chats.update(seeded.id, {
          provider: "codex",
          model: "gpt-5.5",
        })
        expect(updated.provider).toBe("codex")
        expect(updated.model).toBe("gpt-5.5")
        expect(updated.sessionId).toBeNull()
        expect(runtime.calls.broadcastSnapshot).toContain(seeded.id)
      }).pipe(Effect.provide(layer))
    }
  )
  it.effect(
    "a provider switch without a model falls back to the CLI default",
    () => {
      const seeded: Chat = {
        id: "c-seed-2",
        title: "My chat",
        provider: "claude",
        model: "claude-opus-4-8",
        effort: "high",
        access: "fullAccess",
        mode: "build",
        branch: "main",
        sessionId: "claude-session-xyz",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        messages: [],
        activities: [],
        latestTurn: null,
      }
      const { layer } = ChatsMemory([seeded])
      return Effect.gen(function* () {
        const chats = yield* ChatsService
        const updated = yield* chats.update(seeded.id, { provider: "opencode" })
        expect(updated.provider).toBe("opencode")
        expect(updated.model).toBe("")
        expect(updated.sessionId).toBeNull()
      }).pipe(Effect.provide(layer))
    }
  )
  it.effect("a same-provider settings patch keeps the native session", () => {
    const seeded: Chat = {
      id: "c-seed-3",
      title: "My chat",
      provider: "claude",
      model: "claude-opus-4-8",
      effort: "high",
      access: "fullAccess",
      mode: "build",
      branch: "main",
      sessionId: "claude-session-keep",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      messages: [],
      activities: [],
      latestTurn: null,
    }
    const { layer } = ChatsMemory([seeded])
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const updated = yield* chats.update(seeded.id, {
        model: "claude-fable-5",
      })
      expect(updated.model).toBe("claude-fable-5")
      expect(updated.sessionId).toBe("claude-session-keep")
    }).pipe(Effect.provide(layer))
  })
  it.effect("remove deletes the chat and tears down its runtime", () => {
    const { layer, runtime } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const created = yield* chats.create(newChat)
      yield* chats.remove(created.id)
      expect(runtime.calls.kill).toEqual([created.id])
      const all = yield* chats.list
      expect(all).toHaveLength(0)
    }).pipe(Effect.provide(layer))
  })
  it.effect("models returns the static catalog with defaults", () => {
    const { layer } = ChatsMemory()
    return Effect.gen(function* () {
      const chats = yield* ChatsService
      const catalog = yield* chats.models
      expect(catalog).toEqual(CHAT_MODEL_CATALOG)
      expect(
        catalog.providers.flatMap((p) => p.models).map((m) => m.id)
      ).toContain(catalog.defaults.model)
    }).pipe(Effect.provide(layer))
  })
})
