import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { LabelsMemory } from "../layer/labels.layer.memory.ts"
import { LabelsService } from "./labels.service.ts"

describe("LabelsService", () => {
  it.effect("normalizes the name and picks an unused colour", () =>
    Effect.gen(function* () {
      const labels = yield* LabelsService
      const created = yield* labels.create({
        projectId: "p1",
        name: "  ui  / ux ",
      })
      expect(created.name).toBe("ui / ux")
      expect(created.color).toBe("gray")
      const second = yield* labels.create({ projectId: "p1", name: "bug" })
      expect(second.color).toBe("blue")
    }).pipe(Effect.provide(LabelsMemory()))
  )

  it.effect("rejects a duplicate name within the same project", () =>
    Effect.gen(function* () {
      const labels = yield* LabelsService
      yield* labels.create({ projectId: "p1", name: "Bug" })
      const failure = yield* Effect.flip(
        labels.create({ projectId: "p1", name: " bug " })
      )
      expect(failure._tag).toBe("Conflict")
    }).pipe(Effect.provide(LabelsMemory()))
  )

  it.effect("allows the same name in a different project", () =>
    Effect.gen(function* () {
      const labels = yield* LabelsService
      yield* labels.create({ projectId: "p1", name: "bug" })
      const other = yield* labels.create({ projectId: "p2", name: "bug" })
      expect(other.projectId).toBe("p2")
    }).pipe(Effect.provide(LabelsMemory()))
  )

  it.effect("rejects a blank name", () =>
    Effect.gen(function* () {
      const labels = yield* LabelsService
      const failure = yield* Effect.flip(
        labels.create({ projectId: "p1", name: "   " })
      )
      expect(failure._tag).toBe("InvalidInput")
    }).pipe(Effect.provide(LabelsMemory()))
  )

  it.effect("renaming a label to its own name is not a conflict", () =>
    Effect.gen(function* () {
      const labels = yield* LabelsService
      const created = yield* labels.create({ projectId: "p1", name: "bug" })
      const updated = yield* labels.update(created.id, { name: "Bug" })
      expect(updated.name).toBe("Bug")
    }).pipe(Effect.provide(LabelsMemory()))
  )

  it.effect("lists only the requested project's labels, sorted", () =>
    Effect.gen(function* () {
      const labels = yield* LabelsService
      yield* labels.create({ projectId: "p1", name: "zeta" })
      yield* labels.create({ projectId: "p1", name: "alpha" })
      yield* labels.create({ projectId: "p2", name: "other" })
      const mine = yield* labels.listByProject("p1")
      expect(mine.map((l) => l.name)).toEqual(["alpha", "zeta"])
    }).pipe(Effect.provide(LabelsMemory()))
  )
})
