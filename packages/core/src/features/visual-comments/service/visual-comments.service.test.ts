import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { VisualCommentsMemory } from "../layer/visual-comments.layer.memory.ts"
import {
  MAX_ELEMENT_HTML,
  MAX_ELEMENT_TEXT,
  type NewVisualComment,
} from "../schema/visual-comments.schema.ts"
import { VisualCommentsService, normalize } from "./visual-comments.service.ts"

const input = (over: Partial<NewVisualComment> = {}): NewVisualComment => ({
  body: "make this primary",
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
  ...over,
})

describe("normalize", () => {
  it("defaults the author when the picker did not supply one", () => {
    expect(normalize(input()).author).toBe("you")
    expect(normalize(input({ author: "   " })).author).toBe("you")
    expect(normalize(input({ author: " alice " })).author).toBe("alice")
  })

  it("trims the body", () => {
    expect(normalize(input({ body: "  fix it  " })).body).toBe("fix it")
  })

  it("gives the route a leading slash so routes group consistently", () => {
    expect(normalize(input({ route: "settings" })).route).toBe("/settings")
    expect(normalize(input({ route: "/settings" })).route).toBe("/settings")
  })

  it("collapses whitespace in text captured from the DOM", () => {
    const normalized = normalize(
      input({ elementText: "Save\n\n   changes", label: "button  #save" })
    )

    expect(normalized.elementText).toBe("Save changes")
    expect(normalized.label).toBe("button #save")
  })

  it("clamps oversized markup and text from an untrusted page", () => {
    const normalized = normalize(
      input({
        elementHtml: "x".repeat(MAX_ELEMENT_HTML + 500),
        elementText: "y".repeat(MAX_ELEMENT_TEXT + 500),
      })
    )

    expect(normalized.elementHtml).toHaveLength(MAX_ELEMENT_HTML + 1)
    expect(normalized.elementText).toHaveLength(MAX_ELEMENT_TEXT + 1)
  })

  it("rounds sub-pixel geometry", () => {
    const normalized = normalize(
      input({ rect: { x: 1.4, y: 2.6, width: 3.5, height: 4.49 } })
    )

    expect(normalized.rect).toEqual({ x: 1, y: 3, width: 4, height: 4 })
  })
})

describe("VisualCommentsService", () => {
  it.effect("add stamps an id and createdAt, then lists it back", () =>
    Effect.gen(function* () {
      const comments = yield* VisualCommentsService
      const created = yield* comments.add(input())

      expect(created.id).not.toBe("")
      expect(created.createdAt).not.toBe("")
      const all = yield* comments.list
      expect(all.map((c) => c.body)).toContain("make this primary")
    }).pipe(Effect.provide(VisualCommentsMemory()))
  )

  it.effect("add stores the normalized comment, not the raw payload", () =>
    Effect.gen(function* () {
      const comments = yield* VisualCommentsService
      const created = yield* comments.add(
        input({ body: "  spaced  ", route: "settings" })
      )

      expect(created.body).toBe("spaced")
      expect(created.route).toBe("/settings")
    }).pipe(Effect.provide(VisualCommentsMemory()))
  )

  it.effect("add rejects a body that is only whitespace", () =>
    Effect.gen(function* () {
      const comments = yield* VisualCommentsService
      const result = yield* Effect.exit(comments.add(input({ body: "   " })))

      expect(result._tag).toBe("Failure")
      const all = yield* comments.list
      expect(all).toHaveLength(0)
    }).pipe(Effect.provide(VisualCommentsMemory()))
  )

  it.effect("remove deletes by id", () =>
    Effect.gen(function* () {
      const comments = yield* VisualCommentsService
      const created = yield* comments.add(input())
      yield* comments.remove(created.id)

      expect(yield* comments.list).toHaveLength(0)
    }).pipe(Effect.provide(VisualCommentsMemory()))
  )

  it.effect("update rewrites the body", () =>
    Effect.gen(function* () {
      const comments = yield* VisualCommentsService
      const created = yield* comments.add(input())
      const updated = yield* comments.update(created.id, "revised")

      expect(updated.body).toBe("revised")
      expect((yield* comments.list)[0]?.body).toBe("revised")
    }).pipe(Effect.provide(VisualCommentsMemory()))
  )

  it.effect("update rejects a body that is only whitespace", () =>
    Effect.gen(function* () {
      const comments = yield* VisualCommentsService
      const created = yield* comments.add(input())
      const result = yield* Effect.exit(comments.update(created.id, "   "))

      expect(result._tag).toBe("Failure")
      expect((yield* comments.list)[0]?.body).toBe("make this primary")
    }).pipe(Effect.provide(VisualCommentsMemory()))
  )
})
