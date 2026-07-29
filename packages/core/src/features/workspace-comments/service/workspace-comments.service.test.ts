import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import {
  WorkspaceCommentsMemory,
  testViewer,
} from "../layer/workspace-comments.layer.memory.ts"
import { WorkspaceCommentsService } from "./workspace-comments.service.ts"

import type { WorkspaceComment } from "../schema/workspace-comments.schema.ts"

const onTask = { subjectType: "task", subjectId: "t1" } as const

/** Written by another member, so the viewer is never its author. */
const someoneElsesComment: WorkspaceComment = {
  id: "theirs",
  ...onTask,
  parentId: null,
  body: "not yours",
  author: { id: "u2", name: "Other", email: "o@example.com", image: null },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  edited: false,
}

describe("WorkspaceCommentsService", () => {
  it.effect("posts a comment authored by the viewer", () =>
    Effect.gen(function* () {
      const comments = yield* WorkspaceCommentsService
      const created = yield* comments.create({ ...onTask, body: "  hello  " })
      expect(created.body).toBe("hello")
      expect(created.author.id).toBe("u1")
      expect(created.edited).toBe(false)
    }).pipe(Effect.provide(WorkspaceCommentsMemory()))
  )

  it.effect("rejects a blank body", () =>
    Effect.gen(function* () {
      const comments = yield* WorkspaceCommentsService
      const failure = yield* Effect.flip(
        comments.create({ ...onTask, body: "   " })
      )
      expect(failure._tag).toBe("InvalidInput")
    }).pipe(Effect.provide(WorkspaceCommentsMemory()))
  )

  it.effect("refuses a reply that points at another subject", () =>
    Effect.gen(function* () {
      const comments = yield* WorkspaceCommentsService
      const parent = yield* comments.create({ ...onTask, body: "on t1" })
      const failure = yield* Effect.flip(
        comments.create({
          subjectType: "task",
          subjectId: "t2",
          body: "reply",
          parentId: parent.id,
        })
      )
      expect(failure._tag).toBe("InvalidInput")
    }).pipe(Effect.provide(WorkspaceCommentsMemory()))
  )

  it.effect("marks an edited comment", () =>
    Effect.gen(function* () {
      const comments = yield* WorkspaceCommentsService
      const created = yield* comments.create({ ...onTask, body: "first" })
      const edited = yield* comments.update(created.id, "second")
      expect(edited.body).toBe("second")
      expect(edited.edited).toBe(true)
    }).pipe(Effect.provide(WorkspaceCommentsMemory()))
  )

  it.effect("only the author may edit, even for the owner", () =>
    Effect.gen(function* () {
      const comments = yield* WorkspaceCommentsService
      const failure = yield* Effect.flip(comments.update("theirs", "rewritten"))
      expect(failure._tag).toBe("Forbidden")
    }).pipe(
      Effect.provide(
        WorkspaceCommentsMemory({
          viewer: testViewer({ role: "owner" }),
          seed: [someoneElsesComment],
        })
      )
    )
  )

  it.effect("a member cannot delete someone else's comment", () =>
    Effect.gen(function* () {
      const comments = yield* WorkspaceCommentsService
      const failure = yield* Effect.flip(comments.remove("theirs"))
      expect(failure._tag).toBe("Forbidden")
    }).pipe(
      Effect.provide(WorkspaceCommentsMemory({ seed: [someoneElsesComment] }))
    )
  )

  it.effect("an admin can delete someone else's comment", () =>
    Effect.gen(function* () {
      const comments = yield* WorkspaceCommentsService
      yield* comments.remove("theirs")
      expect(yield* comments.listBySubject("task", "t1")).toEqual([])
    }).pipe(
      Effect.provide(
        WorkspaceCommentsMemory({
          viewer: testViewer({ role: "admin" }),
          seed: [someoneElsesComment],
        })
      )
    )
  )

  it.effect("removing a comment removes its replies with it", () =>
    Effect.gen(function* () {
      const comments = yield* WorkspaceCommentsService
      const root = yield* comments.create({ ...onTask, body: "root" })
      const reply = yield* comments.create({
        ...onTask,
        body: "reply",
        parentId: root.id,
      })
      yield* comments.create({
        ...onTask,
        body: "nested",
        parentId: reply.id,
      })
      yield* comments.remove(root.id)
      const left = yield* comments.listBySubject("task", "t1")
      expect(left).toEqual([])
    }).pipe(Effect.provide(WorkspaceCommentsMemory()))
  )

  it.effect("lists only the requested subject's comments, oldest first", () =>
    Effect.gen(function* () {
      const comments = yield* WorkspaceCommentsService
      yield* comments.create({ ...onTask, body: "one" })
      yield* comments.create({ ...onTask, body: "two" })
      yield* comments.create({
        subjectType: "doc",
        subjectId: "d1",
        body: "elsewhere",
      })
      const thread = yield* comments.listBySubject("task", "t1")
      expect(thread.map((c) => c.body)).toEqual(["one", "two"])
    }).pipe(Effect.provide(WorkspaceCommentsMemory()))
  )
})
