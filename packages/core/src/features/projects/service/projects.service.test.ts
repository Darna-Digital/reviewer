import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { ProjectsMemory } from "../layer/projects.layer.memory.ts"
import { ProjectsService } from "./projects.service.ts"

describe("ProjectsService", () => {
  it.effect("derives a key from the name when none is given", () =>
    Effect.gen(function* () {
      const projects = yield* ProjectsService
      const created = yield* projects.create({ name: "Hans Natur" })
      expect(created.key).toBe("HN")
      expect(created.color).toBe("gray")
    }).pipe(Effect.provide(ProjectsMemory()))
  )

  it.effect("normalizes a supplied key and settles collisions", () =>
    Effect.gen(function* () {
      const projects = yield* ProjectsService
      const first = yield* projects.create({ name: "Byconvo", key: "by-c" })
      expect(first.key).toBe("BYC")
      const second = yield* projects.create({ name: "Beyond", key: "byc" })
      expect(second.key).toBe("BYC2")
    }).pipe(Effect.provide(ProjectsMemory()))
  )

  it.effect("rejects a blank name", () =>
    Effect.gen(function* () {
      const projects = yield* ProjectsService
      const failure = yield* Effect.flip(projects.create({ name: "   " }))
      expect(failure._tag).toBe("InvalidInput")
    }).pipe(Effect.provide(ProjectsMemory()))
  )

  it.effect("renaming leaves the key alone", () =>
    Effect.gen(function* () {
      const projects = yield* ProjectsService
      const created = yield* projects.create({ name: "Byconvo" })
      const renamed = yield* projects.update(created.id, { name: "Byconvo v2" })
      expect(renamed.key).toBe(created.key)
      expect(renamed.name).toBe("Byconvo v2")
    }).pipe(Effect.provide(ProjectsMemory()))
  )

  it.effect("re-keys only when the key is explicitly changed", () =>
    Effect.gen(function* () {
      const projects = yield* ProjectsService
      const created = yield* projects.create({ name: "Byconvo" })
      const rekeyed = yield* projects.update(created.id, { key: "conv" })
      expect(rekeyed.key).toBe("CONV")
    }).pipe(Effect.provide(ProjectsMemory()))
  )

  it.effect("lists live projects before archived ones", () =>
    Effect.gen(function* () {
      const projects = yield* ProjectsService
      const alpha = yield* projects.create({ name: "Alpha" })
      yield* projects.create({ name: "Zulu" })
      yield* projects.update(alpha.id, { archived: true })
      const all = yield* projects.list
      expect(all.map((p) => p.name)).toEqual(["Zulu", "Alpha"])
    }).pipe(Effect.provide(ProjectsMemory()))
  )

  it.effect("get fails with NotFound for an unknown id", () =>
    Effect.gen(function* () {
      const projects = yield* ProjectsService
      const failure = yield* Effect.flip(projects.get("missing"))
      expect(failure._tag).toBe("NotFound")
    }).pipe(Effect.provide(ProjectsMemory()))
  )
})
