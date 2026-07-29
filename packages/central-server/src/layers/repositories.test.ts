/**
 * The drizzle repositories, against a real Postgres.
 *
 * The domain rules are covered by `@byconvo/core`'s own unit tests over the
 * in-memory repositories; what those cannot check is the half that only exists
 * here — that every query is scoped to one organization, that the per-project
 * task number is handed out without collisions, and that the cascades really
 * cascade. Those are properties of the schema and the SQL, so they are tested
 * against the database rather than a fake.
 *
 * Skipped when no database is reachable, so `pnpm test` still passes on a
 * checkout that has not run `db:up`.
 */
import { Effect } from "effect"
import { Pool } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Viewer, type ViewerShape } from "@byconvo/core/identity"
import { makeProjectsService, ProjectsRepository } from "@byconvo/core/projects"
import { makeTasksService, TasksRepository } from "@byconvo/core/tasks"
import { makeLabelsService, LabelsRepository } from "@byconvo/core/labels"
import { randomUUID } from "node:crypto"
import type { Database } from "../db/client.ts"
import { databaseUrl, layer as databaseLayer } from "../db/client.ts"
import { runMigrations } from "../db/migrate.ts"
import { makeDrizzleProjectsRepository } from "./projects/projects.repository.drizzle.ts"
import { makeDrizzleTasksRepository } from "./tasks/tasks.repository.drizzle.ts"
import { makeDrizzleLabelsRepository } from "./labels/labels.repository.drizzle.ts"

const reachable = async (): Promise<boolean> => {
  const pool = new Pool({ connectionString: databaseUrl(), max: 1 })
  try {
    await pool.query("select 1")
    return true
  } catch {
    return false
  } finally {
    await pool.end()
  }
}

const available = await reachable()

const viewerFor = (organizationId: string, userId: string): ViewerShape => ({
  user: {
    id: userId,
    name: "Tester",
    email: `${userId}@example.com`,
    emailVerified: true,
    image: null,
  },
  organization: {
    id: organizationId,
    name: "Test org",
    slug: organizationId,
    logo: null,
    createdAt: new Date().toISOString(),
  },
  role: "owner",
})

