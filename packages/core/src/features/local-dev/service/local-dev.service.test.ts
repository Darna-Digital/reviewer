import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { LocalDevMemory } from "../layer/local-dev.layer.memory.ts";
import { LocalDevService } from "./local-dev.service.ts";

const WEB = "/project/web";
const API = "/project/api";

describe("LocalDevService", () => {
  it.effect("create trims input, stamps an id, and lists it back", () =>
    Effect.gen(function* () {
      const dev = yield* LocalDevService;
      const created = yield* dev.create({
        name: "  web  ",
        command: "  pnpm dev  ",
        repoPath: WEB,
      });
      expect(created.id).not.toBe("");
      expect(created.name).toBe("web");
      expect(created.command).toBe("pnpm dev");
      expect(created.repoPath).toBe(WEB);
      expect(created.repo).toBe("web");
      const all = yield* dev.list;
      expect(all.map((c) => c.id)).toContain(created.id);
    }).pipe(Effect.provide(LocalDevMemory()))
  );
  it.effect("lists every root's commands, grouped by root", () =>
    Effect.gen(function* () {
      const dev = yield* LocalDevService;
      yield* dev.create({ name: "web", command: "pnpm dev", repoPath: WEB });
      yield* dev.create({ name: "api", command: "pnpm serve", repoPath: API });
      const all = yield* dev.list;
      expect(all.map((c) => c.repo)).toEqual(["api", "web"]);
    }).pipe(Effect.provide(LocalDevMemory()))
  );
  it.effect("update changes given fields and leaves the rest", () =>
    Effect.gen(function* () {
      const dev = yield* LocalDevService;
      const created = yield* dev.create({
        name: "web",
        command: "pnpm dev",
        repoPath: WEB,
      });
      const updated = yield* dev.update(created.id, { command: "pnpm start" });
      expect(updated.name).toBe("web");
      expect(updated.command).toBe("pnpm start");
      expect(updated.repoPath).toBe(WEB);
    }).pipe(Effect.provide(LocalDevMemory()))
  );
  it.effect("update moves a command to another root", () =>
    Effect.gen(function* () {
      const dev = yield* LocalDevService;
      const created = yield* dev.create({
        name: "web",
        command: "pnpm dev",
        repoPath: WEB,
      });
      const moved = yield* dev.update(created.id, { repoPath: API });
      expect(moved.repoPath).toBe(API);
      expect(moved.repo).toBe("api");
      expect(moved.command).toBe("pnpm dev");
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
      const created = yield* dev.create({
        name: "web",
        command: "pnpm dev",
        repoPath: WEB,
      });
      yield* dev.remove(created.id);
      const all = yield* dev.list;
      expect(all).toHaveLength(0);
    }).pipe(Effect.provide(LocalDevMemory()))
  );
});
