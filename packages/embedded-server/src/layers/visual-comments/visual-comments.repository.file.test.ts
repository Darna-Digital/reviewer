import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { afterAll, describe, expect } from "vitest"
import { memoryLayer } from "../workspace/workspace-context.ts"
import {
  VisualCommentsRepository,
  type AddVisualComment,
} from "@byconvo/core/visual-comments"
import { makeFileVisualCommentsRepository } from "./visual-comments.repository.file.ts"

// A real temp repo root: the file store writes `.byconvo/visual-comments.json` here.
const repoDir = mkdtempSync(`${tmpdir()}/byconvo-visual-comments-`)
afterAll(() => rmSync(repoDir, { recursive: true, force: true }))

const FileRepo = Layer.effect(VisualCommentsRepository)(
  makeFileVisualCommentsRepository
).pipe(Layer.provide(memoryLayer(repoDir)))

const input: AddVisualComment = {
  body: "make this primary",
  author: "alice",
  pageUrl: "http://localhost:3000/settings",
  pageTitle: "Settings",
  route: "/settings",
  selector: "#save",
  label: 'button#save "Save"',
  tagName: "button",
  elementText: "Save",
  elementHtml: "<button id='save'>Save</button>",
  rect: { x: 1, y: 2, width: 3, height: 4 },
  viewport: { width: 800, height: 600 },
}

describe("FileVisualCommentsRepository", () => {
  it.effect("add stamps a unique id + createdAt and lists it back", () =>
    Effect.gen(function* () {
      const repo = yield* VisualCommentsRepository
      const first = yield* repo.add(input)
      const second = yield* repo.add({ ...input, body: "align the label" })

      expect(first.id).not.toBe("")
      expect(first.createdAt).not.toBe("")
      expect(second.id).not.toBe(first.id)
      const all = yield* repo.list
      expect(all.map((c) => c.body)).toContain("make this primary")
    }).pipe(Effect.provide(FileRepo))
  )

  it.effect("update rewrites the body and keeps the anchor", () =>
    Effect.gen(function* () {
      const repo = yield* VisualCommentsRepository
      const created = yield* repo.add({ ...input, body: "old" })
      const updated = yield* repo.update(created.id, { body: "new" })

      expect(updated.body).toBe("new")
      expect(updated.selector).toBe(input.selector)
      const all = yield* repo.list
      expect(all.find((c) => c.id === created.id)?.body).toBe("new")
    }).pipe(Effect.provide(FileRepo))
  )

  it.effect("update fails with NotFound for an unknown id", () =>
    Effect.gen(function* () {
      const repo = yield* VisualCommentsRepository
      const result = yield* Effect.exit(repo.update("missing", { body: "x" }))

      expect(result._tag).toBe("Failure")
    }).pipe(Effect.provide(FileRepo))
  )

  it.effect("remove deletes by id", () =>
    Effect.gen(function* () {
      const repo = yield* VisualCommentsRepository
      const created = yield* repo.add({ ...input, body: "to be removed" })
      yield* repo.remove(created.id)

      const remaining = yield* repo.list
      expect(remaining.map((c) => c.id)).not.toContain(created.id)
    }).pipe(Effect.provide(FileRepo))
  )

  it.effect(
    "persists across repository instances (unlike the in-memory store)",
    () =>
      Effect.gen(function* () {
        const created = yield* Effect.gen(function* () {
          const repo = yield* VisualCommentsRepository
          return yield* repo.add({ ...input, body: "durable" })
        }).pipe(Effect.provide(FileRepo))

        const all = yield* Effect.gen(function* () {
          const repo = yield* VisualCommentsRepository
          return yield* repo.list
        }).pipe(Effect.provide(FileRepo))

        expect(all.map((c) => c.id)).toContain(created.id)
      })
  )
})
