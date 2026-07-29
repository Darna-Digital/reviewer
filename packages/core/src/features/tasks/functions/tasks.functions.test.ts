import { describe, expect, it } from "vitest"
import {
  buildTaskTree,
  descendantIds,
  filterByLabels,
  groupByStatus,
  isClosed,
  nextPosition,
  parseTaskKey,
  positionBetween,
  positionForIndex,
  resolveTaskRef,
  searchTasks,
  sortByPriority,
  taskKey,
  wouldCycle,
} from "./tasks.functions.ts"
import type { Task } from "../schema/tasks.schema.ts"

const task = (over: Partial<Task> & { id: string }): Task => ({
  projectId: "p1",
  number: 1,
  key: "BYC-1",
  title: "A task",
  description: "",
  status: "todo",
  priority: "none",
  parentId: null,
  position: 1024,
  labelIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
  ...over,
})

describe("task keys", () => {
  it("builds and parses a key", () => {
    expect(taskKey("BYC", 224)).toBe("BYC-224")
    expect(parseTaskKey(" byc-224 ")).toEqual({
      projectKey: "BYC",
      number: 224,
    })
  })

  it("rejects text that is not a key", () => {
    expect(parseTaskKey("BYC")).toBeNull()
    expect(parseTaskKey("-12")).toBeNull()
    expect(parseTaskKey("1BYC-12")).toBeNull()
  })
})

describe("isClosed", () => {
  it("treats done and canceled as closed", () => {
    expect(isClosed("done")).toBe(true)
    expect(isClosed("canceled")).toBe(true)
    expect(isClosed("in_review")).toBe(false)
  })
})

describe("positionBetween", () => {
  it("lands between two neighbours", () => {
    expect(positionBetween(100, 200)).toBe(150)
  })

  it("steps past a single neighbour at either end", () => {
    expect(positionBetween(null, 1024)).toBe(0)
    expect(positionBetween(1024, null)).toBe(2048)
  })

  it("seeds an empty column", () => {
    expect(positionBetween(null, null)).toBe(1024)
  })

  it("always produces a value strictly between its neighbours", () => {
    const mid = positionBetween(1, 2)
    expect(mid).toBeGreaterThan(1)
    expect(mid).toBeLessThan(2)
  })
})

describe("nextPosition", () => {
  it("appends after the highest sibling", () => {
    expect(
      nextPosition([task({ id: "a", position: 10 }), task({ id: "b", position: 30 })])
    ).toBe(1054)
  })

  it("seeds an empty list", () => {
    expect(nextPosition([])).toBe(1024)
  })
})

describe("positionForIndex", () => {
  const ordered = [
    task({ id: "a", position: 100 }),
    task({ id: "b", position: 200 }),
    task({ id: "c", position: 300 }),
  ]

  it("drops at the top, between, and at the bottom", () => {
    expect(positionForIndex(ordered, 0)).toBe(100 - 1024)
    expect(positionForIndex(ordered, 1)).toBe(150)
    expect(positionForIndex(ordered, 3)).toBe(300 + 1024)
  })

  it("seeds an empty column", () => {
    expect(positionForIndex([], 0)).toBe(1024)
  })
})

describe("sortByPriority", () => {
  it("orders urgent first and breaks ties on position", () => {
    const sorted = sortByPriority([
      task({ id: "low", priority: "low", position: 1 }),
      task({ id: "urgent", priority: "urgent", position: 9 }),
      task({ id: "none-early", priority: "none", position: 1 }),
      task({ id: "none-late", priority: "none", position: 2 }),
    ])
    expect(sorted.map((t) => t.id)).toEqual([
      "urgent",
      "low",
      "none-early",
      "none-late",
    ])
  })
})

describe("groupByStatus", () => {
  const tasks = [
    task({ id: "a", status: "todo", position: 20 }),
    task({ id: "b", status: "in_review" }),
    task({ id: "c", status: "todo", position: 10 }),
  ]

  it("buckets into board order and sorts each bucket by position", () => {
    const groups = groupByStatus(tasks)
    expect(groups.map((g) => g.status)).toEqual(["in_review", "todo"])
    expect(groups[1]!.tasks.map((t) => t.id)).toEqual(["c", "a"])
  })

  it("drops empty statuses unless asked for them", () => {
    expect(groupByStatus(tasks)).toHaveLength(2)
    expect(groupByStatus(tasks, true)).toHaveLength(7)
  })

  it("labels each group", () => {
    expect(groupByStatus(tasks)[0]!.label).toBe("In Review")
  })
})

