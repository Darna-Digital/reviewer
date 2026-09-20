import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { LocalDevMemory } from "../layer/local-dev.layer.memory.ts";
import { normalizeDevCwd } from "../schema/local-dev.schema.ts";
import { LocalDevService } from "./local-dev.service.ts";

describe("normalizeDevCwd", () => {
  it("folds separators and dot segments and never climbs out", () => {
    expect(normalizeDevCwd("")).toBe("");
    expect(normalizeDevCwd(" ./packages/web/ ")).toBe("packages/web");
    expect(normalizeDevCwd("packages\\web")).toBe("packages/web");
    expect(normalizeDevCwd("../../etc")).toBe("etc");
    expect(normalizeDevCwd("packages/../apps/./api")).toBe("apps/api");
  });
});

describe("LocalDevService", () => {
  it.effect("create trims input, stamps an id, and lists it back", () =>
    Effect.gen(function* () {
      const dev = yield* LocalDevService;
      const created = yield* dev.create({
        name: "  web  ",
        command: "  pnpm dev  ",
      });
      expect(created.id).not.toBe("");
      expect(created.name).toBe("web");
      expect(created.command).toBe("pnpm dev");
      const all = yield* dev.list;
      expect(all.map((c) => c.id)).toContain(created.id);
    }).pipe(Effect.provide(LocalDevMemory()))
  );
  it.effect("update changes given fields and leaves the rest", () =>
    Effect.gen(function* () {
      const dev = yield* LocalDevService;
      const created = yield* dev.create({
        name: "web",
        command: "pnpm dev",
        cwd: "packages/web",
      });
      const updated = yield* dev.update(created.id, { command: "pnpm start" });
      expect(updated.name).toBe("web");
      expect(updated.command).toBe("pnpm start");
      expect(updated.cwd).toBe("packages/web");
    }).pipe(Effect.provide(LocalDevMemory()))
  );
  it.effect("a command runs from the root unless given a folder", () =>
    Effect.gen(function* () {
      const dev = yield* LocalDevService;
      const created = yield* dev.create({ name: "web", command: "pnpm dev" });
      expect(created.cwd).toBe("");
      const moved = yield* dev.update(created.id, { cwd: "/packages/web/" });
      expect(moved.cwd).toBe("packages/web");
    }).pipe(Effect.provide(LocalDevMemory()))
  );
  it.effect("get fails with NotFound for an unknown id", () =>
    Effect.gen(function* () {
      const dev = yield* LocalDevService;
      const result = yield* Effect.flip(dev.get("nope"));
      expect(result._tag).toBe("NotFound");
    }).pipe(Effect.provide(LocalDevMemory()))
  );
  it.effect("remove deletes by id", () =>
    Effect.gen(function* () {
      const dev = yield* LocalDevService;
      const created = yield* dev.create({ name: "web", command: "pnpm dev" });
      yield* dev.remove(created.id);
      const all = yield* dev.list;
      expect(all).toHaveLength(0);
    }).pipe(Effect.provide(LocalDevMemory()))
  );
});