describe.skipIf(!available)("drizzle repositories", () => {
  const orgA = randomUUID()
  const orgB = randomUUID()
  const userA = randomUUID()
  const pool = new Pool({ connectionString: databaseUrl(), max: 2 })

  beforeAll(async () => {
    await runMigrations()
    for (const id of [orgA, orgB]) {
      await pool.query(
        "insert into organization (id, name, slug) values ($1, $2, $3)",
        [id, `org ${id.slice(0, 6)}`, id]
      )
    }
    await pool.query(
      'insert into "user" (id, name, email) values ($1, $2, $3)',
      [userA, "Tester", `${userA}@example.com`]
    )
  })

  afterAll(async () => {
    // The organizations cascade to everything the tests wrote.
    await pool.query("delete from organization where id = any($1)", [
      [orgA, orgB],
    ])
    await pool.query('delete from "user" where id = $1', [userA])
    await pool.end()
  })

  /** The three services a test needs, built for one organization. */
  const servicesFor = (organizationId: string) =>
    Effect.gen(function* () {
      const projects = yield* Effect.flatMap(
        makeDrizzleProjectsRepository,
        (repo) =>
          Effect.provideService(makeProjectsService, ProjectsRepository, repo)
      )
      const tasks = yield* Effect.flatMap(makeDrizzleTasksRepository, (repo) =>
        Effect.provideService(makeTasksService, TasksRepository, repo)
      )
      const labels = yield* Effect.flatMap(
        makeDrizzleLabelsRepository,
        (repo) =>
          Effect.provideService(makeLabelsService, LabelsRepository, repo)
      )
      return { projects, tasks, labels }
    }).pipe(Effect.provideService(Viewer, viewerFor(organizationId, userA)))

  /**
   * The connection is provided once around the whole program, not around each
   * `servicesFor` — a layer provided inside would close its pool as soon as the
   * repositories were built, leaving them holding a dead connection.
   */
  const runTest = <A, E>(program: Effect.Effect<A, E, Database>) =>
    Effect.runPromise(Effect.scoped(Effect.provide(program, databaseLayer)))

  it("hands out task keys from a per-project sequence", async () => {
    const program = Effect.gen(function* () {
      const { projects, tasks } = yield* servicesFor(orgA)
      const project = yield* projects.create({ name: "Sequence", key: "SEQ" })
      const first = yield* tasks.create({
        projectId: project.id,
        title: "one",
      })
      const second = yield* tasks.create({
        projectId: project.id,
        title: "two",
      })
      return [first.key, second.key]
    })
    expect(await runTest(program)).toEqual(["SEQ-1", "SEQ-2"])
  })

  it("numbers concurrent creates without collision", async () => {
    const program = Effect.gen(function* () {
      const { projects, tasks } = yield* servicesFor(orgA)
      const project = yield* projects.create({ name: "Race", key: "RACE" })
      const created = yield* Effect.all(
        Array.from({ length: 8 }, (_, i) =>
          tasks.create({ projectId: project.id, title: `task ${i}` })
        ),
        { concurrency: 8 }
      )
      return created.map((task) => task.number).sort((a, b) => a - b)
    })
    expect(await runTest(program)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it("keeps one organization's projects invisible to another", async () => {
    const program = Effect.gen(function* () {
      const mine = yield* servicesFor(orgA)
      const created = yield* mine.projects.create({ name: "Private" })

      const theirs = yield* servicesFor(orgB)
      const visible = yield* theirs.projects.list
      const lookup = yield* Effect.flip(theirs.projects.get(created.id))
      return { ids: visible.map((p) => p.id), tag: lookup._tag }
    })
    const { ids, tag } = await runTest(program)
    expect(ids).not.toContain(expect.anything())
    expect(tag).toBe("NotFound")
  })

  it("will not let another organization read or write a task", async () => {
    const program = Effect.gen(function* () {
      const mine = yield* servicesFor(orgA)
      const project = yield* mine.projects.create({ name: "Sealed" })
      const task = yield* mine.tasks.create({
        projectId: project.id,
        title: "secret",
      })

      const theirs = yield* servicesFor(orgB)
      const read = yield* Effect.flip(theirs.tasks.get(task.id))
      const write = yield* Effect.flip(
        theirs.tasks.update(task.id, { title: "hijacked" })
      )
      const listed = yield* theirs.tasks.listByProject(project.id)
      return { read: read._tag, write: write._tag, listed: listed.length }
    })
    const result = await runTest(program)
    expect(result).toEqual({ read: "NotFound", write: "NotFound", listed: 0 })
  })

  it("deletes sub-tasks with their parent", async () => {
    const program = Effect.gen(function* () {
      const { projects, tasks } = yield* servicesFor(orgA)
      const project = yield* projects.create({ name: "Cascade" })
      const parent = yield* tasks.create({
        projectId: project.id,
        title: "parent",
      })
      const child = yield* tasks.create({
        projectId: project.id,
        title: "child",
        parentId: parent.id,
      })
      yield* tasks.remove(parent.id)
      const left = yield* tasks.listByProject(project.id)
      return { left: left.length, childId: child.id }
    })
    expect((await runTest(program)).left).toBe(0)
  })

  it("attaches labels to a task and unpins them when the label goes", async () => {
    const program = Effect.gen(function* () {
      const { projects, tasks, labels } = yield* servicesFor(orgA)
      const project = yield* projects.create({ name: "Labelled" })
      const label = yield* labels.create({
        projectId: project.id,
        name: "ui/ux",
      })
      const task = yield* tasks.create({
        projectId: project.id,
        title: "styled",
        labelIds: [label.id],
      })
      const attached = yield* tasks.get(task.id)
      yield* labels.remove(label.id)
      const afterRemoval = yield* tasks.get(task.id)
      return {
        attached: attached.labelIds,
        after: afterRemoval.labelIds,
      }
    })
    const result = await runTest(program)
    expect(result.attached).toHaveLength(1)
    expect(result.after).toEqual([])
  })

  it("refuses a duplicate label name within a project", async () => {
    const program = Effect.gen(function* () {
      const { projects, labels } = yield* servicesFor(orgA)
      const project = yield* projects.create({ name: "Duplicates" })
      yield* labels.create({ projectId: project.id, name: "bug" })
      const failure = yield* Effect.flip(
        labels.create({ projectId: project.id, name: " Bug " })
      )
      return failure._tag
    })
    expect(await runTest(program)).toBe("Conflict")
  })

  it("settles a project key collision within an organization", async () => {
    const program = Effect.gen(function* () {
      const { projects } = yield* servicesFor(orgB)
      const first = yield* projects.create({ name: "Keyed", key: "DUP" })
      const second = yield* projects.create({ name: "Keyed too", key: "dup" })
      return [first.key, second.key]
    })
    expect(await runTest(program)).toEqual(["DUP", "DUP2"])
  })

  it("lets two organizations use the same project key", async () => {
    const program = Effect.gen(function* () {
      const mine = yield* servicesFor(orgA)
      const theirs = yield* servicesFor(orgB)
      const a = yield* mine.projects.create({ name: "Shared", key: "SHR" })
      const b = yield* theirs.projects.create({ name: "Shared", key: "SHR" })
      return [a.key, b.key]
    })
    expect(await runTest(program)).toEqual(["SHR", "SHR"])
  })
})
