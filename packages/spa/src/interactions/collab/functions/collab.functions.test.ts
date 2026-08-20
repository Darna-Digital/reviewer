import { describe, expect, it } from "vitest";
import { createCollabFunctions } from "./collab.functions";
import {
  createMockCollabDependencies,
  mockBookmark,
  mockProject,
  mockTodo,
} from "./collab.functions.mock";

const setup = () => {
  const { deps, calls } = createMockCollabDependencies();
  return { fns: createCollabFunctions(deps), calls };
};

const LISTS = mockProject().lists;

describe("createProject", () => {
  it("trims what it was given", async () => {
    const { fns, calls } = setup();
    await fns.createProject("  Redesign  ", "  Basecamp-shaped  ");
    expect(calls.createProject).toEqual([["Redesign", "Basecamp-shaped"]]);
  });

  it("refuses a blank name rather than making an untitled project", async () => {
    const { fns, calls } = setup();
    expect(await fns.createProject("   ", "")).toBeNull();
    expect(calls.createProject).toEqual([]);
  });
});

describe("createTodo", () => {
  it("adds to the list it was given", async () => {
    const { fns, calls } = setup();
    await fns.createTodo("p1", "  Sketch  ", "doing");
    expect(calls.createTodo).toEqual([["p1", "Sketch", "doing"]]);
  });

  it("does nothing when nothing was typed", async () => {
    const { fns, calls } = setup();
    expect(await fns.createTodo("p1", "  ", "todo")).toBeNull();
    expect(calls.createTodo).toEqual([]);
  });
});

describe("setDone", () => {
  it("files a ticked to-do under the project's last list", async () => {
    const { fns, calls } = setup();
    await fns.setDone(mockTodo({ listId: "doing" }), true, LISTS);
    expect(calls.updateTodo).toEqual([["t1", { done: true, listId: "done" }]]);
  });

  it("hands an un-ticked one back to the first", async () => {
    const { fns, calls } = setup();
    await fns.setDone(mockTodo({ listId: "done", done: true }), false, LISTS);
    expect(calls.updateTodo).toEqual([["t1", { done: false, listId: "todo" }]]);
  });

  it("reads the lists in their own order, not storage order", async () => {
    const { fns, calls } = setup();
    await fns.setDone(mockTodo(), true, [
      { id: "done", name: "Done", order: 2, color: "#22c55e" },
      { id: "todo", name: "To do", order: 0, color: "#8b5cf6" },
    ]);
    expect(calls.updateTodo[0]?.[1]).toEqual({ done: true, listId: "done" });
  });

  it("leaves a one-list project's card where it is", async () => {
    const { fns, calls } = setup();
    await fns.setDone(mockTodo(), true, [
      { id: "todo", name: "To do", order: 0, color: "#8b5cf6" },
    ]);
    expect(calls.updateTodo[0]?.[1]).toEqual({ done: true, listId: "todo" });
  });
});

describe("moveTodo", () => {
  it("sends the list and the place in it together", async () => {
    const { fns, calls } = setup();
    await fns.moveTodo(mockTodo(), "doing", 3);
    expect(calls.updateTodo).toEqual([["t1", { listId: "doing", order: 3 }]]);
  });
});

describe("renameTodo", () => {
  it("sends a trimmed title", async () => {
    const { fns, calls } = setup();
    await fns.renameTodo(mockTodo(), "  Sketch it properly  ");
    expect(calls.updateTodo).toEqual([["t1", { title: "Sketch it properly" }]]);
  });

  it("refuses a blank title, and skips a no-op rename", async () => {
    const { fns, calls } = setup();
    expect(await fns.renameTodo(mockTodo(), "  ")).toBeNull();
    expect(
      await fns.renameTodo(mockTodo({ title: "Same" }), "  Same  ")
    ).toBeNull();
    expect(calls.updateTodo).toEqual([]);
  });
});

describe("addList", () => {
  it("refuses a blank column name", async () => {
    const { fns, calls } = setup();
    expect(await fns.addList("p1", " ")).toBeNull();
    await fns.addList("p1", "  Shipped ");
    expect(calls.addList).toEqual([["p1", "Shipped"]]);
  });
});

describe("notes", () => {
  it("starts an untitled note rather than refusing it", async () => {
    const { fns, calls } = setup();
    await fns.createNote("   ", "");
    expect(calls.createNote).toEqual([["", ""]]);
  });

  it("writes the body separately from starting the note", async () => {
    const { fns, calls } = setup();
    await fns.saveNote("n1", "# Scratch");
    expect(calls.saveNote).toEqual([["n1", "# Scratch"]]);
  });
});

describe("toggleBookmark", () => {
  it("stars what is not starred, and says so", async () => {
    const { fns, calls } = setup();
    expect(await fns.toggleBookmark([], "project", "p1", "Redesign")).toBe(
      true
    );
    expect(calls.addBookmark).toEqual([["project", "p1", "Redesign"]]);
    expect(calls.removeBookmark).toEqual([]);
  });

  it("un-stars what is starred, and says so", async () => {
    const { fns, calls } = setup();
    const stars = [mockBookmark({ kind: "note", targetId: "n1" })];
    expect(await fns.toggleBookmark(stars, "note", "n1", "Scratch")).toBe(
      false
    );
    expect(calls.removeBookmark).toEqual([["note", "n1"]]);
    expect(calls.addBookmark).toEqual([]);
  });

  it("tells the same id under two kinds apart", async () => {
    const { fns, calls } = setup();
    const stars = [mockBookmark({ kind: "note", targetId: "x" })];
    expect(await fns.toggleBookmark(stars, "todo", "x", "A card")).toBe(true);
    expect(calls.addBookmark).toEqual([["todo", "x", "A card"]]);
  });
});
