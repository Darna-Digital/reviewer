import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect, vi } from "vitest";
import { memoryLayer as terminalMemory } from "../../../ports/terminal-exec.ts";
import { ChatsMemory } from "../layer/chats.layer.memory.ts";
import { CHAT_MODEL_CATALOG } from "../functions/chats.catalog.ts";
import type { Chat } from "../schema/chats.schema.ts";
import { ChatsService } from "./chats.service.ts";

/**
 * A stand-in for the agent CLIs the catalog is discovered from: codex answers
 * with a model the curated catalog has never heard of, everything else stays
 * quiet. `seen` records the commands, so a test can tell a cache hit from a
 * second round of subprocesses.
 */
const terminalReturning = (seen: string[] = []) =>
  terminalMemory((command) => {
    seen.push(command);
    const stdout = command.startsWith("codex ")
      ? JSON.stringify({
          models: [
            {
              slug: "gpt-9-turbo",
              display_name: "GPT-9 Turbo",
              visibility: "list",
            },
          ],
        })
      : "";
    return { stdout, stderr: "", exitCode: 0 };
  });

const newChat = {
  title: "",
  provider: "claude",
  model: "claude-opus-4-8",
  effort: "high",
  access: "fullAccess",
  branch: "main",
} as const;
describe("ChatsService", () => {
  it.effect("create stamps an id + default title and lists it back", () => {
    const { layer } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const created = yield* chats.create(newChat);
      expect(created.id).not.toBe("");
      expect(created.title).toBe("New thread");
      expect(created.sessionId).toBeNull();
      const all = yield* chats.list;
      expect(all.map((c) => c.id)).toContain(created.id);
    }).pipe(Effect.provide(layer));
  });
  it.effect("send trims the prompt and hands the turn to the runtime", () => {
    const { layer, runtime } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const created = yield* chats.create(newChat);
      yield* chats.send(created.id, "  explain this repo  ", []);
      expect(runtime.calls.start).toEqual([
        { chatId: created.id, text: "explain this repo", images: [] },
      ]);
    }).pipe(Effect.provide(layer));
  });
  it.effect("send with a blank prompt is a no-op returning the chat", () => {
    const { layer, runtime } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const created = yield* chats.create(newChat);
      const result = yield* chats.send(created.id, "   ", []);
      expect(result.id).toBe(created.id);
      expect(runtime.calls.start).toHaveLength(0);
    }).pipe(Effect.provide(layer));
  });
  it.effect(
    "send with only an image (blank prompt) still starts a turn",
    () => {
      const { layer, runtime } = ChatsMemory();
      const image = {
        name: "shot.png",
        data: "aGVsbG8=",
        thumbnail: "data:image/png;base64,abc",
      };
      return Effect.gen(function* () {
        const chats = yield* ChatsService;
        const created = yield* chats.create(newChat);
        yield* chats.send(created.id, "   ", [image]);
        expect(runtime.calls.start).toEqual([
          { chatId: created.id, text: "", images: [image] },
        ]);
      }).pipe(Effect.provide(layer));
    }
  );
  it.effect("send while a turn is running queues the message", () => {
    const { layer, runtime } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const created = yield* chats.create(newChat);
      runtime.state.running.add(created.id);
      const result = yield* chats.send(created.id, "  again  ", []);
      expect(result.id).toBe(created.id);
      expect(runtime.calls.start).toHaveLength(0);
      expect(runtime.calls.queue).toEqual([
        { chatId: created.id, text: "again", images: [] },
      ]);
    }).pipe(Effect.provide(layer));
  });
  it.effect("send surfaces a runtime busy race as ChatBusy", () => {
    const { layer, runtime } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const created = yield* chats.create(newChat);
      runtime.state.startResult = { ok: false, reason: "busy" };
      const failure = yield* Effect.flip(chats.send(created.id, "go", []));
      expect(failure._tag).toBe("ChatBusy");
    }).pipe(Effect.provide(layer));
  });
  it.effect("send to an unknown chat fails with NotFound", () => {
    const { layer } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const failure = yield* Effect.flip(chats.send("nope", "hello", []));
      expect(failure._tag).toBe("NotFound");
    }).pipe(Effect.provide(layer));
  });
  it.effect("stop interrupts through the runtime", () => {
    const { layer, runtime } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const created = yield* chats.create(newChat);
      runtime.state.running.add(created.id);
      const result = yield* chats.stop(created.id);
      expect(result.ok).toBe(true);
      expect(runtime.calls.stop).toEqual([created.id]);
    }).pipe(Effect.provide(layer));
  });
  it.effect("update patches settings without touching the title", () => {
    const { layer } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const created = yield* chats.create({ ...newChat, title: "My chat" });
      const updated = yield* chats.update(created.id, {
        model: "claude-fable-5",
        effort: "low",
      });
      expect(updated.title).toBe("My chat");
      expect(updated.model).toBe("claude-fable-5");
      expect(updated.effort).toBe("low");
      expect(updated.access).toBe("fullAccess");
    }).pipe(Effect.provide(layer));
  });
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
              branch: "main",
        sessionId: "claude-session-abc",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        messages: [],
        activities: [],
        latestTurn: null,
      };
      const { layer, runtime } = ChatsMemory([seeded]);
      return Effect.gen(function* () {
        const chats = yield* ChatsService;
        const updated = yield* chats.update(seeded.id, {
          provider: "codex",
          model: "gpt-5.5",
        });
        expect(updated.provider).toBe("codex");
        expect(updated.model).toBe("gpt-5.5");
        expect(updated.sessionId).toBeNull();
        expect(runtime.calls.broadcastSnapshot).toContain(seeded.id);
      }).pipe(Effect.provide(layer));
    }
  );
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
              branch: "main",
        sessionId: "claude-session-xyz",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        messages: [],
        activities: [],
        latestTurn: null,
      };
      const { layer } = ChatsMemory([seeded]);
      return Effect.gen(function* () {
        const chats = yield* ChatsService;
        const updated = yield* chats.update(seeded.id, {
          provider: "opencode",
        });
        expect(updated.provider).toBe("opencode");
        expect(updated.model).toBe("");
        expect(updated.sessionId).toBeNull();
      }).pipe(Effect.provide(layer));
    }
  );
  it.effect("a same-provider settings patch keeps the native session", () => {
    const seeded: Chat = {
      id: "c-seed-3",
      title: "My chat",
      provider: "claude",
      model: "claude-opus-4-8",
      effort: "high",
      access: "fullAccess",
          branch: "main",
      sessionId: "claude-session-keep",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      messages: [],
      activities: [],
      latestTurn: null,
    };
    const { layer } = ChatsMemory([seeded]);
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const updated = yield* chats.update(seeded.id, {
        model: "claude-fable-5",
      });
      expect(updated.model).toBe("claude-fable-5");
      expect(updated.sessionId).toBe("claude-session-keep");
    }).pipe(Effect.provide(layer));
  });
  it.effect("remove deletes the chat and tears down its runtime", () => {
    const { layer, runtime } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const created = yield* chats.create(newChat);
      yield* chats.remove(created.id);
      expect(runtime.calls.kill).toEqual([created.id]);
      const all = yield* chats.list;
      expect(all).toHaveLength(0);
    }).pipe(Effect.provide(layer));
  });
  it.effect("models offers nothing when no CLI answers", () => {
    const { layer } = ChatsMemory();
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const catalog = yield* chats.models;
      // Empty rather than invented: a chat with no model runs on the CLI's own
      // default, which beats offering models that may not exist.
      expect(catalog.providers.flatMap((p) => p.models)).toEqual([]);
      expect(catalog.providers.map((p) => p.id)).toEqual(
        CHAT_MODEL_CATALOG.providers.map((p) => p.id)
      );
    }).pipe(Effect.provide(layer));
  });

  it.effect("models takes the list from the CLI when it answers", () => {
    const { layer } = ChatsMemory([], terminalReturning());
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const catalog = yield* chats.models;
      const codex = catalog.providers.find((p) => p.id === "codex");
      expect(codex?.models.map((m) => m.id)).toEqual(["gpt-9-turbo"]);
      expect(codex?.models[0]?.label).toBe("GPT-9 Turbo");
      // The provider whose CLI stayed quiet offers nothing at all.
      expect(catalog.providers.find((p) => p.id === "cursor")?.models).toEqual(
        []
      );
    }).pipe(Effect.provide(layer));
  });

  it.effect("models asks the CLIs once and then serves the cache", () => {
    const commands: string[] = [];
    const { layer } = ChatsMemory([], terminalReturning(commands));
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const first = yield* chats.models;
      const runsAfterFirstCall = commands.length;
      const second = yield* chats.models;
      expect(second).toEqual(first);
      expect(commands.length).toBe(runsAfterFirstCall);
      // One run per provider, no more.
      expect(runsAfterFirstCall).toBe(CHAT_MODEL_CATALOG.providers.length);
    }).pipe(Effect.provide(layer));
  });

  it.effect(
    "re-asks a CLI that answered with nothing, but not one that did",
    () => {
      const commands: string[] = [];
      const { layer } = ChatsMemory([], terminalReturning(commands));
      const start = Date.now();
      const clock = vi.spyOn(Date, "now").mockReturnValue(start);
      return Effect.gen(function* () {
        const chats = yield* ChatsService;
        yield* chats.models;
        commands.length = 0;
        // An hour is the answer's lifetime; a minute is a silence's.
        clock.mockReturnValue(start + 5 * 60 * 1000);
        const catalog = yield* chats.models;
        expect(commands.some((c) => c.startsWith("codex "))).toBe(false);
        expect(commands).toHaveLength(CHAT_MODEL_CATALOG.providers.length - 1);
        // The retry doesn't cost the answer we already have.
        expect(
          catalog.providers
            .find((p) => p.id === "codex")
            ?.models.map((m) => m.id)
        ).toEqual(["gpt-9-turbo"]);
      }).pipe(
        Effect.provide(layer),
        Effect.ensuring(Effect.sync(() => clock.mockRestore()))
      );
    }
  );

  it.effect("a CLI that isn't installed contributes no models", () => {
    const { layer } = ChatsMemory(
      [],
      terminalMemory((command) => ({
        stdout: "",
        stderr: "command not found",
        exitCode: 127,
        command,
      }))
    );
    return Effect.gen(function* () {
      const chats = yield* ChatsService;
      const catalog = yield* chats.models;
      expect(catalog.providers.flatMap((p) => p.models)).toEqual([]);
      // Still listed, so the picker shows the agent exists and is unavailable.
      expect(catalog.providers).toHaveLength(
        CHAT_MODEL_CATALOG.providers.length
      );
    }).pipe(Effect.provide(layer));
  });
});
