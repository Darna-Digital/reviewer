import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { DocsMemory } from "../layer/docs.layer.memory.ts"
import { DocsService } from "./docs.service.ts"

describe("DocsService", () => {
  it.effect("seeds a new doc's body with its title as a heading", () =>
    Effect.gen(function* () {
      const docs = yield* DocsService
      const created = yield* docs.create({
        projectId: "p1",
        title: "Migration plan",
      })
      expect(created.title).toBe("Migration plan")
      expect(created.content).toBe("# Migration plan\n\n")
    }).pipe(Effect.provide(DocsMemory()))
  )

  it.effect("names an untitled doc Untitled until it has content", () =>
    Effect.gen(function* () {
      const docs = yield* DocsService
      const created = yield* docs.create({ projectId: "p1" })
      expect(created.title).toBe("Untitled")
    }).pipe(Effect.provide(DocsMemory()))
  )

  it.effect("takes the title from supplied content when none is given", () =>
    Effect.gen(function* () {
      const docs = yield* DocsService
      const created = yield* docs.create({
        projectId: "p1",
        content: "# From the body\n",
      })
      expect(created.title).toBe("From the body")
    }).pipe(Effect.provide(DocsMemory()))
  )

  it.effect(
    "editing the heading renames a doc that was never titled by hand",
    () =>
      Effect.gen(function* () {
        const docs = yield* DocsService
        const created = yield* docs.create({ projectId: "p1", title: "Draft" })
        const edited = yield* docs.update(created.id, {
          content: "# Renamed\n\nstep one\n",
        })
        expect(edited.title).toBe("Renamed")
      }).pipe(Effect.provide(DocsMemory()))
  )

  it.effect("a hand-set title survives later body edits", () =>
    Effect.gen(function* () {
      const docs = yield* DocsService
      const created = yield* docs.create({ projectId: "p1", title: "Draft" })
      const titled = yield* docs.update(created.id, { title: "Roadmap" })
      const edited = yield* docs.update(titled.id, {
        content: "# Something else\n",
      })
      expect(edited.title).toBe("Roadmap")
    }).pipe(Effect.provide(DocsMemory()))
  )

  it.effect("lists a project's docs, most recently updated first", () =>
    Effect.gen(function* () {
      const docs = yield* DocsService
      yield* docs.create({ projectId: "p1", title: "Beta" })
      yield* docs.create({ projectId: "p1", title: "Alpha" })
      yield* docs.create({ projectId: "p2", title: "Elsewhere" })
      const mine = yield* docs.listByProject("p1")
      expect(mine.map((d) => d.title)).toEqual(["Alpha", "Beta"])
    }).pipe(Effect.provide(DocsMemory()))
  )

  it.effect("get fails with NotFound for an unknown id", () =>
    Effect.gen(function* () {
      const docs = yield* DocsService
      const failure = yield* Effect.flip(docs.get("missing"))
      expect(failure._tag).toBe("NotFound")
    }).pipe(Effect.provide(DocsMemory()))
  )

  it.effect("remove deletes by id", () =>
    Effect.gen(function* () {
      const docs = yield* DocsService
      const created = yield* docs.create({ projectId: "p1", title: "Temp" })
      yield* docs.remove(created.id)
      expect(yield* docs.listByProject("p1")).toEqual([])
    }).pipe(Effect.provide(DocsMemory()))
  )
})
