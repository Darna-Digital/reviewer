import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type { InvalidInput } from "../../../shared.ts"
import {
  DocsRepository,
  type DocsFailure,
  type DocsRepo,
} from "../repository/docs.repository.ts"
import type {
  Doc,
  DocSummary,
  NewDoc,
  UpdateDoc,
} from "../schema/docs.schema.ts"
import {
  resolveDocTitle,
  seedDocContent,
  sortDocs,
  titleFromContent,
} from "../functions/docs.functions.ts"

export type DocsServiceFailure = DocsFailure | InvalidInput

export interface DocsServiceShape {
  readonly listByProject: (
    projectId: string
  ) => Effect.Effect<ReadonlyArray<DocSummary>, DocsServiceFailure>
  readonly get: (id: string) => Effect.Effect<Doc, DocsServiceFailure>
  readonly create: (input: NewDoc) => Effect.Effect<Doc, DocsServiceFailure>
  readonly update: (
    id: string,
    input: UpdateDoc
  ) => Effect.Effect<Doc, DocsServiceFailure>
  readonly remove: (id: string) => Effect.Effect<void, DocsServiceFailure>
}

export class DocsService extends Context.Service<
  DocsService,
  DocsServiceShape
>()("DocsService") {}

/**
 * A doc is mostly a body; the rule worth keeping out of the UI is how it gets
 * its name. An untitled doc takes its title from its first heading, and keeps
 * doing so as the body is edited — until someone sets a title by hand, which
 * then sticks. That is why an empty title on update means "re-derive", not
 * "blank the name".
 */
export const makeDocsService = Effect.gen(function* () {
  const repo: DocsRepo = yield* DocsRepository

  const listByProject: DocsServiceShape["listByProject"] = (projectId) =>
    Effect.map(repo.listByProject(projectId), sortDocs)

  const create: DocsServiceShape["create"] = (input) =>
    Effect.suspend(() => {
      const explicit = (input.title ?? "").trim()
      const content =
        input.content ??
        seedDocContent(explicit.length > 0 ? explicit : "Untitled")
      return repo.create({
        projectId: input.projectId,
        title: resolveDocTitle(input.title, content),
        content,
      })
    })

  const update: DocsServiceShape["update"] = (id, input) =>
    Effect.flatMap(repo.get(id), (existing) => {
      const content = input.content ?? existing.content
      const explicit = (input.title ?? "").trim()
      // An edited body renames a doc that was never titled by hand; a doc with
      // a hand-set title keeps it.
      const title =
        explicit.length > 0
          ? explicit
          : input.content !== undefined &&
              existing.title === titleFromContent(existing.content)
            ? titleFromContent(content)
            : existing.title
      return repo.update(id, { title, content })
    })

  return DocsService.of({
    listByProject,
    get: repo.get,
    create,
    update,
    remove: repo.remove,
  })
})
