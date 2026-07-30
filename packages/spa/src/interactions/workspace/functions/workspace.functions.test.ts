import { describe, expect, it } from "vitest"
import {
  createWorkspaceFunctions,
  dropIndexWithin,
} from "./workspace.functions"
import {
  label,
  mockWorkspaceDependencies,
  task,
} from "./workspace.functions.mock"

describe("groups", () => {
  it("buckets tasks into board order and drops empty statuses", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "a", status: "todo" }),
        task({ id: "b", status: "in_review" }),
      ],
    })
    const groups = createWorkspaceFunctions(deps).groups()
    expect(groups.map((g) => g.status)).toEqual(["in_review", "todo"])
    expect(groups.map((g) => g.label)).toEqual(["In Review", "Todo"])
  })

  it("nests sub-tasks under their parent when expanded", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "root" }),
        task({ id: "child", parentId: "root", position: 2048 }),
      ],
      expanded: ["root"],
    })
    const rows = createWorkspaceFunctions(deps).groups()[0].rows
    expect(rows.map((r) => [r.task.id, r.depth])).toEqual([
      ["root", 0],
      ["child", 1],
    ])
    expect(rows[0].hasChildren).toBe(true)
    expect(rows[0].expanded).toBe(true)
  })

  it("hides sub-tasks of a collapsed parent but still counts them", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "root" }),
        task({ id: "child", parentId: "root" }),
        task({ id: "grandchild", parentId: "child" }),
      ],
    })
    const group = createWorkspaceFunctions(deps).groups()[0]
    expect(group.rows.map((r) => r.task.id)).toEqual(["root"])
    expect(group.rows[0].expanded).toBe(false)
    expect(group.count).toBe(3)
  })

  it("only nests within a status — a parent in another column does not adopt", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "root", status: "in_progress" }),
        task({ id: "child", parentId: "root", status: "todo" }),
      ],
      expanded: ["root"],
    })
    const groups = createWorkspaceFunctions(deps).groups()
    const todo = groups.find((g) => g.status === "todo")!
    expect(todo.rows.map((r) => [r.task.id, r.depth])).toEqual([["child", 0]])
  })

  it("applies the search box, keeping a hit's ancestors", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "root", title: "web infra" }),
        task({ id: "child", title: "spa", parentId: "root" }),
        task({ id: "other", title: "stripe" }),
      ],
      filters: { search: "spa" },
      expanded: ["root"],
    })
    const rows = createWorkspaceFunctions(deps).groups()[0].rows
    expect(rows.map((r) => r.task.id)).toEqual(["root", "child"])
  })

  it("applies the label filter as an AND", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "both", labelIds: ["ui", "bug"] }),
        task({ id: "one", labelIds: ["ui"] }),
      ],
      filters: { labelIds: ["ui", "bug"] },
    })
    const rows = createWorkspaceFunctions(deps).groups()[0].rows
    expect(rows.map((r) => r.task.id)).toEqual(["both"])
  })

  it("omits statuses the view has hidden", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "a", status: "todo" }),
        task({ id: "b", status: "done" }),
      ],
      filters: { hiddenStatuses: ["done"] },
    })
    const groups = createWorkspaceFunctions(deps).groups()
    expect(groups.map((g) => g.status)).toEqual(["todo"])
  })
})