describe("buildTaskTree", () => {
  it("nests children under their parents, deeply", () => {
    const tree = buildTaskTree([
      task({ id: "root" }),
      task({ id: "child", parentId: "root" }),
      task({ id: "grandchild", parentId: "child" }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0]!.children[0]!.task.id).toBe("child")
    expect(tree[0]!.children[0]!.children[0]!.task.id).toBe("grandchild")
  })

  it("promotes a task whose parent is not in the list", () => {
    const tree = buildTaskTree([task({ id: "orphan", parentId: "elsewhere" })])
    expect(tree.map((n) => n.task.id)).toEqual(["orphan"])
  })

  it("sorts siblings by position at every level", () => {
    const tree = buildTaskTree([
      task({ id: "root" }),
      task({ id: "b", parentId: "root", position: 20 }),
      task({ id: "a", parentId: "root", position: 10 }),
    ])
    expect(tree[0]!.children.map((n) => n.task.id)).toEqual(["a", "b"])
  })
})

describe("descendantIds and wouldCycle", () => {
  const tasks = [
    task({ id: "root" }),
    task({ id: "child", parentId: "root" }),
    task({ id: "grandchild", parentId: "child" }),
    task({ id: "other" }),
  ]

  it("collects every descendant", () => {
    expect(descendantIds(tasks, "root")).toEqual(["child", "grandchild"])
    expect(descendantIds(tasks, "other")).toEqual([])
  })

  it("catches self-parenting and descendant-parenting", () => {
    expect(wouldCycle(tasks, "root", "root")).toBe(true)
    expect(wouldCycle(tasks, "root", "grandchild")).toBe(true)
    expect(wouldCycle(tasks, "root", "other")).toBe(false)
    expect(wouldCycle(tasks, "root", null)).toBe(false)
  })
})

describe("resolveTaskRef", () => {
  const tasks = [
    task({ id: "1", key: "BYC-224", title: "build an IDE" }),
    task({ id: "2", key: "BYC-41", title: "docs feature" }),
    task({ id: "3", key: "BYC-42", title: "docs" }),
  ]

  it("matches an exact key, case-insensitively", () => {
    expect(resolveTaskRef(tasks, "byc-224")?.id).toBe("1")
  })

  it("matches a key embedded in a sentence", () => {
    expect(resolveTaskRef(tasks, "please finish BYC-41 today")?.id).toBe("2")
  })

  it("prefers an exact title over a substring", () => {
    expect(resolveTaskRef(tasks, "docs")?.id).toBe("3")
  })

  it("prefers the longest title quoted inside a phrase", () => {
    expect(resolveTaskRef(tasks, "work on the docs feature now")?.id).toBe("2")
  })

  it("returns null for a blank or unmatched query", () => {
    expect(resolveTaskRef(tasks, "  ")).toBeNull()
    expect(resolveTaskRef(tasks, "nothing like this")).toBeNull()
  })
})

describe("searchTasks", () => {
  const tasks = [
    task({ id: "root", key: "BYC-1", title: "web infra" }),
    task({ id: "child", key: "BYC-2", title: "spa", parentId: "root" }),
    task({ id: "loner", key: "BYC-3", title: "stripe" }),
  ]

  it("returns everything for a blank query", () => {
    expect(searchTasks(tasks, "  ")).toHaveLength(3)
  })

  it("matches on key or title", () => {
    expect(searchTasks(tasks, "BYC-3").map((t) => t.id)).toEqual(["loner"])
    expect(searchTasks(tasks, "stri").map((t) => t.id)).toEqual(["loner"])
  })

  it("keeps a matched task's ancestors so the hit stays reachable", () => {
    expect(searchTasks(tasks, "spa").map((t) => t.id)).toEqual([
      "root",
      "child",
    ])
  })
})

describe("filterByLabels", () => {
  const tasks = [
    task({ id: "both", labelIds: ["ui", "bug"] }),
    task({ id: "one", labelIds: ["ui"] }),
    task({ id: "none" }),
  ]

  it("passes everything through when no labels are selected", () => {
    expect(filterByLabels(tasks, [])).toHaveLength(3)
  })

  it("requires every selected label", () => {
    expect(filterByLabels(tasks, ["ui"]).map((t) => t.id)).toEqual([
      "both",
      "one",
    ])
    expect(filterByLabels(tasks, ["ui", "bug"]).map((t) => t.id)).toEqual([
      "both",
    ])
  })
})
