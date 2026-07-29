import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { TasksMemory } from "../layer/tasks.layer.memory.ts"
import { TasksService } from "./tasks.service.ts"

const memory = TasksMemory([], { p1: "BYC" })

describe("TasksService", () => {
  it.effect("creates into the backlog with a task key", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const created = yield* tasks.create({ projectId: "p1", title: " spa " })
      expect(created.title).toBe("spa")
      expect(created.key).toBe("BYC-1")
      expect(created.status).toBe("backlog")
      expect(created.priority).toBe("none")
      expect(created.completedAt).toBeNull()
    }).pipe(Effect.provide(memory))
  )

  it.effect("rejects a blank title on create and on update", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const onCreate = yield* Effect.flip(
        tasks.create({ projectId: "p1", title: "  " })
      )
      expect(onCreate._tag).toBe("InvalidInput")
      const created = yield* tasks.create({ projectId: "p1", title: "spa" })
      const onUpdate = yield* Effect.flip(
        tasks.update(created.id, { title: " " })
      )
      expect(onUpdate._tag).toBe("InvalidInput")
    }).pipe(Effect.provide(memory))
  )

  it.effect("appends each new task after the last in its column", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const first = yield* tasks.create({
        projectId: "p1",
        title: "one",
        status: "todo",
      })
      const second = yield* tasks.create({
        projectId: "p1",
        title: "two",
        status: "todo",
      })
      expect(second.position).toBeGreaterThan(first.position)
    }).pipe(Effect.provide(memory))
  )

  it.effect("stamps completedAt when a task closes and clears it on reopen", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const created = yield* tasks.create({ projectId: "p1", title: "spa" })
      const done = yield* tasks.update(created.id, { status: "done" })
      expect(done.completedAt).not.toBeNull()

      // Re-saving a closed task keeps the moment it was actually finished.
      const retitled = yield* tasks.update(done.id, { title: "spa v2" })
      expect(retitled.completedAt).toBe(done.completedAt)

      const reopened = yield* tasks.update(done.id, { status: "todo" })
      expect(reopened.completedAt).toBeNull()
    }).pipe(Effect.provide(memory))
  )

  it.effect("stamps a task created straight into a closed status", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const created = yield* tasks.create({
        projectId: "p1",
        title: "already done",
        status: "done",
      })
      expect(created.completedAt).not.toBeNull()
    }).pipe(Effect.provide(memory))
  )

  it.effect("changing status appends the task to its new column", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const parked = yield* tasks.create({
        projectId: "p1",
        title: "parked",
        status: "todo",
      })
      const moved = yield* tasks.create({
        projectId: "p1",
        title: "moved",
        status: "backlog",
      })
      const after = yield* tasks.update(moved.id, { status: "todo" })
      expect(after.position).toBeGreaterThan(parked.position)
    }).pipe(Effect.provide(memory))
  )

  it.effect("an explicit position wins over the append default", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const created = yield* tasks.create({ projectId: "p1", title: "spa" })
      const placed = yield* tasks.update(created.id, {
        status: "todo",
        position: 7,
      })
      expect(placed.position).toBe(7)
    }).pipe(Effect.provide(memory))
  )

  it.effect("move drops a task at an index within its target column", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const first = yield* tasks.create({
        projectId: "p1",
        title: "first",
        status: "todo",
      })
      const second = yield* tasks.create({
        projectId: "p1",
        title: "second",
        status: "todo",
      })
      const third = yield* tasks.create({
        projectId: "p1",
        title: "third",
        status: "todo",
      })

      const moved = yield* tasks.move(third.id, "todo", 1)
      expect(moved.position).toBeGreaterThan(first.position)
      expect(moved.position).toBeLessThan(second.position)

      const column = yield* tasks.listByProject("p1")
      expect(column.map((t) => t.title)).toEqual(["first", "third", "second"])
    }).pipe(Effect.provide(memory))
  )

  it.effect("move across columns closes the task and stamps it", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const created = yield* tasks.create({
        projectId: "p1",
        title: "spa",
        status: "todo",
      })
      const moved = yield* tasks.move(created.id, "done", 0)
      expect(moved.status).toBe("done")
      expect(moved.completedAt).not.toBeNull()
    }).pipe(Effect.provide(memory))
  )

  it.effect("refuses to parent a task into its own subtree", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const root = yield* tasks.create({ projectId: "p1", title: "root" })
      const child = yield* tasks.create({ projectId: "p1", title: "child" })
      yield* tasks.update(child.id, { parentId: root.id })

      const itself = yield* Effect.flip(
        tasks.update(root.id, { parentId: root.id })
      )
      expect(itself._tag).toBe("InvalidInput")

      const descendant = yield* Effect.flip(
        tasks.update(root.id, { parentId: child.id })
      )
      expect(descendant._tag).toBe("InvalidInput")
    }).pipe(Effect.provide(memory))
  )

  it.effect("un-parenting back to the top level is allowed", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const root = yield* tasks.create({ projectId: "p1", title: "root" })
      const child = yield* tasks.create({ projectId: "p1", title: "child" })
      yield* tasks.update(child.id, { parentId: root.id })
      const freed = yield* tasks.update(child.id, { parentId: null })
      expect(freed.parentId).toBeNull()
    }).pipe(Effect.provide(memory))
  )

  it.effect("removing a task removes its sub-tasks with it", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const root = yield* tasks.create({ projectId: "p1", title: "root" })
      const child = yield* tasks.create({ projectId: "p1", title: "child" })
      yield* tasks.update(child.id, { parentId: root.id })
      yield* tasks.remove(root.id)
      const left = yield* tasks.listByProject("p1")
      expect(left).toEqual([])
    }).pipe(Effect.provide(memory))
  )

  it.effect("resolves a reference embedded in a sentence", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const created = yield* tasks.create({ projectId: "p1", title: "spa" })
      const found = yield* tasks.resolveRef(`please pick up ${created.key}`)
      expect(found.id).toBe(created.id)
    }).pipe(Effect.provide(memory))
  )

  it.effect("resolveRef fails with NotFound when nothing matches", () =>
    Effect.gen(function* () {
      const tasks = yield* TasksService
      const failure = yield* Effect.flip(tasks.resolveRef("nothing"))
      expect(failure._tag).toBe("NotFound")
    }).pipe(Effect.provide(memory))
  )
})