describe("labelsOf and childrenOf", () => {
  it("resolves a task's label ids in display order", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [task({ id: "a", labelIds: ["l2", "l1"] })],
      labels: [
        label({ id: "l1", name: "api" }),
        label({ id: "l2", name: "bug" }),
        label({ id: "l3", name: "chore" }),
      ],
    })
    const fns = createWorkspaceFunctions(deps)
    expect(
      fns.labelsOf(task({ id: "a", labelIds: ["l2", "l1"] })).map((l) => l.name)
    ).toEqual(["api", "bug"])
  })

  it("lists a task's direct sub-tasks, ordered", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "root" }),
        task({ id: "second", parentId: "root", position: 20 }),
        task({ id: "first", parentId: "root", position: 10 }),
        task({ id: "deep", parentId: "second" }),
      ],
    })
    expect(
      createWorkspaceFunctions(deps)
        .childrenOf("root")
        .map((t) => t.id)
    ).toEqual(["first", "second"])
  })

  it("walks a task's parents outermost first, excluding itself", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "root" }),
        task({ id: "mid", parentId: "root" }),
        task({ id: "leaf", parentId: "mid" }),
      ],
    })
    const fns = createWorkspaceFunctions(deps)
    expect(fns.ancestorsOf("leaf").map((t) => t.id)).toEqual(["root", "mid"])
    expect(fns.ancestorsOf("root")).toEqual([])
  })

  it("stops walking parents rather than looping on a cycle", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [
        task({ id: "a", parentId: "b" }),
        task({ id: "b", parentId: "a" }),
      ],
    })
    expect(
      createWorkspaceFunctions(deps)
        .ancestorsOf("a")
        .map((t) => t.id)
    ).toEqual(["b"])
  })

  it("stops at a parent that is not in the project's tasks", () => {
    const { deps } = mockWorkspaceDependencies({
      tasks: [task({ id: "orphan", parentId: "elsewhere" })],
    })
    expect(createWorkspaceFunctions(deps).ancestorsOf("orphan")).toEqual([])
  })
})

describe("mutations", () => {
  it("create trims the title and refuses a blank one", async () => {
    const { deps, calls } = mockWorkspaceDependencies()
    const fns = createWorkspaceFunctions(deps)
    expect(await fns.create("   ", "todo")).toBe(false)
    expect(await fns.create("  spa  ", "todo")).toBe(true)
    expect(calls.create).toEqual([
      { title: "spa", status: "todo", parentId: null },
    ])
  })

  it("setStatus and setPriority skip a no-op", async () => {
    const { deps, calls } = mockWorkspaceDependencies()
    const fns = createWorkspaceFunctions(deps)
    const subject = task({ id: "a", status: "todo", priority: "high" })
    await fns.setStatus(subject, "todo")
    await fns.setPriority(subject, "high")
    expect(calls.update).toEqual([])
    await fns.setStatus(subject, "done")
    expect(calls.update).toEqual([{ id: "a", input: { status: "done" } }])
  })

  it("toggleLabel adds then removes", async () => {
    const { deps, calls } = mockWorkspaceDependencies()
    const fns = createWorkspaceFunctions(deps)
    await fns.toggleLabel(task({ id: "a" }), "l1")
    await fns.toggleLabel(task({ id: "a", labelIds: ["l1"] }), "l1")
    expect(calls.update.map((c) => c.input.labelIds)).toEqual([["l1"], []])
  })

  it("rename skips a blank or unchanged title", async () => {
    const { deps, calls } = mockWorkspaceDependencies()
    const fns = createWorkspaceFunctions(deps)
    const subject = task({ id: "a", title: "spa" })
    await fns.rename(subject, "  ")
    await fns.rename(subject, " spa ")
    expect(calls.update).toEqual([])
    await fns.rename(subject, "spa v2")
    expect(calls.update).toEqual([{ id: "a", input: { title: "spa v2" } }])
  })
})

describe("dropIndexWithin", () => {
  const column = [task({ id: "a" }), task({ id: "b" }), task({ id: "c" })]

  it("reads the index off the column without the moved task", () => {
    // Dragging "a" one place down lands it between b and c — index 1 of the
    // list that no longer contains it, not index 2 of the original.
    expect(dropIndexWithin(column, "a", 1)).toBe(1)
  })

  it("clamps a drop past either end", () => {
    expect(dropIndexWithin(column, "a", -3)).toBe(0)
    expect(dropIndexWithin(column, "a", 99)).toBe(2)
  })

  it("handles an empty column", () => {
    expect(dropIndexWithin([], "a", 4)).toBe(0)
  })
})
