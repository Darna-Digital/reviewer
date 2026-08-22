import { describe, expect, it } from "vitest";
import {
  boardPath,
  COLLAB_SHORTCUTS,
  collabWidth,
  nextPanel,
  notesPath,
  projectIdOf,
  projectPath,
  todosPath,
} from "./collab-layout.functions";

describe("collabWidth", () => {
  it("gives the board the window and everything else a column", () => {
    expect(collabWidth(boardPath("p1"))).toBe("wide");
    expect(collabWidth(projectPath("p1"))).toBe("narrow");
    expect(collabWidth(todosPath("p1"))).toBe("narrow");
    expect(collabWidth(notesPath("p1"))).toBe("narrow");
    expect(collabWidth("/modes/collaboration")).toBe("narrow");
  });

  it("is not fooled by a board deeper in the path, or by a search", () => {
    expect(collabWidth("/modes/collaboration/projects/board/todos")).toBe(
      "narrow"
    );
    expect(collabWidth(`${boardPath("p1")}?card=t1`)).toBe("wide");
  });
});

describe("projectIdOf", () => {
  it("names the project a surface is under", () => {
    expect(projectIdOf(boardPath("p1"))).toBe("p1");
    expect(projectIdOf(notesPath("p9"))).toBe("p9");
  });

  it("answers null where there is no project", () => {
    expect(projectIdOf("/modes/collaboration")).toBeNull();
    expect(projectIdOf("/modes/code/browse")).toBeNull();
  });
});

describe("nextPanel", () => {
  it("opens what was pressed", () => {
    expect(nextPanel(null, "tasks")).toBe("tasks");
  });

  it("closes on a second press of the same shortcut", () => {
    expect(nextPanel("tasks", "tasks")).toBeNull();
  });

  it("swaps contents rather than closing when a neighbour is pressed", () => {
    expect(nextPanel("tasks", "notes")).toBe("notes");
  });
});

describe("COLLAB_SHORTCUTS", () => {
  it("carries the three the bar shows, in order", () => {
    expect(COLLAB_SHORTCUTS.map((s) => s.panel)).toEqual([
      "tasks",
      "bookmarks",
      "notes",
    ]);
    expect(COLLAB_SHORTCUTS.map((s) => s.label)).toEqual([
      "My tasks",
      "My bookmarks",
      "My notes",
    ]);
  });
});
