import { describe, expect, it } from "vitest";
import type {
  CollabBookmark,
  CollabNote,
  CollabProject,
  CollabTodo,
} from "../schema/collab.schema.ts";
import {
  board,
  bookmarkKey,
  byDueThenOrder,
  dedupeBookmarks,
  firstListId,
  isBookmarked,
  listedProjects,
  myNotes,
  myTodos,
  named,
  nextOrder,
  nextProjectColor,
  PROJECT_COLORS,
  projectLists,
  projectProgress,
  resolveListId,
  sortedTodos,
} from "./collab.functions.ts";

const project = (over: Partial<CollabProject> = {}): CollabProject => ({
  id: "p1",
  name: "Redesign",
  purpose: "",
  color: "#f97316",
  lists: [
    { id: "doing", name: "In progress", order: 1, color: "#f59e0b" },
    { id: "todo", name: "To do", order: 0, color: "#8b5cf6" },
  ],
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const todo = (over: Partial<CollabTodo> = {}): CollabTodo => ({
  id: "t1",
  projectId: "p1",
  listId: "todo",
  title: "Do the thing",
  notes: "",
  assignee: "",
  done: false,
  dueOn: "",
  order: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const note = (over: Partial<CollabNote> = {}): CollabNote => ({
  id: "n1",
  projectId: "",
  title: "Note",
  content: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const bookmark = (over: Partial<CollabBookmark> = {}): CollabBookmark => ({
  id: "b1",
  kind: "project",
  targetId: "p1",
  label: "Redesign",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("projectLists", () => {
  it("puts the lists in their own order rather than storage order", () => {
    expect(projectLists(project()).map((list) => list.id)).toEqual([
      "todo",
      "doing",
    ]);
  });

  it("does not mutate the project's own array", () => {
    const p = project();
    projectLists(p);
    expect(p.lists.map((list) => list.id)).toEqual(["doing", "todo"]);
  });

  it("stands the defaults in for a project holding none", () => {
    expect(projectLists(project({ lists: [] })).map((l) => l.id)).toEqual([
      "todo",
      "doing",
      "done",
    ]);
  });
});

describe("resolveListId", () => {
  it("keeps a list the project actually holds", () => {
    expect(resolveListId(project(), "doing")).toBe("doing");
  });

  it("puts a card pointed at a deleted list back in the first one", () => {
    expect(resolveListId(project(), "archived-list")).toBe("todo");
    expect(firstListId(project())).toBe("todo");
  });
});

describe("nextOrder", () => {
  it("lands a new card after the last one in its own list", () => {
    const todos = [
      todo({ id: "a", listId: "todo", order: 4 }),
      todo({ id: "b", listId: "doing", order: 9 }),
    ];
    expect(nextOrder(todos, "todo")).toBe(5);
  });

  it("starts at one in an empty list", () => {
    expect(nextOrder([], "todo")).toBe(1);
  });
});

describe("board", () => {
  it("deals every card into its list, keeping empty columns", () => {
    const todos = [
      todo({ id: "b", listId: "todo", order: 2 }),
      todo({ id: "a", listId: "todo", order: 1 }),
    ];
    const columns = board(
      project({
        lists: [
          { id: "todo", name: "To do", order: 0, color: "#8b5cf6" },
          { id: "doing", name: "In progress", order: 1, color: "#f59e0b" },
        ],
      }),
      todos
    );

    expect(columns.map((column) => column.list.id)).toEqual(["todo", "doing"]);
    expect(columns[0]?.todos.map((t) => t.id)).toEqual(["a", "b"]);
    expect(columns[1]?.todos).toEqual([]);
  });

  it("leaves another project's cards out", () => {
    const columns = board(project(), [todo({ id: "x", projectId: "p2" })]);
    expect(columns.flatMap((column) => column.todos)).toEqual([]);
  });

  it("shows a card whose list is gone rather than dropping it", () => {
    const columns = board(project(), [todo({ id: "orphan", listId: "gone" })]);
    expect(columns[0]?.todos.map((t) => t.id)).toEqual(["orphan"]);
  });
});

describe("sortedTodos", () => {
  it("breaks an order tie on id so the sort is total", () => {
    const todos = [todo({ id: "b", order: 1 }), todo({ id: "a", order: 1 })];
    expect(sortedTodos(todos).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("myTodos", () => {
  const todos = [
    todo({ id: "mine-late", assignee: "Rūtenis", dueOn: "2026-01-05" }),
    todo({ id: "mine-soon", assignee: "rūtenis ", dueOn: "2026-01-02" }),
    todo({ id: "mine-undated", assignee: "RŪTENIS", order: 3 }),
    todo({ id: "theirs", assignee: "Someone else", dueOn: "2026-01-01" }),
    todo({ id: "done", assignee: "Rūtenis", done: true }),
    todo({ id: "loose", assignee: "" }),
  ];

  it("takes only the viewer's open work, however they were typed", () => {
    expect(myTodos(todos, "Rūtenis").map((t) => t.id)).toEqual([
      "mine-soon",
      "mine-late",
      "mine-undated",
    ]);
  });

  it("reads a blank viewer as the unassigned pile", () => {
    expect(myTodos(todos, "  ").map((t) => t.id)).toEqual(["loose"]);
  });

  it("does not mutate the list it was given", () => {
    const original = todos.map((t) => t.id);
    myTodos(todos, "Rūtenis");
    expect(todos.map((t) => t.id)).toEqual(original);
  });
});

describe("byDueThenOrder", () => {
  it("puts dated work ahead of undated whichever side it is on", () => {
    const dated = todo({ dueOn: "2026-02-01" });
    const undated = todo({ dueOn: "" });
    expect(byDueThenOrder(dated, undated)).toBeLessThan(0);
    expect(byDueThenOrder(undated, dated)).toBeGreaterThan(0);
  });
});

describe("myNotes", () => {
  it("leads with unfiled notes, each half newest first", () => {
    const notes = [
      note({ id: "filed-old", projectId: "p1", updatedAt: "2026-01-01" }),
      note({ id: "own-old", updatedAt: "2026-01-02" }),
      note({ id: "filed-new", projectId: "p1", updatedAt: "2026-01-09" }),
      note({ id: "own-new", updatedAt: "2026-01-08" }),
    ];
    expect(myNotes(notes).map((n) => n.id)).toEqual([
      "own-new",
      "own-old",
      "filed-new",
      "filed-old",
    ]);
  });
});

describe("bookmarks", () => {
  it("identifies a target by kind and id together", () => {
    expect(bookmarkKey("todo", "1")).not.toBe(bookmarkKey("note", "1"));
  });

  it("answers whether a thing is starred", () => {
    const bookmarks = [bookmark({ kind: "note", targetId: "n7" })];
    expect(isBookmarked(bookmarks, "note", "n7")).toBe(true);
    expect(isBookmarked(bookmarks, "todo", "n7")).toBe(false);
  });

  it("keeps the newest of a double-fired star and drops the rest", () => {
    const kept = dedupeBookmarks([
      bookmark({ id: "old", createdAt: "2026-01-01" }),
      bookmark({ id: "new", createdAt: "2026-01-02" }),
      bookmark({ id: "other", targetId: "p2", createdAt: "2026-01-03" }),
    ]);
    expect(kept.map((b) => b.id)).toEqual(["other", "new"]);
  });
});

describe("named", () => {
  it("trims, and falls back when nothing is left", () => {
    expect(named("  Kickoff  ", "Untitled")).toBe("Kickoff");
    expect(named("   ", "Untitled")).toBe("Untitled");
  });
});

describe("nextProjectColor", () => {
  it("walks the palette rather than repeating one", () => {
    expect(nextProjectColor([])).toBe(PROJECT_COLORS[0]);
    expect(nextProjectColor([project(), project()])).toBe(PROJECT_COLORS[2]);
  });

  it("wraps once the palette runs out", () => {
    const many = PROJECT_COLORS.map(() => project());
    expect(nextProjectColor(many)).toBe(PROJECT_COLORS[0]);
  });
});

describe("listedProjects", () => {
  it("keeps live projects above archived ones, newest first in each half", () => {
    const projects = [
      project({ id: "old", createdAt: "2026-01-01" }),
      project({ id: "archived", createdAt: "2026-01-09", archived: true }),
      project({ id: "new", createdAt: "2026-01-05" }),
    ];
    expect(listedProjects(projects).map((p) => p.id)).toEqual([
      "new",
      "old",
      "archived",
    ]);
  });
});

describe("projectProgress", () => {
  it("counts what is done out of what there is", () => {
    expect(projectProgress([todo({ done: true }), todo(), todo()])).toEqual({
      done: 1,
      total: 3,
    });
  });
});
